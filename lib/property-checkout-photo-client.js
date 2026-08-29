'use client';

const DB_NAME = 'voxelpop-property-checkout';
const DB_VERSION = 1;
const STORE_NAME = 'source-photos';

function clean(value, max = 120) {
  return String(value || '').trim().slice(0, max);
}

function openPhotoDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Secure on-device photo storage is unavailable in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Secure on-device photo storage could not be opened.'));
  });
}

function runStore(mode, operation) {
  return openPhotoDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Secure on-device photo storage failed.'));
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Secure on-device photo storage was interrupted.'));
    };
  }));
}

export async function savePropertyCheckoutPhoto(draftIdRaw, file) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || !(file instanceof File)) throw new Error('Choose the property photo again before checkout.');
  const blob = file.slice(0, file.size, file.type || 'application/octet-stream');
  await runStore('readwrite', (store) => store.put({
    draftId,
    blob,
    name: clean(file.name, 120) || 'property-photo',
    type: clean(file.type, 80) || 'application/octet-stream',
    lastModified: Number(file.lastModified || Date.now()),
    savedAt: Date.now(),
  }));
  return draftId;
}

export async function readPropertyCheckoutPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId) return null;
  const record = await runStore('readonly', (store) => store.get(draftId));
  if (!record?.blob) return null;
  return new File([record.blob], record.name || 'property-photo', {
    type: record.type || record.blob.type || 'application/octet-stream',
    lastModified: Number(record.lastModified || Date.now()),
  });
}

export async function removePropertyCheckoutPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || typeof indexedDB === 'undefined') return false;
  try {
    await runStore('readwrite', (store) => store.delete(draftId));
    return true;
  } catch {
    return false;
  }
}
