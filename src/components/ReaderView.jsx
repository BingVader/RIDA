import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  BookOpen, 
  Menu, 
  Search, 
  Bookmark, 
  BookmarkCheck,
  Highlighter, 
  X,
  FileText,
  Edit3,
  Check
} from 'lucide-react';
import { getBookBinary, getBookMetadata, updateReadingProgress, updateAnnotations, markBookAsStarted } from '../db';
import SettingsPanel from './SettingsPanel';
import ePub from 'epubjs';

export default function ReaderView({ bookId, onBackToLibrary }) {
  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState('Loading...');
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState('');
  const [totalPages, setTotalPages] = useState('');
  
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('toc'); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  
  const [settings, setSettings] = useState({
    theme: 'light',
    fontSize: 16,
    fontFamily: "'Lora', Georgia, serif",
    lineHeight: 1.5,
    margin: 40,
    layout: 'auto'
  });

  
  const [toc, setToc] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [highlights, setHighlights] = useState([]);
  
  
  const [selectionMenu, setSelectionMenu] = useState({
    visible: false,
    cfiRange: null,
    text: '',
    x: 0,
    y: 0,
    contents: null
  });

  
  const [editingHighlightId, setEditingHighlightId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState('');

  const viewerRef = useRef(null);
  const renditionRef = useRef(null);

  
  useEffect(() => {
    let activeBook = null;
    let activeRendition = null;
    let isCancelled = false;

    const initBook = async () => {
      try {
        await markBookAsStarted(bookId);
        const [meta, binary] = await Promise.all([
          getBookMetadata(bookId),
          getBookBinary(bookId)
        ]);

        if (isCancelled) return;

        if (!binary) {
          alert('Book content not found.');
          onBackToLibrary();
          return;
        }

        
        setBookmarks(meta.bookmarks || []);
        setHighlights(meta.highlights || []);

        const epubBook = ePub(binary);
        if (isCancelled) {
          epubBook.destroy();
          return;
        }
        setBook(epubBook);
        activeBook = epubBook;

        await epubBook.ready;
        if (isCancelled) return;
        
        
        epubBook.loaded.navigation.then(nav => {
          if (isCancelled) return;
          setToc(nav.toc || []);
        });

        
        if (!viewerRef.current) return;
        
        const epubRendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: settings.layout === 'double' ? 'always' : (settings.layout === 'single' ? 'none' : 'auto')
        });

        if (isCancelled) {
          epubRendition.destroy();
          return;
        }
        setRendition(epubRendition);
        activeRendition = epubRendition;
        renditionRef.current = epubRendition;

        
        const savedLocation = meta.location;
        await epubRendition.display(savedLocation || undefined);
        if (isCancelled) return;

        
        applyStyleSettings(epubRendition, settings);

        
        epubRendition.on('relocated', (location) => {
          if (isCancelled) return;
          if (location && location.start) {
            const cfi = location.start.cfi;
            
            
            let pct = 0;
            if (epubBook.locations && epubBook.locations.length > 0) {
              pct = epubBook.locations.percentageFromCfi(cfi) * 100;
            } else {
              pct = location.start.percentage * 100;
            }
            setProgress(pct);
            
            
            updateReadingProgress(bookId, pct, cfi);

            
            if (location.start.displayed) {
              setCurrentPage(location.start.displayed.start);
              setTotalPages(location.start.displayed.total);
            }

            
            const currentCfi = location.start.cfi;
            const item = epubBook.navigation.get(currentCfi);
            if (item) {
              setChapterTitle(item.label.trim());
            } else {
              setChapterTitle('Reading');
            }
          }
        });

        
        epubRendition.on('selected', (cfiRange, contents) => {
          if (isCancelled) return;
          const selection = contents.window.getSelection();
          const text = selection.toString().trim();
          
          if (text.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const viewerEl = viewerRef.current;
            
            if (viewerEl) {
              const viewerRect = viewerEl.getBoundingClientRect();
              
              const x = rect.left + viewerRect.left + (rect.width / 2);
              const y = rect.top + viewerRect.top - 48; 

              setSelectionMenu({
                visible: true,
                cfiRange,
                text,
                x,
                y,
                contents
              });
            }
          }
        });

        
        epubRendition.on('click', () => {
          if (isCancelled) return;
          setSelectionMenu(prev => ({ ...prev, visible: false }));
          setIsSettingsOpen(false);
        });

        
        epubBook.locations.generate(1024).then(() => {
          if (isCancelled) return;
          
          if (renditionRef.current) {
            const loc = renditionRef.current.location;
            if (loc && loc.start) {
              const pct = epubBook.locations.percentageFromCfi(loc.start.cfi) * 100;
              setProgress(pct);
              updateReadingProgress(bookId, pct, loc.start.cfi);
            }
          }
        }).catch(err => {
          if (isCancelled) return;
          console.warn("Could not generate page locations", err);
        });

        setLoading(false);
      } catch (err) {
        if (isCancelled) return;
        console.error('Error opening epub book', err);
        alert('Could not render the book file. It might be corrupt or incompatible.');
        onBackToLibrary();
      }
    };

    initBook();

    
    return () => {
      isCancelled = true;
      if (activeRendition) activeRendition.destroy();
      if (activeBook) activeBook.destroy();
      setRendition(null);
      setBook(null);
      setLoading(true);
      if (viewerRef.current) {
        viewerRef.current.innerHTML = '';
      }
    };
  }, [bookId]);

  
  const applyStyleSettings = (rend, s) => {
    if (!rend) return;
    
    
    rend.themes.fontSize(`${s.fontSize}px`);
    
    
    const themeStyles = {
      light: {
        body: { background: '#ffffff', color: '#1e293b', 'font-family': `${s.fontFamily} !important` },
        p: { 'line-height': `${s.lineHeight} !important` }
      },
      dark: {
        body: { background: '#111827', color: '#f3f4f6', 'font-family': `${s.fontFamily} !important` },
        p: { 'line-height': `${s.lineHeight} !important` }
      },
      sepia: {
        body: { background: '#faf5e6', color: '#433422', 'font-family': `${s.fontFamily} !important` },
        p: { 'line-height': `${s.lineHeight} !important` }
      },
      charcoal: {
        body: { background: '#27272a', color: '#f4f4f5', 'font-family': `${s.fontFamily} !important` },
        p: { 'line-height': `${s.lineHeight} !important` }
      },
      emerald: {
        body: { background: '#0b231e', color: '#e6f4ea', 'font-family': `${s.fontFamily} !important` },
        p: { 'line-height': `${s.lineHeight} !important` }
      }
    };

    Object.keys(themeStyles).forEach(themeId => {
      rend.themes.register(themeId, themeStyles[themeId]);
    });
    rend.themes.select(s.theme);

    
    rend.themes.default({
      body: {
        'padding-left': `${s.margin}px !important`,
        'padding-right': `${s.margin}px !important`
      }
    });
  };

  
  useEffect(() => {
    if (rendition) {
      applyStyleSettings(rendition, settings);
      
      
      const spreadVal = settings.layout === 'double' ? 'always' : (settings.layout === 'single' ? 'none' : 'auto');
      if (typeof rendition.spread === 'function') {
        rendition.spread(spreadVal);
      } else if (rendition.settings) {
        rendition.settings.spread = spreadVal;
      }
      
      
      const currentLoc = rendition.location?.start?.cfi;
      if (currentLoc) {
        rendition.display(currentLoc);
      }
    }
  }, [settings, rendition]);

  
  useEffect(() => {
    if (rendition && highlights.length > 0) {
      highlights.forEach(hl => {
        try {
          rendition.annotations.add('highlight', hl.cfiRange, {}, null, `hl-${hl.color}`, {
            fill: hl.color,
            'fill-opacity': '0.3',
            'mix-blend-mode': 'multiply'
          });
        } catch (err) {
          
        }
      });
    }
  }, [rendition, highlights]);

  
  const syncAnnotations = async (updatedBookmarks, updatedHighlights) => {
    setBookmarks(updatedBookmarks);
    setHighlights(updatedHighlights);
    await updateAnnotations(bookId, updatedBookmarks, updatedHighlights);
  };

  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!rendition) return;
      if (e.key === 'ArrowLeft') {
        rendition.prev();
      } else if (e.key === 'ArrowRight') {
        rendition.next();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition]);

  
  const handleToggleBookmark = () => {
    if (!rendition) return;
    const currentCfi = rendition.location.start.cfi;
    const isBookmarked = bookmarks.some(b => b.cfi === currentCfi);

    let updatedBookmarks;
    if (isBookmarked) {
      updatedBookmarks = bookmarks.filter(b => b.cfi !== currentCfi);
    } else {
      const newBookmark = {
        id: `bm-${Date.now()}`,
        cfi: currentCfi,
        label: chapterTitle || `Position ${Math.round(progress)}%`,
        date: Date.now()
      };
      updatedBookmarks = [...bookmarks, newBookmark];
    }
    syncAnnotations(updatedBookmarks, highlights);
  };

  
  const handleAddHighlight = (color) => {
    if (!rendition || !selectionMenu.cfiRange) return;

    const newHighlight = {
      id: `hl-${Date.now()}`,
      cfiRange: selectionMenu.cfiRange,
      text: selectionMenu.text,
      color,
      note: '',
      date: Date.now()
    };

    const updatedHighlights = [...highlights, newHighlight];
    syncAnnotations(bookmarks, updatedHighlights);

    
    rendition.annotations.add('highlight', selectionMenu.cfiRange, {}, null, `hl-${color}`, {
      fill: color,
      'fill-opacity': '0.3',
      'mix-blend-mode': 'multiply'
    });

    
    if (selectionMenu.contents) {
      selectionMenu.contents.window.getSelection().removeAllRanges();
    }
    setSelectionMenu(prev => ({ ...prev, visible: false }));
  };

  
  const handleDeleteHighlight = (id, cfiRange) => {
    if (rendition) {
      rendition.annotations.remove(cfiRange, 'highlight');
    }
    const updatedHighlights = highlights.filter(hl => hl.id !== id);
    syncAnnotations(bookmarks, updatedHighlights);
  };

  
  const handleSaveNote = (id) => {
    const updatedHighlights = highlights.map(hl => {
      if (hl.id === id) {
        return { ...hl, note: tempNoteText };
      }
      return hl;
    });
    syncAnnotations(bookmarks, updatedHighlights);
    setEditingHighlightId(null);
    setTempNoteText('');
  };

  
  const startEditingNote = (hl) => {
    setEditingHighlightId(hl.id);
    setTempNoteText(hl.note || '');
  };

  
  const handleSearch = async () => {
    if (!book || !searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = [];
      const spine = book.spine;
      
      
      for (let i = 0; i < spine.length; i++) {
        const section = spine.get(i);
        await section.load(book.load.bind(book));
        
        const sectionResults = await section.find(searchQuery);
        section.unload();

        if (sectionResults && sectionResults.length > 0) {
          sectionResults.forEach(res => {
            
            const chap = book.navigation.get(res.cfi);
            results.push({
              cfi: res.cfi,
              excerpt: res.excerpt,
              chapter: chap ? chap.label.trim() : `Section ${i + 1}`
            });
          });
        }
      }
      setSearchResults(results);
    } catch (err) {
      console.error('Full-text search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="reader-container" data-theme={settings.theme}>
      
      {}
      <div className="reader-header glass">
        <div className="header-left">
          <button className="btn-icon" onClick={onBackToLibrary} title="Back to Library">
            <ArrowLeft size={20} />
          </button>
          <button className="btn-icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle navigation panel">
            <Menu size={20} />
          </button>
          <span className="chapter-indicator" title={chapterTitle}>{chapterTitle}</span>
        </div>

        <div className="header-right">
          <button 
            className="btn-icon bookmark-btn" 
            onClick={handleToggleBookmark} 
            title={bookmarks.some(b => b.cfi === rendition?.location?.start?.cfi) ? 'Remove Bookmark' : 'Add Bookmark'}
          >
            {rendition && bookmarks.some(b => b.cfi === rendition.location.start.cfi) ? (
              <BookmarkCheck size={20} className="active-bookmark" />
            ) : (
              <Bookmark size={20} />
            )}
          </button>
          <button 
            className={`btn-icon ${isSettingsOpen ? 'active' : ''}`} 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
            title="Appearance settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {}
      <div className="reader-sandbox">
        
        {}
        <div className={`reader-sidebar glass ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab ${activeTab === 'toc' ? 'active' : ''}`}
              onClick={() => setActiveTab('toc')}
            >
              <BookOpen size={16} />
              <span>Contents</span>
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={16} />
              <span>Search</span>
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookmarks')}
            >
              <Bookmark size={16} />
              <span>Bookmarks</span>
            </button>
            <button 
              className={`sidebar-tab ${activeTab === 'highlights' ? 'active' : ''}`}
              onClick={() => setActiveTab('highlights')}
            >
              <Highlighter size={16} />
              <span>Highlights</span>
            </button>
          </div>

          <div className="sidebar-tab-content">
            
            {}
            {activeTab === 'toc' && (
              <div className="toc-list-container">
                {toc.length > 0 ? (
                  <div className="toc-list">
                    {toc.map((item, idx) => (
                      <button
                        key={idx}
                        className="toc-item"
                        onClick={() => {
                          rendition.display(item.href);
                          if (window.innerWidth <= 768) setIsSidebarOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-panel-state">
                    <p>No table of contents found.</p>
                  </div>
                )}
              </div>
            )}

            {}
            {activeTab === 'search' && (
              <div className="search-panel">
                <div className="search-panel-input">
                  <input 
                    type="text" 
                    placeholder="Search inside book..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button className="search-trigger" onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <div className="mini-spinner"></div> : <Search size={16} />}
                  </button>
                </div>

                <div className="search-results-list">
                  {searchResults.length > 0 ? (
                    searchResults.map((res, idx) => (
                      <div 
                        key={idx} 
                        className="search-res-item"
                        onClick={() => {
                          rendition.display(res.cfi);
                          if (window.innerWidth <= 768) setIsSidebarOpen(false);
                        }}
                      >
                        <span className="search-res-chapter">{res.chapter}</span>
                        <p className="search-res-excerpt" dangerouslySetInnerHTML={{ 
                          __html: res.excerpt.replace(new RegExp(searchQuery, 'gi'), match => `<mark>${match}</mark>`) 
                        }}></p>
                      </div>
                    ))
                  ) : (
                    !isSearching && (
                      <div className="empty-panel-state">
                        <p>{searchQuery ? 'No results found.' : 'Enter a query and press enter to search.'}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {}
            {activeTab === 'bookmarks' && (
              <div className="bookmarks-panel">
                {bookmarks.length > 0 ? (
                  <div className="bookmarks-list">
                    {bookmarks.map((bm) => (
                      <div key={bm.id} className="bookmark-item">
                        <button 
                          className="bookmark-jump-btn"
                          onClick={() => {
                            rendition.display(bm.cfi);
                            if (window.innerWidth <= 768) setIsSidebarOpen(false);
                          }}
                        >
                          <Bookmark size={14} className="bookmark-list-icon" />
                          <div className="bookmark-item-details">
                            <span className="bookmark-label">{bm.label}</span>
                            <span className="bookmark-date">{new Date(bm.date).toLocaleDateString()}</span>
                          </div>
                        </button>
                        <button 
                          className="bookmark-delete-btn"
                          onClick={() => syncAnnotations(bookmarks.filter(b => b.id !== bm.id), highlights)}
                          title="Remove bookmark"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-panel-state">
                    <p>No bookmarks set yet.</p>
                  </div>
                )}
              </div>
            )}

            {}
            {activeTab === 'highlights' && (
              <div className="highlights-panel">
                {highlights.length > 0 ? (
                  <div className="highlights-list">
                    {highlights.map((hl) => (
                      <div key={hl.id} className="highlight-item">
                        <div className="highlight-item-header">
                          <span 
                            className="highlight-color-dot" 
                            style={{ backgroundColor: hl.color }}
                          ></span>
                          <span className="highlight-date">{new Date(hl.date).toLocaleDateString()}</span>
                          <button 
                            className="btn-delete-hl"
                            onClick={() => handleDeleteHighlight(hl.id, hl.cfiRange)}
                            title="Delete Highlight"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        
                        <p 
                          className="highlight-quoted-text"
                          onClick={() => {
                            rendition.display(hl.cfiRange);
                            if (window.innerWidth <= 768) setIsSidebarOpen(false);
                          }}
                        >
                          "{hl.text}"
                        </p>

                        {}
                        <div className="highlight-note-container">
                          {editingHighlightId === hl.id ? (
                            <div className="note-editor">
                              <textarea
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                placeholder="Add custom notes..."
                                rows={2}
                              />
                              <div className="note-editor-actions">
                                <button className="btn-note-cancel" onClick={() => setEditingHighlightId(null)}>
                                  Cancel
                                </button>
                                <button className="btn-note-save" onClick={() => handleSaveNote(hl.id)}>
                                  <Check size={12} /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="note-display">
                              {hl.note ? (
                                <p className="note-text">
                                  <strong>Note:</strong> {hl.note}
                                </p>
                              ) : (
                                <span className="note-placeholder">No notes added.</span>
                              )}
                              <button className="btn-note-edit" onClick={() => startEditingNote(hl)}>
                                <Edit3 size={12} /> Edit Note
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-panel-state">
                    <p>No text highlighted yet.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {}
        <div className="viewer-viewport">
          {loading && (
            <div className="reader-loader">
              <div className="spinner"></div>
              <p>Opening book...</p>
            </div>
          )}
          
          <button 
            className="viewer-nav-btn nav-btn-left" 
            onClick={() => rendition?.prev()}
            title="Previous page"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div id="viewer" ref={viewerRef} className="viewer-canvas"></div>
          
          <button 
            className="viewer-nav-btn nav-btn-right" 
            onClick={() => rendition?.next()}
            title="Next page"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {}
        {selectionMenu.visible && (
          <div 
            className="selection-popup-toolbar glass animate-fade"
            style={{ 
              left: `${selectionMenu.x}px`, 
              top: `${selectionMenu.y}px` 
            }}
          >
            {['#FFEB3B', '#8BC34A', '#2196F3', '#E91E63'].map((color) => (
              <button
                key={color}
                className="color-highlight-btn"
                style={{ backgroundColor: color }}
                onClick={() => handleAddHighlight(color)}
                title="Highlight"
              />
            ))}
            <div className="divider"></div>
            <button 
              className="toolbar-btn" 
              onClick={() => {
                navigator.clipboard.writeText(selectionMenu.text);
                alert("Text copied to clipboard!");
                selectionMenu.contents.window.getSelection().removeAllRanges();
                setSelectionMenu(prev => ({ ...prev, visible: false }));
              }}
            >
              Copy
            </button>
          </div>
        )}

        {}
        {isSettingsOpen && (
          <SettingsPanel 
            settings={settings}
            onUpdateSettings={setSettings}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}

      </div>

      {}
      <div className="reader-footer glass">
        <div className="footer-progress-bar-container">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress}
            onChange={(e) => {
              const val = parseFloat(e.target.value) / 100;
              if (book.locations && book.locations.length > 0) {
                const cfi = book.locations.cfiFromPercentage(val);
                rendition.display(cfi);
              }
            }}
            className="footer-progress-slider"
          />
        </div>
        <div className="footer-meta-info">
          <span>{Math.round(progress)}% read</span>
          {currentPage && totalPages && (
            <span>Page {currentPage} of {totalPages}</span>
          )}
        </div>
      </div>

    </div>
  );
}
