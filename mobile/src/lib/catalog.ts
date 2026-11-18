import { File } from 'expo-file-system';
import { addBook, bookFile, coverFile, ensureBooksDir } from './storage';
import type { BookMeta, CatalogBook, CatalogResult, CatalogSource } from './types';

export interface GenreCategory {
  id: string;
  label: string;
  topic: string;
  olSubject: string;
}

export const GENRE_CATEGORIES: GenreCategory[] = [
  { id: 'all', label: '🔥 Featured & Popular', topic: '', olSubject: '' },
  { id: 'fiction', label: '📖 Fiction', topic: 'Fiction', olSubject: 'fiction' },
  { id: 'classics', label: '🏛️ Classics', topic: 'Classic Literature', olSubject: 'classic_literature' },
  { id: 'scifi', label: '🚀 Sci-Fi', topic: 'Science Fiction', olSubject: 'science_fiction' },
  { id: 'fantasy', label: '🧙 Fantasy', topic: 'Fantasy', olSubject: 'fantasy' },
  { id: 'mystery', label: '🔍 Mystery', topic: 'Detective and mystery stories', olSubject: 'mystery_and_detective_stories' },
  { id: 'philosophy', label: '💭 Philosophy', topic: 'Philosophy', olSubject: 'philosophy' },
  { id: 'adventure', label: '⚔️ Adventure', topic: 'Adventure stories', olSubject: 'adventure' },
  { id: 'romance', label: '❤️ Romance', topic: 'Love stories', olSubject: 'romance' },
  { id: 'horror', label: '👻 Horror & Gothic', topic: 'Gothic fiction', olSubject: 'horror' },
  { id: 'history', label: '📜 History', topic: 'History', olSubject: 'history' },
  { id: 'poetry', label: '🌿 Poetry', topic: 'Poetry', olSubject: 'poetry' },
];

interface GutendexItem {
  id: number;
  title?: string;
  authors?: { name?: string }[];
  formats?: Record<string, string>;
  languages?: string[];
  subjects?: string[];
  download_count?: number;
  copyright?: boolean | null;
}

