import React, { useState, useEffect } from 'react';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import { getBookMetadata } from './db';
import { Sun, Moon } from 'lucide-react';

function App() {
  const [view, setView] = useState('library');
  const [activeBookId, setActiveBookId] = useState(null);
  const [globalTheme, setGlobalTheme] = useState(() => {
    return localStorage.getItem('RIDA-theme') || 'light';
  });


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', globalTheme);
    localStorage.setItem('RIDA-theme', globalTheme);
  }, [globalTheme]);

  const handleOpenBook = async (id) => {
    setActiveBookId(id);
    setView('reader');


    try {
      const meta = await getBookMetadata(id);
      if (meta && meta.lastTheme) {
        setGlobalTheme(meta.lastTheme);
      }
    } catch (e) {
      console.warn("Could not load book theme metadata", e);
    }
  };

  const handleBackToLibrary = () => {
    setView('library');
    setActiveBookId(null);
  };

  const toggleGlobalTheme = () => {
    setGlobalTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-container" data-theme={globalTheme}>
      {view === 'library' && (
        <>
          { }
          <button
            className="btn-icon theme-toggle-fixed"
            onClick={toggleGlobalTheme}
            title={globalTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {globalTheme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <LibraryView onOpenBook={handleOpenBook} />
        </>
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

