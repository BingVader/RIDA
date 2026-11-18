import type { Annotation, Bookmark } from '@epubjs-react-native/core';

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  /** file:// or https:// URI of the cover image, if known */
  cover: string | null;
  /** 0-100 */
  progress: number;
  startedReading: boolean;
  lastRead: number;
  addedAt: number;
  /** epub CFI of the last reading position */
  location: string | null;
  bookmarks: Bookmark[];
  highlights: Annotation[];
  source: 'upload' | 'gutenberg' | 'openlibrary';
  sourceUrl: string | null;
  /** true until title/author were read from the EPUB itself */
  needsMetadata: boolean;
}

export type CatalogSource = 'all' | 'gutenberg' | 'openlibrary';

export interface CatalogBook {
  id: string;
  sourceId: string | number;
  source: 'gutenberg' | 'openlibrary';
  sourceName: string;
  title: string;
  author: string;
  cover: string | null;
  epubUrl: string | null;
  languages?: string[];
  subjects: string[];
  downloadCount?: number;
  firstPublishYear?: number | null;
  ia?: string | null;
  copyright?: string;
  detailsUrl: string;
}

export interface CatalogResult {
  books: CatalogBook[];
  totalCount: number;
  hasNext: boolean;
  page: number;
}
