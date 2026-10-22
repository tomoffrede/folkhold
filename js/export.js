// Download of all your data as one readable file (JSON). Nothing is sent anywhere: the file is made in your browser.

import * as store from './store.js';
import { getUsername } from './auth.js';

export function buildExport() {
  return {
    app: 'Folkhold',
    note: 'Your data, decrypted in your browser. Contacts link to tags, notes and events by id (contactIds, tagIds).',
    exportedAt: new Date().toISOString(),
    username: getUsername(),
    contacts: store.list('contact'),
    notes: store.list('note'),
    events: store.list('event'),
    tags: store.list('tag'),
    settings: store.list('settings')[0] || {},
  };
}

export function downloadExport() {
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `folkhold-data-${day}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
