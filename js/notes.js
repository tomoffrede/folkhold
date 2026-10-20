// Notes. One note is one item and can be linked to several contacts (its "contactIds").
// A note looks like: { title?, body, priority?, contactIds: [...], createdAt, updatedAt? }. See richtext.js for "body".
// "priority" is 1 (Important), 2 (Medium) or 3 (Low); a note without one comes after those.
// The order inside one priority is kept per contact, as a list of note ids ("noteOrder") on the contact.

import * as store from './store.js';
import * as linked from './linked.js';

const NO_PRIORITY = 4;

// All notes of one contact in display order: by priority, then the contact's own order, new notes first.
export function listFor(contactId) {
  const order = (store.get('contact', contactId) || {}).noteOrder || [];
  const place = (note) => {
    const index = order.indexOf(note.id);
    return index === -1 ? -1 : index; // a note not in the list yet is new, so it goes first
  };
  return store
    .list('note')
    .filter((note) => (note.contactIds || []).includes(contactId))
    .sort(
      (a, b) =>
        (a.priority || NO_PRIORITY) - (b.priority || NO_PRIORITY) ||
        place(a) - place(b) ||
        (b.createdAt || 0) - (a.createdAt || 0),
    );
}

// Moves a note one step up (-1) or down (+1) among the notes of the same priority, and remembers the new order.
export async function move(contactId, noteId, step) {
  const list = listFor(contactId);
  const index = list.findIndex((note) => note.id === noteId);
  const other = list[index + step];
  if (index === -1 || !other || (other.priority || NO_PRIORITY) !== (list[index].priority || NO_PRIORITY)) return;
  [list[index], list[index + step]] = [other, list[index]];
  const contact = store.get('contact', contactId);
  if (!contact) return;
  const { id, ...fields } = contact;
  await store.update('contact', contactId, { ...fields, noteOrder: list.map((note) => note.id) });
}

export function get(id) {
  return store.get('note', id);
}

// Saves a new note for one or more contacts.
export function create({ title, body, contactIds, priority }) {
  return linked.create('note', { title, body, priority }, contactIds);
}

// Saves a changed note that was opened from the contact "originId" (see linked.js).
export function saveEdit(note, { title, body, priority }, originId, appliedIds) {
  return linked.saveEdit('note', note, ['title', 'body', 'priority'], { title, body, priority }, originId, appliedIds);
}

export function removeFromContacts(note, contactIds) {
  return linked.removeFromContacts('note', note, contactIds);
}

export function removeEverywhere(note) {
  return store.remove('note', note.id);
}

export function detachContact(contactId) {
  return linked.detachContact('note', contactId);
}
