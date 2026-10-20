// Notes. One note is one item and can be linked to several contacts (its "contactIds").
// A note looks like: { title?, body, priority?, contactIds: [...], createdAt, updatedAt? }. See richtext.js for "body".
// "priority" is 1 (Important), 2 (Medium) or 3 (Low); a note without one comes after those.
// The order inside one priority is kept per contact, as a list of note ids ("noteOrder") on the contact.

import * as store from './store.js';

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

function fieldsOf(note) {
  const { id, ...fields } = note;
  return fields;
}

// Saves a new note for one or more contacts.
export function create({ title, body, contactIds, priority }) {
  const fields = { body, contactIds, createdAt: Date.now() };
  if (title) fields.title = title;
  if (priority) fields.priority = priority;
  return store.add('note', fields);
}

// Saves a changed note that was opened from the contact "originId".
// "appliedIds": the other contacts that should get the change too. The rest keep a copy of the old note.
export async function saveEdit(note, { title, body, priority }, originId, appliedIds) {
  const others = (note.contactIds || []).filter((id) => id !== originId);
  const left = others.filter((id) => !appliedIds.includes(id));

  // The copy is made first, so nothing can be lost if the second step fails.
  if (left.length) await store.add('note', { ...fieldsOf(note), contactIds: left });

  const fields = {
    ...fieldsOf(note),
    body,
    contactIds: [originId, ...others.filter((id) => appliedIds.includes(id))],
    updatedAt: Date.now(),
  };
  if (title) fields.title = title;
  else delete fields.title;
  if (priority) fields.priority = priority;
  else delete fields.priority;
  await store.update('note', note.id, fields);
}

// Takes some contacts off a note. If nobody is left, the note is deleted.
export async function removeFromContacts(note, contactIds) {
  const rest = (note.contactIds || []).filter((id) => !contactIds.includes(id));
  if (rest.length === 0) await store.remove('note', note.id);
  else await store.update('note', note.id, { ...fieldsOf(note), contactIds: rest });
}

export function removeFromContact(note, contactId) {
  return removeFromContacts(note, [contactId]);
}

export function removeEverywhere(note) {
  return store.remove('note', note.id);
}

// Used when a contact is deleted: their notes lose them, and notes that belonged only to them are deleted.
export async function detachContact(contactId) {
  for (const note of listFor(contactId)) await removeFromContact(note, contactId);
}
