const DB_NAME = 'voxelpop-paid-creation-v1';
const DB_VERSION = 1;
const STORE_NAME = 'source-photos';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function clean(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('This browser cannot safely keep your photo on-device through checkout. Use normal Safari or Chrome browsing.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'draftId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('On-device VoxelPop checkout storage could not open.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('On-device VoxelPop checkout storage failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('On-device VoxelPop checkout storage was interrupted.'));
  });
}

export async function savePaidPropertyPhoto(draftIdRaw, file) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || !(file instanceof Blob)) throw new Error('Choose a property photo first.');
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      draftId,
      blob: file,
      name: clean(file.name || 'property-photo', 120) || 'property-photo',
      type: clean(file.type, 80),
      lastModified: Number(file.lastModified || Date.now()),
      savedAt: Date.now(),
    });
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function loadPaidPropertyPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId) return null;
  const db = await openDb();
  try {
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(draftId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Your on-device VoxelPop photo could not be restored.'));
    });
    if (!record?.blob) return null;
    if (Date.now() - Number(record.savedAt || 0) > MAX_AGE_MS) {
      await deletePaidPropertyPhoto(draftId).catch(() => {});
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

export async function deletePaidPropertyPhoto(draftIdRaw) {
  const draftId = clean(draftIdRaw, 100);
  if (!draftId || typeof window === 'undefined' || !window.indexedDB) return false;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(draftId);
    await transactionDone(tx);
    return true;
  } finally {
    db.close();
  }
}
