import localforage from 'localforage';
import ePub from 'epubjs';

const bookStore = localforage.createInstance({
  name: 'RIDA',
  storeName: 'books_data'
});

const metadataStore = localforage.createInstance({
  name: 'RIDA',
  storeName: 'books_metadata'
});

const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export async function verifyDirectoryPermission(handle, readWrite = false) {
  if (!handle) return false;
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
}

export async function saveDirectoryHandle(handle) {
  await metadataStore.setItem('_dir_handle', handle);
}

export async function getDirectoryHandle() {
  return await metadataStore.getItem('_dir_handle');
}

export async function disconnectDirectory() {
  await metadataStore.removeItem('_dir_handle');
}

export async function scanLocalDirectory(dirHandle, onProgress) {
  if (!dirHandle) return;
  
  const existingBooks = {};
  await metadataStore.iterate((value, key) => {
    if (key !== '_dir_handle') {
      existingBooks[key] = value;
    }
  });

  const scannedIds = new Set();

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.epub')) {
      const fileName = entry.name;
      const fileId = `local-${fileName}`;
      scannedIds.add(fileId);

      if (existingBooks[fileId]) {
        continue;
      }

      if (onProgress) {
        onProgress(`Indexing "${fileName}"...`);
      }

      try {
        const file = await entry.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const book = ePub(arrayBuffer);
        await book.ready;

        const metadata = book.package.metadata;
        const title = metadata.title || fileName.replace('.epub', '');
        const author = metadata.creator || 'Unknown Author';

        let coverBase64 = null;
        try {
          const coverUrl = await book.coverUrl();
          if (coverUrl) {
            const coverBlob = await book.archive.getBlob(coverUrl);
            if (coverBlob instanceof Blob) {
              coverBase64 = await blobToBase64(coverBlob);
            }
          }
        } catch (coverErr) {
          console.warn(`Cover extraction failed for ${fileName}`, coverErr);
        }

        const bookMeta = {
          id: fileId,
          title,
          author,
          cover: coverBase64,
          progress: 0,
          lastRead: Date.now(),
          addedAt: Date.now(),
          location: null,
          bookmarks: [],
          highlights: [],
          storageType: 'local',
          fileName: fileName
        };

        await metadataStore.setItem(fileId, bookMeta);
        book.destroy();
      } catch (err) {
        console.error(`Failed to scan file ${fileName}`, err);
      }
    }
  }

  for (const id in existingBooks) {
    if (existingBooks[id].storageType === 'local' && !scannedIds.has(id)) {
      await metadataStore.removeItem(id);
    }
  }
}

export async function saveBook(id, meta, arrayBuffer) {
  const metadata = {
    id,
    title: meta.title || 'Unknown Title',
    author: meta.author || 'Unknown Author',
    cover: meta.cover || null,
    progress: 0,
    lastRead: Date.now(),
    addedAt: Date.now(),
    location: null,
    bookmarks: [],
    highlights: [],
    storageType: 'db'
  };

  await metadataStore.setItem(id, metadata);
  await bookStore.setItem(id, arrayBuffer);
  return metadata;
}

export async function getBooksList() {
  const books = [];
  await metadataStore.iterate((value, key) => {
    if (key !== '_dir_handle') {
      books.push(value);
    }
  });
  return books.sort((a, b) => b.lastRead - a.lastRead);
}

export async function getBookMetadata(id) {
  return await metadataStore.getItem(id);
}

export async function getBookBinary(id) {
  const meta = await metadataStore.getItem(id);
  if (meta && meta.storageType === 'local') {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) {
      throw new Error('Local folder is not connected.');
    }
    const options = {};
    if ((await dirHandle.queryPermission(options)) !== 'granted') {
      throw new Error('Access to the local folder is not authorized.');
    }
    const fileHandle = await dirHandle.getFileHandle(meta.fileName);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  }
  return await bookStore.getItem(id);
}

export async function updateReadingProgress(id, progress, locationCfi) {
  const meta = await metadataStore.getItem(id);
  if (meta) {
    meta.progress = progress;
    meta.location = locationCfi;
    meta.lastRead = Date.now();
    await metadataStore.setItem(id, meta);
  }
}

export async function updateAnnotations(id, bookmarks, highlights) {
  const meta = await metadataStore.getItem(id);
  if (meta) {
    meta.bookmarks = bookmarks;
    meta.highlights = highlights;
    await metadataStore.setItem(id, meta);
  }
}

export async function deleteBook(id) {
  const meta = await metadataStore.getItem(id);
  if (meta && meta.storageType === 'local') {
    await metadataStore.removeItem(id);
  } else {
    await metadataStore.removeItem(id);
    await bookStore.removeItem(id);
  }
}

export async function clearAllDb() {
  await metadataStore.clear();
  await bookStore.clear();
}