async function fetchGutenbergBooks(opts: {
  query?: string;
  topic?: string;
  page?: number;
}): Promise<CatalogResult> {
  const { query = '', topic = '', page = 1 } = opts;
  const params = new URLSearchParams();
  if (query.trim()) params.set('search', query.trim());
  if (topic.trim()) params.set('topic', topic.trim());
  if (page > 1) params.set('page', String(page));

  const res = await fetch(`https://gutendex.com/books/?${params.toString()}`);
  if (!res.ok) throw new Error(`Gutendex API responded with status ${res.status}`);
  const data = (await res.json()) as { results?: GutendexItem[]; count?: number; next?: string | null };

  const books: CatalogBook[] = (data.results ?? []).map((item) => {
    const formats = item.formats ?? {};
    const epubUrl =
      formats['application/epub+zip'] ?? `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}.epub`;
    const cover =
      formats['image/jpeg'] ?? `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}.cover.medium.jpg`;

    const authors = (item.authors ?? []).map((a) => {
      if (a.name?.includes(',')) {
        const [last, first] = a.name.split(',').map((s) => s.trim());
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
      cover,
      epubUrl,
      languages: item.languages ?? ['en'],
      subjects: (item.subjects ?? []).slice(0, 4),
      downloadCount: item.download_count ?? 0,
      copyright: item.copyright === false ? 'Public Domain' : 'Free eBook',
      detailsUrl: `https://www.gutenberg.org/ebooks/${item.id}`,
    };
  });

  return { books, totalCount: data.count ?? books.length, hasNext: !!data.next, page };
}

interface OpenLibraryItem {
  key?: string;
  title?: string;
  cover_id?: number;
  cover_i?: number;
  author_name?: string[];
  authors?: { name?: string }[];
  ia?: string | string[];
  first_publish_year?: number;
  first_published?: number;
  subject?: string[];
  edition_count?: number;
}

async function fetchOpenLibraryBooks(opts: {
  query?: string;
  subject?: string;
  page?: number;
}): Promise<CatalogResult> {
  const { query = '', subject = '', page = 1 } = opts;
  const limit = 20;
  const offset = (page - 1) * limit;

  let url: string;
  if (query.trim()) {
    url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&limit=${limit}&page=${page}`;
  } else {
    const subj = subject.trim() || 'classic_literature';
    url = `https://openlibrary.org/subjects/${encodeURIComponent(subj.toLowerCase())}.json?limit=${limit}&offset=${offset}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library API responded with status ${res.status}`);
  const data = (await res.json()) as {
    docs?: OpenLibraryItem[];
    works?: OpenLibraryItem[];
    numFound?: number;
    work_count?: number;
  };

  const docs = data.docs ?? data.works ?? [];
  const totalCount = data.docs ? data.numFound ?? 0 : data.work_count ?? 0;

  const books: CatalogBook[] = docs.map((item, idx) => {
    const coverId = item.cover_id ?? item.cover_i;
    const author =
      item.author_name?.join(', ') ||
      item.authors?.map((a) => a.name).filter(Boolean).join(', ') ||
      'Unknown Author';
    const iaList = Array.isArray(item.ia) ? item.ia : item.ia ? [item.ia] : [];
    const ia = iaList[0] ?? null;
    const workKey = item.key ? item.key.replace('/works/', '') : `unknown-${page}-${idx}`;

    return {
      id: `openlibrary-${workKey}`,
      sourceId: workKey,
      source: 'openlibrary',
      sourceName: 'Open Library',
      title: item.title || 'Untitled',
      author,
      cover: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
      firstPublishYear: item.first_publish_year ?? item.first_published ?? null,
      ia,
      epubUrl: ia ? `https://archive.org/download/${ia}/${ia}.epub` : null,
      subjects: (item.subject ?? []).slice(0, 4),
      detailsUrl: item.key ? `https://openlibrary.org${item.key}` : `https://openlibrary.org/works/${workKey}`,
    };
  });

  return { books, totalCount, hasNext: docs.length === limit, page };
}

export async function searchCatalog(opts: {
  query?: string;
  topic?: string;
  source?: CatalogSource;
  page?: number;
}): Promise<CatalogResult> {
  const { query = '', topic = '', source = 'all', page = 1 } = opts;
  const category = GENRE_CATEGORIES.find((c) => c.topic === topic || c.id === topic);
  const olSubject = category ? category.olSubject : topic;

  if (source === 'gutenberg') return fetchGutenbergBooks({ query, topic, page });
  if (source === 'openlibrary') return fetchOpenLibraryBooks({ query, subject: olSubject, page });

  const [g, o] = await Promise.allSettled([
    fetchGutenbergBooks({ query, topic, page }),
    fetchOpenLibraryBooks({ query, subject: olSubject, page }),
  ]);
  if (g.status === 'rejected' && o.status === 'rejected') throw g.reason;

  const gb = g.status === 'fulfilled' ? g.value.books : [];
  const ob = o.status === 'fulfilled' ? o.value.books : [];

  // Interleave for a balanced discovery stream
  const books: CatalogBook[] = [];
  for (let i = 0; i < Math.max(gb.length, ob.length); i++) {
    if (i < gb.length) books.push(gb[i]);
    if (i < ob.length) books.push(ob[i]);
  }

  return {
    books,
    totalCount:
      (g.status === 'fulfilled' ? g.value.totalCount : 0) + (o.status === 'fulfilled' ? o.value.totalCount : 0),
    hasNext: (g.status === 'fulfilled' && g.value.hasNext) || (o.status === 'fulfilled' && o.value.hasNext),
    page,
  };
}

/** Library id a catalog book is stored under. */
export const libraryIdFor = (b: CatalogBook) => `online-${b.source}-${b.sourceId}`;

/** Try each candidate URL until one yields a plausible EPUB. */
async function downloadEpub(candidates: string[], dest: File): Promise<void> {
  let lastError: unknown = null;
  for (const url of candidates) {
    try {
      if (dest.exists) dest.delete();
      await File.downloadFileAsync(url, dest);
      // A valid EPUB is a zip; anything tiny is an error page.
      if (dest.exists && (dest.size ?? 0) > 1000) return;
      throw new Error('Downloaded file is empty or incomplete');
    } catch (err) {
      lastError = err;
      try {
        if (dest.exists) dest.delete();
      } catch {
        // ignore
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to download book content');
}

/** Download a catalog book into app storage and add it to the library. */
export async function downloadAndSaveBook(
  item: CatalogBook,
  onProgress?: (status: string) => void,
): Promise<BookMeta> {
  let url = item.epubUrl;

  if (!url && item.source === 'openlibrary') {
    // No Internet Archive scan: try finding the same title on Gutenberg.
    onProgress?.('Locating downloadable EPUB edition...');
    try {
      const found = await fetchGutenbergBooks({ query: item.title, page: 1 });
      url = found.books[0]?.epubUrl ?? null;
    } catch {
      // fall through to the error below
    }
  }
  if (!url) {
    throw new Error(`No downloadable EPUB edition is currently available for "${item.title}".`);
  }

  const candidates = [url];
  if (url.includes('gutenberg.org')) {
    const m = url.match(/(\d+)\.epub/) ?? url.match(/epub\/(\d+)/);
    if (m?.[1]) candidates.push(`https://www.gutenberg.org/cache/epub/${m[1]}/pg${m[1]}.epub`);
  }

  const id = libraryIdFor(item);
  ensureBooksDir();

  onProgress?.(`Downloading "${item.title}"...`);
  await downloadEpub([...new Set(candidates)], bookFile(id));

  // Keep the cover offline; fall back to the remote URL if this fails.
  let cover = item.cover;
  if (item.cover) {
    try {
      const cf = coverFile(id);
      if (cf.exists) cf.delete();
      await File.downloadFileAsync(item.cover, cf);
      if (cf.exists && (cf.size ?? 0) > 100) cover = cf.uri;
    } catch {
      // keep remote URL
    }
  }

  onProgress?.('Saving to your library...');
  return addBook(id, {
    title: item.title,
    author: item.author,
    cover,
    source: item.source,
    sourceUrl: item.detailsUrl,
  });
}
