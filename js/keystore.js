// Remembers the unlocked master key on this device, so reloading the page does not ask for the password.
// The saved copy is "non-extractable": the page can use it to encrypt and decrypt, but cannot read it out.

const DB_NAME = 'folkhold';
const STORE = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveKey(userId, masterKey) {
  const raw = await crypto.subtle.exportKey('raw', masterKey);
  const locked = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  await withStore('readwrite', (store) => store.put(locked, userId));
}

export async function loadKey(userId) {
  const key = await withStore('readonly', (store) => store.get(userId));
  return key ?? null;
}

export async function clearKeys() {
  await withStore('readwrite', (store) => store.clear());
}
