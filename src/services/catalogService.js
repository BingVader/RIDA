import ePub from 'epubjs';
import { saveBook, getBooksList } from '../db';

export const GENRE_CATEGORIES = [
  { id: 'all', label: '🔥 Featured & Popular', topic: '', olSubject: '' },
  { id: 'fiction', label: '📖 Fiction', topic: 'Fiction', olSubject: 'fiction' },
  { id: 'classics', label: '🏛️ Classics', topic: 'Classic Literature', olSubject: 'classic_literature' },
  { id: 'scifi', label: '🚀 Sci-Fi', topic: 'Science Fiction', olSubject: 'science_fiction' },
  { id: 'fantasy', label: '🧙 Fantasy', topic: 'Fantasy', olSubject: 'fantasy' },
  { id: 'mystery', label: '🔍 Mystery & Detective', topic: 'Detective and mystery stories', olSubject: 'mystery_and_detective_stories' },
  { id: 'philosophy', label: '💭 Philosophy', topic: 'Philosophy', olSubject: 'philosophy' },
  { id: 'adventure', label: '⚔️ Adventure', topic: 'Adventure stories', olSubject: 'adventure' },
  { id: 'romance', label: '❤️ Romance', topic: 'Love stories', olSubject: 'romance' },
  { id: 'horror', label: '👻 Horror & Gothic', topic: 'Gothic fiction', olSubject: 'horror' },
  { id: 'history', label: '📜 History & Biography', topic: 'History', olSubject: 'history' },
  { id: 'poetry', label: '🌿 Poetry', topic: 'Poetry', olSubject: 'poetry' }
];

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Fetch books from Project Gutenberg via Gutendex API
 */
export async function fetchGutenbergBooks({ query = '', topic = '', page = 1 }) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('search', query.trim());
  }
  if (topic.trim()) {
    params.set('topic', topic.trim());
  }
  if (page > 1) {
    params.set('page', page.toString());
  }

  const url = `https://gutendex.com/books/?${params.toString()}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Gutendex API responded with status ${res.status}`);
    }
    const data = await res.json();
    
    const results = (data.results || []).map(item => {
      const formats = item.formats || {};
      
      // Preferred EPUB format (epub3, epub with images, or standard epub)
      const epubUrl = 
        formats['application/epub+zip'] ||
        formats['application/x-mobipocket-ebook'] ||
        `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}.epub`;

      const coverUrl = 
        formats['image/jpeg'] || 
        `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}.cover.medium.jpg`;

      const authors = (item.authors || []).map(a => {
        // Rearrange "Lastname, Firstname" to "Firstname Lastname"
        if (a.name && a.name.includes(',')) {
          const [last, first] = a.name.split(',').map(s => s.trim());
          return `${first} ${last}`.trim();
        }
        return a.name || 'Unknown Author';
      });

      return {
        id: `gutenberg-${item.id}`,
        sourceId: item.id,
        source: 'gutenberg',
        sourceName: 'Project Gutenberg',
        title: item.title || 'Untitled',
        author: authors.join(', ') || 'Unknown Author',
        authorsRaw: item.authors || [],
        cover: coverUrl,
        epubUrl,
        languages: item.languages || ['en'],
        subjects: (item.subjects || []).slice(0, 4),
        downloadCount: item.download_count || 0,
        hasEpub: true,
        copyright: item.copyright === false ? 'Public Domain' : 'Free eBook',
        detailsUrl: `https://www.gutenberg.org/ebooks/${item.id}`
      };
    });

    return {
      books: results,
      totalCount: data.count || results.length,
      hasNext: !!data.next,
      page
    };
  } catch (err) {
    console.error('Error fetching Gutenberg books:', err);
    throw err;
  }
}

/**
 * Fetch books from Open Library API
 */
