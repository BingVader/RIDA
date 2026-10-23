import React, { useState, useEffect } from 'react';
import LibraryView from './components/LibraryView';
import BrowseView from './components/BrowseView';
import ReaderView from './components/ReaderView';
import { getBookMetadata, markBookAsStarted } from './db';
import { Sun, Moon, BookMarked, Compass, Library } from 'lucide-react';

function App() {
  const [view, setView] = useState('library'); // 'library' | 'browse' | 'reader'
  const [previousView, setPreviousView] = useState('library');
  const [activeBookId, setActiveBookId] = useState(null);
  const [globalTheme, setGlobalTheme] = useState(() => {
    return localStorage.getItem('RIDA-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', globalTheme);
    localStorage.setItem('RIDA-theme', globalTheme);
  }, [globalTheme]);

  const handleOpenBook = async (id) => {
    setPreviousView(view === 'reader' ? 'library' : view);
    setActiveBookId(id);
    setView('reader');

    try {
      await markBookAsStarted(id);
      const meta = await getBookMetadata(id);
      if (meta && meta.lastTheme) {
        setGlobalTheme(meta.lastTheme);
      }
    } catch (e) {
      console.warn("Could not load book theme metadata", e);
    }
  };

  const handleBackToLibrary = () => {
    setView(previousView || 'library');
    setActiveBookId(null);
  };

  const toggleGlobalTheme = () => {
    setGlobalTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-container" data-theme={globalTheme}>
      {view !== 'reader' && (
        <div className="app-top-nav glass">
          <div className="nav-tabs-pill">
            <button
              className={`nav-tab-btn ${view === 'library' ? 'active' : ''}`}
              onClick={() => setView('library')}
            >
              <Library size={16} />
              <span>My Books</span>
            </button>
            <button
              className={`nav-tab-btn ${view === 'browse' ? 'active' : ''}`}
              onClick={() => setView('browse')}
            >
              <Compass size={16} />
              <span>Browse Catalog</span>
            </button>
          </div>

          <button
            className="btn-icon theme-toggle-top"
            onClick={toggleGlobalTheme}
            title={globalTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {globalTheme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      )}

      {view === 'library' && (
        <LibraryView 
          onOpenBook={handleOpenBook}
          onNavigateToBrowse={() => setView('browse')}
        />
      )}

      {view === 'browse' && (
        <BrowseView
          onOpenBook={handleOpenBook}
          onNavigateToLibrary={() => setView('library')}
        />
      )}

      {view === 'reader' && activeBookId && (
        <ReaderView
          bookId={activeBookId}
          onBackToLibrary={handleBackToLibrary}
        />
      )}
    </div>
  );
}

export default App;
