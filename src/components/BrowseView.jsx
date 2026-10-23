import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  BookOpen,
  Download,
  Check,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Info,
  X,
  Globe,
  Layers,
  ArrowRight,
  BookMarked,
  Filter
} from 'lucide-react';
import {
  GENRE_CATEGORIES,
  searchCatalog,
  downloadAndSaveBook
} from '../services/catalogService';
import { getBooksList, markBookAsStarted } from '../db';

export default function BrowseView({ onOpenBook, onNavigateToLibrary }) {
  const [activeSource, setActiveSource] = useState('all'); // 'all' | 'gutenberg' | 'openlibrary'
  const [activeCategory, setActiveCategory] = useState(GENRE_CATEGORIES[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState(null);

  // Local library book IDs (to detect if already in user's library)
  const [localBooks, setLocalBooks] = useState([]);

  // Downloading state per bookId
  const [downloadingBookId, setDownloadingBookId] = useState(null);
  const [downloadProgressText, setDownloadProgressText] = useState('');

  // Selected book for details modal
  const [selectedBook, setSelectedBook] = useState(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg, duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, duration);
  };

  // Fetch local books list to check library presence
  const refreshLocalBooks = async () => {
    try {
      const list = await getBooksList();
      setLocalBooks(list);
    } catch (e) {
      console.warn('Failed to load local books list', e);
    }
  };

  useEffect(() => {
    refreshLocalBooks();
  }, []);

  // Check if a catalog book is already in local library
  const isBookInLibrary = (catalogBook) => {
    return localBooks.some(b => {
      if (b.id === catalogBook.id) return true;
      if (b.id === `online-${catalogBook.source}-${catalogBook.sourceId}`) return true;
      // Also match by clean title & author if identical
      if (b.title && catalogBook.title && b.title.trim().toLowerCase() === catalogBook.title.trim().toLowerCase()) {
        return true;
      }
      return false;
    });
  };

  const getLocalBookId = (catalogBook) => {
    const match = localBooks.find(b => {
      if (b.id === catalogBook.id) return true;
      if (b.id === `online-${catalogBook.source}-${catalogBook.sourceId}`) return true;
      if (b.title && catalogBook.title && b.title.trim().toLowerCase() === catalogBook.title.trim().toLowerCase()) {
        return true;
      }
      return false;
    });
    return match ? match.id : null;
  };

  // Perform Catalog Search
  const loadCatalog = async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const selectedCat = GENRE_CATEGORIES.find(c => c.id === activeCategory);
      const topic = selectedCat ? selectedCat.topic : '';

      const result = await searchCatalog({
        query: appliedSearch,
        topic: appliedSearch ? '' : topic, // If search is active, don't restrict to topic
        source: activeSource,
        page: pageNum
      });

      if (append) {
        // Prevent duplicates
        setBooks(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newUnique = result.books.filter(b => !existingIds.has(b.id));
          return [...prev, ...newUnique];
        });
      } else {
        setBooks(result.books);
      }

      setTotalCount(result.totalCount);
      setHasNext(result.hasNext);
      setPage(pageNum);
    } catch (err) {
      console.error('Catalog load error:', err);
      setError('Unable to load books from catalog. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Trigger search on filter / category / source changes
  useEffect(() => {
    loadCatalog(1, false);
  }, [activeSource, activeCategory, appliedSearch]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setAppliedSearch(searchQuery.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleCategorySelect = (categoryId) => {
    setActiveCategory(categoryId);
    setSearchQuery('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasNext) {
      loadCatalog(page + 1, true);
    }
  };

  // Download and Save to Library
  const handleDownloadAndSave = async (bookItem, e) => {
    if (e) e.stopPropagation();

    if (isBookInLibrary(bookItem)) {
      showToast(`"${bookItem.title}" is already in your library.`);
      return;
    }

    setDownloadingBookId(bookItem.id);
    setDownloadProgressText('Initiating download...');

    try {
      const { bookId, savedMeta } = await downloadAndSaveBook(bookItem, (status) => {
        setDownloadProgressText(status);
      });

      await refreshLocalBooks();
      showToast(`✓ "${savedMeta.title}" added to your library!`);
      return bookId;
    } catch (err) {
      console.error('Failed to import book:', err);
      alert(`Could not download book: ${err.message || 'Network error'}`);
    } finally {
      setDownloadingBookId(null);
      setDownloadProgressText('');
    }
  };

  // Download and Immediately Read
  const handleReadNow = async (bookItem, e) => {
    if (e) e.stopPropagation();

    const existingId = getLocalBookId(bookItem);
    if (existingId) {
      await markBookAsStarted(existingId);
      onOpenBook(existingId);
      return;
    }

    setDownloadingBookId(bookItem.id);
    setDownloadProgressText('Downloading to start reading...');

    try {
      const { bookId } = await downloadAndSaveBook(bookItem, (status) => {
        setDownloadProgressText(status);
      });

      await refreshLocalBooks();
      await markBookAsStarted(bookId);
      onOpenBook(bookId);
    } catch (err) {
      console.error('Failed to download for reading:', err);
      alert(`Could not open book: ${err.message || 'Network error'}`);
    } finally {
      setDownloadingBookId(null);
      setDownloadProgressText('');
    }
  };

  return (
    <div className="browse-container animate-fade">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="browse-toast glass-card animate-slide-down">
          <Sparkles size={16} className="toast-icon" />
          <span>{toastMessage}</span>
          <button className="toast-close" onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="browse-header glass">
        <div className="brand-section">
          <div className="browse-title-group">
            <div className="browse-badge">
              <Globe size={14} />
              <span>Free Public Domain Catalog</span>
            </div>
            <h1>Browse & Discover</h1>
          </div>
          <p>Explore thousands of classics and free ebooks from Project Gutenberg and Open Library</p>
        </div>

        {/* Search Bar & Source Selector */}
        <div className="browse-controls">
          <form className="browse-search-bar" onSubmit={handleSearchSubmit}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search by title, author, topic, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={handleClearSearch}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <button type="submit" className="btn-search-submit">
              Search
            </button>
          </form>

          {/* Source Tabs */}
          <div className="source-filter-group">
            <button
              className={`source-pill ${activeSource === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSource('all')}
            >
              <Layers size={14} />
              All Sources
            </button>
            <button
              className={`source-pill ${activeSource === 'gutenberg' ? 'active' : ''}`}
              onClick={() => setActiveSource('gutenberg')}
            >
              <BookOpen size={14} />
              Project Gutenberg
              <span className="source-tag-chip">Free EPUBs</span>
            </button>
            <button
              className={`source-pill ${activeSource === 'openlibrary' ? 'active' : ''}`}
              onClick={() => setActiveSource('openlibrary')}
            >
              <Globe size={14} />
              Open Library
            </button>
          </div>
        </div>
      </div>

      {/* Genre / Topic Categories Row */}
      <div className="browse-categories-wrapper">
        <div className="browse-categories-scroll">
          {GENRE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${activeCategory === cat.id && !appliedSearch ? 'active' : ''}`}
              onClick={() => handleCategorySelect(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="browse-status-bar">
        <div className="status-info">
          {appliedSearch ? (
            <span>
              Showing search results for "<strong>{appliedSearch}</strong>"
            </span>
          ) : (
            <span>
              Browsing category: <strong>{GENRE_CATEGORIES.find(c => c.id === activeCategory)?.label || 'All'}</strong>
            </span>
          )}
          {totalCount > 0 && <span className="total-badge">{totalCount.toLocaleString()} books</span>}
        </div>

        <button
          className="btn-refresh"
          onClick={() => loadCatalog(1, false)}
          disabled={loading}
          title="Refresh catalog"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Content Section */}
      <div className="browse-content">
        {/* Loading Spinner */}
        {loading && (
          <div className="browse-loading-state">
            <div className="spinner"></div>
            <p>Fetching books from online catalog...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="browse-error-state glass-card">
            <Info size={36} className="error-icon" />
            <h3>Could not load catalog</h3>
            <p>{error}</p>
            <button className="btn-primary" onClick={() => loadCatalog(1, false)}>
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {/* Empty Search State */}
        {!loading && !error && books.length === 0 && (
          <div className="browse-empty-state glass-card">
            <BookOpen size={48} className="empty-icon" />
            <h3>No books found</h3>
            <p>
              {appliedSearch
                ? `No books matched "${appliedSearch}". Try a different keyword or browse categories.`
                : 'No books available for this category right now.'}
            </p>
            {appliedSearch && (
              <button className="btn-secondary" onClick={handleClearSearch}>
                Clear Search
              </button>
            )}
          </div>
        )}

        {/* Books Grid */}
        {!loading && !error && books.length > 0 && (
          <>
            <div className="browse-books-grid">
              {books.map(book => {
                const inLibrary = isBookInLibrary(book);
                const isDownloading = downloadingBookId === book.id;

                return (
                  <div
                    key={book.id}
                    className="browse-book-card glass-card"
                    onClick={() => setSelectedBook(book)}
                  >
                    {/* Cover Container */}
                    <div className="browse-cover-wrapper">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="browse-cover-img"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}

                      <div className={`browse-cover-placeholder ${book.cover ? 'hidden' : ''}`}>
                        <BookOpen size={36} className="placeholder-icon" />
                        <span className="placeholder-title">{book.title}</span>
                      </div>

                      {/* Source Badge */}
                      <span className={`browse-source-tag ${book.source}`}>
                        {book.source === 'gutenberg' ? 'Gutenberg' : 'Open Library'}
                      </span>

                      {/* In Library Badge */}
                      {inLibrary && (
                        <div className="in-library-pill" title="Already in your library">
                          <Check size={12} />
                          <span>In Library</span>
                        </div>
                      )}

                      {/* Downloading Overlay */}
                      {isDownloading && (
                        <div className="downloading-overlay">
                          <div className="spinner-small"></div>
                          <span>{downloadProgressText || 'Downloading...'}</span>
                        </div>
                      )}
                    </div>

                    {/* Book Info */}
                    <div className="browse-card-body">
                      <h3 className="browse-book-title" title={book.title}>
                        {book.title}
                      </h3>
                      <p className="browse-book-author" title={book.author}>
                        {book.author}
                      </p>

                      {/* Meta Tags */}
                      <div className="browse-meta-tags">
                        {book.firstPublishYear && (
                          <span className="meta-tag">{book.firstPublishYear}</span>
                        )}
                        {book.languages && book.languages[0] && (
                          <span className="meta-tag">{book.languages[0].toUpperCase()}</span>
                        )}
                        {book.downloadCount > 0 && (
                          <span className="meta-tag" title={`${book.downloadCount} downloads`}>
                            📥 {book.downloadCount > 1000 ? `${(book.downloadCount / 1000).toFixed(1)}k` : book.downloadCount}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="browse-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-read-now"
                          onClick={(e) => handleReadNow(book, e)}
                          disabled={isDownloading}
                          title="Read this book now in RIDA"
                        >
                          <BookOpen size={14} />
                          {inLibrary ? 'Open Book' : 'Read Now'}
                        </button>

                        {!inLibrary ? (
                          <button
                            className="btn-add-library"
                            onClick={(e) => handleDownloadAndSave(book, e)}
                            disabled={isDownloading}
                            title="Add to My Library"
                          >
                            <Download size={14} />
                            Add
                          </button>
                        ) : (
                          <button
                            className="btn-in-library"
                            onClick={() => onNavigateToLibrary()}
                            title="Go to Library"
                          >
                            <BookMarked size={14} />
                            Saved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasNext && (
              <div className="browse-pagination">
                <button
                  className="btn-load-more glass-card"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <div className="spinner-small"></div>
                      Loading more books...
                    </>
                  ) : (
                    <>
                      Load More Books
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="browse-modal-backdrop" onClick={() => setSelectedBook(null)}>
          <div className="browse-modal-content glass-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedBook(null)}>
              <X size={20} />
            </button>

            <div className="modal-grid">
              {/* Modal Cover */}
              <div className="modal-cover-side">
                {selectedBook.cover ? (
                  <img
                    src={selectedBook.cover}
                    alt={selectedBook.title}
                    className="modal-cover-img"
                  />
                ) : (
                  <div className="modal-cover-placeholder">
                    <BookOpen size={56} />
                    <span>{selectedBook.title}</span>
                  </div>
                )}
                <span className={`modal-source-badge ${selectedBook.source}`}>
                  {selectedBook.sourceName || selectedBook.source}
                </span>
              </div>

              {/* Modal Details */}
              <div className="modal-info-side">
                <h2 className="modal-title">{selectedBook.title}</h2>
                <h4 className="modal-author">by {selectedBook.author}</h4>

                <div className="modal-badges-row">
                  {selectedBook.copyright && (
                    <span className="info-badge green">{selectedBook.copyright}</span>
                  )}
                  {selectedBook.firstPublishYear && (
                    <span className="info-badge">First Published: {selectedBook.firstPublishYear}</span>
                  )}
                  {selectedBook.languages && (
                    <span className="info-badge">Language: {selectedBook.languages.join(', ').toUpperCase()}</span>
                  )}
                  {selectedBook.downloadCount > 0 && (
                    <span className="info-badge">Downloads: {selectedBook.downloadCount.toLocaleString()}</span>
                  )}
                </div>

                {selectedBook.subjects && selectedBook.subjects.length > 0 && (
                  <div className="modal-subjects-section">
                    <h5>Subjects & Topics</h5>
                    <div className="subjects-chips">
                      {selectedBook.subjects.map((subj, idx) => (
                        <span key={idx} className="subject-chip">
                          {subj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-description-box">
                  <p>
                    {selectedBook.source === 'gutenberg'
                      ? 'This work is part of the Project Gutenberg public domain collection. It is free to read, download, and keep in your offline library.'
                      : 'This work is cataloged on Open Library. Free readable electronic editions and internet archive downloads are indexed.'}
                  </p>
                </div>

                {/* Modal Action Buttons */}
                <div className="modal-actions-row">
                  <button
                    className="btn-primary btn-modal-read"
                    onClick={() => {
                      handleReadNow(selectedBook);
                      setSelectedBook(null);
                    }}
                    disabled={downloadingBookId === selectedBook.id}
                  >
                    <BookOpen size={18} />
                    {isBookInLibrary(selectedBook) ? 'Open in Reader' : 'Read Now'}
                  </button>

                  {!isBookInLibrary(selectedBook) && (
                    <button
                      className="btn-secondary btn-modal-add"
                      onClick={() => handleDownloadAndSave(selectedBook)}
                      disabled={downloadingBookId === selectedBook.id}
                    >
                      <Download size={18} />
                      {downloadingBookId === selectedBook.id ? 'Downloading...' : 'Add to Library'}
                    </button>
                  )}

                  {selectedBook.detailsUrl && (
                    <a
                      href={selectedBook.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-icon-link"
                      title="View on original source website"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
