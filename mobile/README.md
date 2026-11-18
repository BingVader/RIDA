# RIDA Mobile

React Native (Expo + Expo Router + TypeScript) companion to the RIDA desktop EPUB reader.

## Features

- **My Books**: local library with search, status filters (unread / reading / finished), progress, import `.epub` from the device, long-press to delete.
- **Browse**: free books from Project Gutenberg and Open Library, with genre categories, search, infinite scroll, "Read Now" and "Add to library".
- **Reader**: paginated EPUB rendering (epub.js in a WebView via `@epubjs-react-native/core`), table of contents, in-book search, bookmarks, colored highlights with notes, five page themes, font / size / line-height settings, progress slider, and saved reading position.
- Light / dark app theme (follows the system, toggle in the library header).

Everything is stored on-device: EPUB files in the app's document directory, metadata / progress / annotations in AsyncStorage.

## Run

```bash
cd mobile
npm install
npx expo start          # scan the QR code with Expo Go, or press a / i
```

Type-check with `npm run typecheck`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router routes: `(tabs)/index` (library), `(tabs)/browse`, `reader/[id]` |
| `src/lib/storage.ts` | Library persistence (files + metadata) |
| `src/lib/catalog.ts` | Gutenberg / Open Library search and download (port of the desktop `catalogService.js`) |
| `src/lib/theme.tsx` | App palette and reader page themes |
| `src/components/` | Book cover, reader settings sheet, reader contents/search/bookmarks/highlights panel |

## Differences from desktop

- No "connect local folder" or drag-and-drop; use the import button instead.
- Single-page layout only (no two-page spread on phones).
- No bundled sample book.