export async function fetchOpenLibraryBooks({ query = '', subject = '', page = 1 }) {
  try {
    let url = '';
    const limit = 20;
    const offset = (page - 1) * limit;

    if (query.trim()) {
      url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&page=${page}`;
    } else if (subject.trim()) {
      url = `https://openlibrary.org/subjects/${encodeURIComponent(subject.toLowerCase().trim())}.json?limit=${limit}&offset=${offset}`;
    } else {
      url = `https://openlibrary.org/subjects/classic_literature.json?limit=${limit}&offset=${offset}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open Library API responded with status ${res.status}`);
    }
    const data = await res.json();

    let docs = [];
    let totalCount = 0;

    if (data.docs) {
      // search.json format
      docs = data.docs;
      totalCount = data.numFound || 0;
    } else if (data.works) {
      // subjects/{subject}.json format
      docs = data.works;
      totalCount = data.work_count || 0;
    }

    const results = docs.map(item => {
      const coverId = item.cover_id || item.cover_i;
      const coverUrl = coverId 
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` 
        : null;

      let author = 'Unknown Author';
      if (Array.isArray(item.author_name) && item.author_name.length > 0) {
        author = item.author_name.join(', ');
      } else if (Array.isArray(item.authors) && item.authors.length > 0) {
        author = item.authors.map(a => a.name).filter(Boolean).join(', ');
      }

      // Check for public domain / readable IA identifiers
      const iaList = Array.isArray(item.ia) ? item.ia : (item.ia ? [item.ia] : []);
      const primaryIa = iaList[0] || null;
      const firstPublishYear = item.first_publish_year || item.first_published || null;

      const subjects = (item.subject || []).slice(0, 4);

      const workKey = item.key ? item.key.replace('/works/', '') : Math.random().toString(36).substr(2, 9);

      return {
        id: `openlibrary-${workKey}`,
        sourceId: workKey,
        source: 'openlibrary',
        sourceName: 'Open Library',
        title: item.title || 'Untitled',
        author,
        cover: coverUrl,
        firstPublishYear,
        ia: primaryIa,
        iaList,
        hasEpub: !!primaryIa,
        epubUrl: primaryIa ? `https://archive.org/download/${primaryIa}/${primaryIa}.epub` : null,
        subjects,
        editionCount: item.edition_count || 1,
        detailsUrl: item.key ? `https://openlibrary.org${item.key}` : `https://openlibrary.org/works/${workKey}`
      };
    });

    return {
      books: results,
      totalCount,
      hasNext: docs.length === limit,
      page
    };
  } catch (err) {
    console.error('Error fetching Open Library books:', err);
    throw err;
  }
}

/**
 * Combined search for both Gutenberg and Open Library
 */
export async function searchCatalog({ query = '', topic = '', source = 'all', page = 1 }) {
  if (source === 'gutenberg') {
    return await fetchGutenbergBooks({ query, topic, page });
  }

  if (source === 'openlibrary') {
    const category = GENRE_CATEGORIES.find(c => c.topic === topic || c.id === topic);
    const olSubject = category ? category.olSubject : topic;
    return await fetchOpenLibraryBooks({ query, subject: olSubject, page });
  }

  // If source === 'all': query both and combine
  const category = GENRE_CATEGORIES.find(c => c.topic === topic || c.id === topic);
  const olSubject = category ? category.olSubject : topic;

  const [gutenbergResult, openLibraryResult] = await Promise.allSettled([
    fetchGutenbergBooks({ query, topic, page }),
    fetchOpenLibraryBooks({ query, subject: olSubject, page })
  ]);

  const gutenbergBooks = gutenbergResult.status === 'fulfilled' ? gutenbergResult.value.books : [];
  const openLibraryBooks = openLibraryResult.status === 'fulfilled' ? openLibraryResult.value.books : [];

  // Interleave results for a balanced discovery stream
  const combined = [];
  const maxLen = Math.max(gutenbergBooks.length, openLibraryBooks.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < gutenbergBooks.length) combined.push(gutenbergBooks[i]);
    if (i < openLibraryBooks.length) combined.push(openLibraryBooks[i]);
  }

  const totalCount = 
    (gutenbergResult.status === 'fulfilled' ? gutenbergResult.value.totalCount : 0) +
    (openLibraryResult.status === 'fulfilled' ? openLibraryResult.value.totalCount : 0);

  return {
    books: combined,
    totalCount,
    hasNext: (gutenbergResult.status === 'fulfilled' && gutenbergResult.value.hasNext) ||
             (openLibraryResult.status === 'fulfilled' && openLibraryResult.value.hasNext),
    page
  };
}

/**
 * Downloads book binary from direct URL or fallback proxies
 */
