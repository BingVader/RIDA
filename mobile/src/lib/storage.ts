import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Annotation, Bookmark } from '@epubjs-react-native/core';
import { Directory, File, Paths } from 'expo-file-system';
import type { BookMeta } from './types';

const META_KEY = 'rida:books:v1';

const booksDir = new Directory(Paths.document, 'books');

export function ensureBooksDir() {
  booksDir.create({ intermediates: true, idempotent: true });
}

const safeName = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');

export const bookFile = (id: string) => new File(booksDir, `${safeName(id)}.epub`);
export const coverFile = (id: string) => new File(booksDir, `${safeName(id)}.cover`);

/**
 * All metadata lives in a single JSON blob. We keep it in memory and serialise
 * writes through a promise chain so frequent progress updates cannot race.
 */
let cache: Record<string, BookMeta> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<Record<string, BookMeta>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, BookMeta>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(): Promise<void> {
  const snapshot = JSON.stringify(cache ?? {});
  writeChain = writeChain.then(() => AsyncStorage.setItem(META_KEY, snapshot)).catch(() => {});
  return writeChain;
}

export async function listBooks(): Promise<BookMeta[]> {
  const all = await load();
  return Object.values(all).sort((a, b) => b.lastRead - a.lastRead);
}

export async function getBook(id: string): Promise<BookMeta | null> {
  return (await load())[id] ?? null;
}

export async function updateBook(id: string, patch: Partial<BookMeta>): Promise<void> {
  const all = await load();
  const current = all[id];
  if (!current) return;
  all[id] = { ...current, ...patch };
  await persist();
}

/**
 * Register a book in the library. The EPUB must already be inside the app's
 * books directory at `bookFile(id)`; use `importEpub` to copy in an external file.
 */
export async function addBook(
  id: string,
  input: Partial<BookMeta> & { title: string },
): Promise<BookMeta> {
  const now = Date.now();
  const meta: BookMeta = {
    id,
    author: 'Unknown Author',
    cover: null,
    progress: 0,
    startedReading: false,
    lastRead: now,
    addedAt: now,
    location: null,
    bookmarks: [],
    highlights: [],
    source: 'upload',
    sourceUrl: null,
    needsMetadata: false,
    ...input,
  };
  const all = await load();
  all[id] = meta;
  await persist();
  return meta;
}

/** Copy an EPUB the user picked into app storage and add it to the library. */
export async function importEpub(id: string, picked: File, title: string): Promise<BookMeta> {
  ensureBooksDir();
  const dest = bookFile(id);
  if (dest.exists) dest.delete();
  picked.copy(dest);
  return addBook(id, { title, needsMetadata: true });
}

export const markStarted = (id: string) =>
  updateBook(id, { startedReading: true, lastRead: Date.now() });

export const saveProgress = (id: string, progress: number, location: string) =>
  updateBook(id, { progress, location, startedReading: true, lastRead: Date.now() });

export const saveBookmarks = (id: string, bookmarks: Bookmark[]) => updateBook(id, { bookmarks });

export const saveHighlights = (id: string, highlights: Annotation[]) =>
  updateBook(id, { highlights });

export async function deleteBook(id: string): Promise<void> {
  const all = await load();
  delete all[id];
  await persist();
  for (const f of [bookFile(id), coverFile(id)]) {
    try {
      if (f.exists) f.delete();
    } catch {
      // best effort
    }
  }
}
