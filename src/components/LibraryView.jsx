import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Trash2,
  Search,
  UploadCloud,
  Book,
  ArrowRight,
  Clock,
  CheckCircle,
  FileWarning,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { 
  saveBook, 
  getBooksList, 
  deleteBook,
  getDirectoryHandle,
  saveDirectoryHandle,
  disconnectDirectory,
  scanLocalDirectory,
  verifyDirectoryPermission
} from '../db';
import ePub from 'epubjs';


const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function LibraryView({ onOpenBook }) {
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef(null);

  const [dirHandle, setDirHandle] = useState(null);
  const [dirPermission, setDirPermission] = useState('prompt');
  const [dirName, setDirName] = useState('');


  const loadBooks = async () => {
    try {
      const list = await getBooksList();
      setBooks(list);
    } catch (err) {
      console.error("Error loading books list", err);
    }
  };

  const initDirectory = async () => {
    try {
      const handle = await getDirectoryHandle();
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name);
        const permission = await handle.queryPermission();
        setDirPermission(permission);
        
        if (permission === 'granted') {
          setIsProcessing(true);
          setProcessingStatus('Scanning connected folder...');
          await scanLocalDirectory(handle);
          await loadBooks();
          setIsProcessing(false);
          setProcessingStatus('');
        }
      }
    } catch (err) {
      console.error("Failed to restore directory handle", err);
    }
  };

  useEffect(() => {
    loadBooks();
    initDirectory();
  }, []);


  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.epub')) {
      alert('Please upload a valid .epub file.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Parsing "${file.name}"...`);

    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      try {
        setProcessingStatus('Extracting book metadata...');
        const book = ePub(arrayBuffer);
        await book.ready;

        const metadata = book.package.metadata;
        const title = metadata.title || file.name.replace('.epub', '');
        const author = metadata.creator || 'Unknown Author';

        let coverBase64 = null;
        try {
          setProcessingStatus('Extracting cover image...');
          const coverUrl = await book.coverUrl();
          if (coverUrl) {
            const coverBlob = await book.archive.getBlob(coverUrl);
            if (coverBlob instanceof Blob) {
              coverBase64 = await blobToBase64(coverBlob);
            }
          }
        } catch (coverErr) {
          console.warn("Cover image extraction failed, proceeding without cover", coverErr);
        }


        const id = metadata.identifier || `epub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        setProcessingStatus('Saving book to local database...');
        await saveBook(id, { title, author, cover: coverBase64 }, arrayBuffer);


        await loadBooks();
        setIsProcessing(false);
        setProcessingStatus('');
      } catch (err) {
        console.error("Error parsing epub", err);
        alert(`Failed to load "${file.name}". Ensure it is not DRM-protected and is a valid EPUB file.`);
        setIsProcessing(false);
        setProcessingStatus('');
      }
    };

    fileReader.onerror = () => {
      alert('Error reading file contents.');
      setIsProcessing(false);
      setProcessingStatus('');
    };

    fileReader.readAsArrayBuffer(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDelete = async (e, id, title) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteBook(id);
      loadBooks();
    }
  };


  const handleConnectFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Local Folder Access is not supported by your current browser. Please use Chrome, Edge, or install this as a desktop app.');
      return;
    }
    
    try {
      const handle = await window.showDirectoryPicker();
      if (handle) {
        await saveDirectoryHandle(handle);
        setDirHandle(handle);
        setDirName(handle.name);
        setDirPermission('granted');
        
        setIsProcessing(true);
        setProcessingStatus('Scanning folder...');
        await scanLocalDirectory(handle, (status) => setProcessingStatus(status));
        await loadBooks();
        setIsProcessing(false);
        setProcessingStatus('');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to connect folder", err);
        alert('Failed to connect the local folder.');
      }
    }
  };

  const handleAuthorizeFolder = async () => {
    if (!dirHandle) return;
    try {
      const granted = await verifyDirectoryPermission(dirHandle, false);
      if (granted) {
        setDirPermission('granted');
        setIsProcessing(true);
        setProcessingStatus('Scanning connected folder...');
        await scanLocalDirectory(dirHandle, (status) => setProcessingStatus(status));
        await loadBooks();
        setIsProcessing(false);
        setProcessingStatus('');
      } else {
        setDirPermission('denied');
        alert('Permission denied. Cannot access books inside the local folder.');
      }
    } catch (err) {
      console.error("Failed to request permission", err);
    }
  };

  const handleSyncFolder = async () => {
    if (!dirHandle) return;
    setIsProcessing(true);
    setProcessingStatus('Scanning connected folder...');
    try {
      await scanLocalDirectory(dirHandle, (status) => setProcessingStatus(status));
      await loadBooks();
    } catch (err) {
      console.error("Failed to scan directory", err);
      alert('Failed to scan local folder.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDisconnectFolder = async () => {
    if (confirm('Disconnect the folder? This will remove folder books from your library list (the actual files on your drive will not be deleted).')) {
      setIsProcessing(true);
      setProcessingStatus('Disconnecting folder...');
      try {
        await disconnectDirectory();
        
        const list = await getBooksList();
        for (const book of list) {
          if (book.storageType === 'local') {
            await deleteBook(book.id);
          }
        }
        
        setDirHandle(null);
        setDirName('');
        setDirPermission('prompt');
        await loadBooks();
      } catch (err) {
        console.error("Failed to disconnect", err);
      } finally {
        setIsProcessing(false);
        setProcessingStatus('');
      }
    }
  };


  const loadSampleBook = async () => {
    setIsProcessing(true);
    setProcessingStatus('Fetching sample book...');
    try {
      const response = await fetch('/books/sample.epub');
      if (!response.ok) throw new Error('Sample book file not found in public/books/sample.epub');

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      setProcessingStatus('Parsing sample book...');
      const book = ePub(arrayBuffer);
      await book.ready;

      const metadata = book.package.metadata;
      const title = metadata.title || 'Alice in Wonderland';
      const author = metadata.creator || 'Lewis Carroll';

      let coverBase64 = null;
      try {
        const coverUrl = await book.coverUrl();
        if (coverUrl) {
          const coverBlob = await book.archive.getBlob(coverUrl);
          if (coverBlob instanceof Blob) {
            coverBase64 = await blobToBase64(coverBlob);
          }
        }
      } catch (err) {
        console.warn("Failed to get cover URL", err);
      }

      const id = metadata.identifier || 'alice-in-wonderland-sample';
      await saveBook(id, { title, author, cover: coverBase64 }, arrayBuffer);

      await loadBooks();
      setIsProcessing(false);
      setProcessingStatus('');
    } catch (err) {
      console.error(err);
      alert('Could not download sample book. You can import your own epub files manually.');
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };


  const filteredBooks = books.filter(book => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'unread') return book.progress === 0;
    if (filterStatus === 'reading') return book.progress > 0 && book.progress < 99;
    if (filterStatus === 'finished') return book.progress >= 99;
    return true;
  });

  return (
    <div className="library-container animate-fade">
      { }
      <div className="library-header glass">
        <div className="brand-section">
          <div className="logo">
            <BookOpen className="logo-icon" />
            <h1>RIDA</h1>
          </div>
          <p>Your local-first reading space</p>
        </div>

        <div className="actions-section">
          <div className="search-bar">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search books or authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {'showDirectoryPicker' in window && (
            <div className="folder-actions-wrapper">
              {!dirHandle ? (
                <button
                  className="btn-secondary"
                  onClick={handleConnectFolder}
                  disabled={isProcessing}
                >
                  <FolderOpen size={18} />
                  Connect Local Folder
                </button>
              ) : dirPermission === 'granted' ? (
                <div className="folder-status-group">
                  <span className="folder-status-tag" title={`Connected to ${dirName}`}>
                    📁 {dirName}
                  </span>
                  <button
                    className="btn-secondary btn-sync"
                    onClick={handleSyncFolder}
                    disabled={isProcessing}
                    title="Sync folder contents"
                  >
                    <RefreshCw size={14} className={isProcessing && processingStatus.includes('Scanning') ? 'spin' : ''} />
                    Sync
                  </button>
                  <button
                    className="btn-secondary btn-disconnect"
                    onClick={handleDisconnectFolder}
                    disabled={isProcessing}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="folder-status-group">
                  <button
                    className="btn-primary btn-authorize"
                    onClick={handleAuthorizeFolder}
                    disabled={isProcessing}
                  >
                    <FileWarning size={18} />
                    Authorize "{dirName}"
                  </button>
                  <button
                    className="btn-secondary btn-disconnect"
                    onClick={handleDisconnectFolder}
                    disabled={isProcessing}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <UploadCloud size={18} />
            Import EPUB
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFile(e.target.files?.[0])}
            accept=".epub"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      { }
      <div className="library-content">

        { }
        {books.length > 0 && (
          <div className="filter-tabs">
            {['all', 'unread', 'reading', 'finished'].map((status) => (
              <button
                key={status}
                className={`filter-tab ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="count-badge">
                  {status === 'all' && books.length}
                  {status === 'unread' && books.filter(b => b.progress === 0).length}
                  {status === 'reading' && books.filter(b => b.progress > 0 && b.progress < 99).length}
                  {status === 'finished' && books.filter(b => b.progress >= 99).length}
                </span>
              </button>
            ))}
          </div>
        )}

        { }
        {isProcessing && (
          <div className="processing-indicator glass">
            <div className="spinner"></div>
            <p>{processingStatus}</p>
          </div>
        )}

        { }
        {filteredBooks.length > 0 ? (
          <div className="books-grid">
            {filteredBooks.map((book) => {
              const radius = 22;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (book.progress / 100) * circumference;

              return (
                <div
                  key={book.id}
                  className="book-card glass-card"
                  onClick={() => onOpenBook(book.id)}
                >
                  { }
                  <div className="book-cover-container">
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} className="book-cover-img" />
                    ) : (
                      <div className="book-cover-placeholder">
                        <Book size={48} className="placeholder-book-icon" />
                        <div className="placeholder-details">
                          <span className="placeholder-title">{book.title}</span>
                          <span className="placeholder-author">{book.author}</span>
                        </div>
                      </div>
                    )}

                    { }
                    <button
                      className="btn-delete"
                      onClick={(e) => handleDelete(e, book.id, book.title)}
                      title="Delete Book"
                    >
                      <Trash2 size={16} />
                    </button>

                    { }
                    {book.progress >= 99 && (
                      <div className="finished-badge" title="Finished reading">
                        <CheckCircle size={16} />
                      </div>
                    )}
                  </div>

                  { }
                  <div className="book-details">
                    <h3 className="book-title" title={book.title}>{book.title}</h3>
                    <p className="book-author" title={book.author}>{book.author}</p>

                    <div className="book-footer">
                      <div className="progress-info">
                        <svg className="progress-ring" width="50" height="50">
                          <circle
                            className="progress-ring__circle-bg"
                            stroke="var(--border-color)"
                            strokeWidth="3.5"
                            fill="transparent"
                            r={radius}
                            cx="25"
                            cy="25"
                          />
                          <circle
                            className="progress-ring__circle"
                            stroke="var(--accent-color)"
                            strokeWidth="3.5"
                            fill="transparent"
                            r={radius}
                            cx="25"
                            cy="25"
                            strokeDasharray={`${circumference} ${circumference}`}
                            strokeDashoffset={strokeDashoffset}
                          />
                        </svg>
                        <div className="progress-percent">
                          <span>{Math.round(book.progress)}%</span>
                        </div>
                      </div>

                      <div className="read-meta">
                        <Clock size={12} className="meta-icon" />
                        <span>
                          {book.progress > 0
                            ? `Read ${new Date(book.lastRead).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                            : 'Unread'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (

          !isProcessing && (
            <div
              className={`library-empty-state glass-card ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <UploadCloud className="empty-upload-icon" />
              <h2>Your library is empty</h2>
              <p>Drag and drop EPUB files here or browse to load files from your local storage.</p>

              <div className="empty-actions">
                <button
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose EPUB File
                </button>
                <button
                  className="btn-secondary"
                  onClick={loadSampleBook}
                >
                  Load Sample Book
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
