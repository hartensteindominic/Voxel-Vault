const DB_NAME = 'voxelpop-property-checkout-v1';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function clean(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function requireIndexedDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('This browser cannot safely retain the photo through checkout. Try again in Safari or Chrome with normal browsing enabled.');
  }
  return window.indexedDB;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const indexedDb = requireIndexedDb();
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Private on-device checkout storage could not open.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Private on-device checkout storage failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Private on-device checkout storage was interrupted.'));
  });
}

export async function savePropertyCheckoutPhoto(draftIdRaw, file) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || !(file instanceof Blob)) throw new Error('The checkout photo could not be retained on this device.');
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      draftId,
      blob: file,
      name: clean(file.name || 'property-photo', 120) || 'property-photo',
      type: clean(file.type, 80),
      lastModified: Number(file.lastModified || Date.now()),
      savedAt: Date.now(),
    });
    await transactionDone(transaction);
  } finally {
    db.close();
  }
  return draftId;
}

export async function loadPropertyCheckoutPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId) return null;
  const db = await openDb();
  try {
    const record = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(draftId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Private on-device checkout photo could not be read.'));
    });
    if (!record?.blob) return null;
    if (Date.now() - Number(record.savedAt || 0) > MAX_AGE_MS) {
      await deletePropertyCheckoutPhoto(draftId).catch(() => {});
      return null;
    }
    return new File([record.blob], record.name || 'property-photo', {
      type: record.type || record.blob.type || 'image/jpeg',
      lastModified: Number(record.lastModified || Date.now()),
    });
  } finally {
    db.close();
  }
}

export async function deletePropertyCheckoutPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || typeof window === 'undefined' || !window.indexedDB) return false;
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(draftId);
    await transactionDone(transaction);
    return true;
  } finally {
    db.close();
  }
}
