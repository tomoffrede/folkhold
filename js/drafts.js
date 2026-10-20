// Unsaved notes kept on this device, so a reload does not lose them.
// A draft is encrypted with your key before it is stored in the browser, and is removed when you save, discard or sign out.

import { getMasterKey } from './auth.js';
import * as vault from './crypto.js';

const PREFIX = 'folkhold-draft:';
const generations = new Map(); // name -> number; a clear makes a slower, older save give up

export async function saveDraft(name, object) {
  const generation = generations.get(name) || 0;
  try {
    const key = getMasterKey();
    if (!key) return;
    const text = await vault.encryptItem(key, 'draft', name, object);
    if ((generations.get(name) || 0) === generation) localStorage.setItem(PREFIX + name, text);
  } catch {
    // A draft is a convenience; failing to keep one must never get in the way.
  }
}

export async function loadDraft(name) {
  try {
    const text = localStorage.getItem(PREFIX + name);
    if (!text) return null;
    return await vault.decryptItem(getMasterKey(), 'draft', name, text);
  } catch {
    return null;
  }
}

export function clearDraft(name) {
  generations.set(name, (generations.get(name) || 0) + 1);
  try {
    localStorage.removeItem(PREFIX + name);
  } catch {
    // ignore
  }
}

export function clearAllDrafts() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