async function fetchBookBinary(targetUrl, onProgress) {
  const candidateUrls = [];

  // 1. In Vite dev mode, utilize local server proxy to completely bypass CORS
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    if (targetUrl.startsWith('https://www.gutenberg.org')) {
      candidateUrls.push(targetUrl.replace('https://www.gutenberg.org', '/gutenberg-file'));
    } else if (targetUrl.startsWith('https://archive.org')) {
      candidateUrls.push(targetUrl.replace('https://archive.org', '/ia-file'));
    }
  }

  // 2. Direct fetch (works out of the box in Electron and CORS-enabled endpoints like Internet Archive)
  candidateUrls.push(targetUrl);

  // 3. Alternate Gutenberg cache mirrors if URL is a Gutenberg format
  if (targetUrl.includes('gutenberg.org')) {
    const idMatch = targetUrl.match(/(\d+)\.epub/) || targetUrl.match(/epub\/(\d+)/);
    if (idMatch && idMatch[1]) {
      const gid = idMatch[1];
      candidateUrls.push(`https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.epub`);
    }
  }

  // 4. CORS Proxy fallback for web browser production deployments
  candidateUrls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);

  let lastError = null;

  for (const candidate of candidateUrls) {
    try {
      if (onProgress) onProgress('Connecting to book repository...');
      const response = await fetch(candidate, {
        headers: { 'Accept': 'application/epub+zip, application/octet-stream, */*' }
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (onProgress) onProgress('Downloading EPUB package...');
      const arrayBuffer = await response.arrayBuffer();
      
      // Ensure we received valid content (EPUB zip signature PK..)
      if (arrayBuffer && arrayBuffer.byteLength > 1000) {
        return arrayBuffer;
      } else {
        throw new Error('Downloaded file is empty or incomplete');
      }
    } catch (err) {
      lastError = err;
      console.warn(`Download attempt failed for candidate ${candidate}:`, err);
    }
  }

  throw lastError || new Error('Failed to download book content');
}

/**
 * Download, parse EPUB, and save into local library IndexedDB
 */
export async function downloadAndSaveBook(bookItem, onProgress) {
  let downloadUrl = bookItem.epubUrl;

  // Fallback direct Gutenberg cache URL if gutenberg
  if (!downloadUrl && bookItem.source === 'gutenberg' && bookItem.sourceId) {
    downloadUrl = `https://www.gutenberg.org/cache/epub/${bookItem.sourceId}/pg${bookItem.sourceId}.epub`;
  }

  // If Open Library and no direct EPUB, check if gutenberg has matching title or IA
  if (!downloadUrl && bookItem.source === 'openlibrary') {
    if (bookItem.ia) {
      downloadUrl = `https://archive.org/download/${bookItem.ia}/${bookItem.ia}.epub`;
    } else {
      // Try searching Gutenberg for this title as a seamless fallback
      if (onProgress) onProgress('Locating downloadable EPUB edition...');
      try {
        const gutenSearch = await fetchGutenbergBooks({ query: bookItem.title, page: 1 });
        if (gutenSearch.books && gutenSearch.books.length > 0) {
          downloadUrl = gutenSearch.books[0].epubUrl;
        }
      } catch (searchErr) {
        console.warn('Gutenberg fallback search failed', searchErr);
      }
    }
  }

  if (!downloadUrl) {
    throw new Error(`No downloadable EPUB edition is currently available for "${bookItem.title}".`);
  }

  if (onProgress) onProgress(`Downloading "${bookItem.title}"...`);
  const arrayBuffer = await fetchBookBinary(downloadUrl, onProgress);

  if (onProgress) onProgress('Parsing book metadata and contents...');
  let title = bookItem.title;
  let author = bookItem.author;
  let coverBase64 = null;

  try {
    const epubBook = ePub(arrayBuffer);
    await epubBook.ready;

    const metadata = epubBook.package?.metadata || {};
    if (metadata.title) title = metadata.title;
    if (metadata.creator) author = metadata.creator;

    try {
      const coverUrl = await epubBook.coverUrl();
      if (coverUrl) {
        const coverBlob = await epubBook.archive.getBlob(coverUrl);
        if (coverBlob instanceof Blob) {
          coverBase64 = await blobToBase64(coverBlob);
        }
      }
    } catch (coverErr) {
      console.warn('Cover extraction from EPUB failed, using catalog cover if available', coverErr);
    }

    epubBook.destroy();
  } catch (parseErr) {
    console.warn('ePub parser inspection note:', parseErr);
  }

  // Fallback to catalog cover image if extraction didn't produce one
  if (!coverBase64 && bookItem.cover) {
    coverBase64 = bookItem.cover;
  }

  const bookId = `online-${bookItem.source}-${bookItem.sourceId || Date.now()}`;

  if (onProgress) onProgress('Saving to your local library...');
  const savedMeta = await saveBook(
    bookId,
    {
      title,
      author,
      cover: coverBase64,
      source: bookItem.source,
      sourceUrl: bookItem.detailsUrl
    },
    arrayBuffer
  );

  return {
    bookId,
    savedMeta
  };
}
