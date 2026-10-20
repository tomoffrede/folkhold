// Notes. One note is one item and can be linked to several contacts (its "contactIds").
// A note looks like: { title?, body, contactIds: [...], createdAt, updatedAt? }. See richtext.js for "body".

import * as store from './store.js';

// All notes of one contact, newest first.
export function listFor(contactId) {
  return store
    .list('note')
    .filter((note) => (note.contactIds || []).includes(contactId))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function get(id) {
  return store.get('note', id);
}

function fieldsOf(note) {
  const { id, ...fields } = note;
  return fields;
}

// Saves a new note for one or more contacts.
export function create({ title, body, contactIds }) {
  const fields = { body, contactIds, createdAt: Date.now() };
  if (title) fields.title = title;
  return store.add('note', fields);
}

// Saves a changed note that was opened from the contact "originId".
// "appliedIds": the other contacts that should get the change too. The rest keep a copy of the old note.
export async function saveEdit(note, { title, body }, originId, appliedIds) {
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
  await store.update('note', note.id, fields);
}

// Takes one contact off a note. If nobody is left, the note is deleted.
export async function removeFromContact(note, contactId) {
  const rest = (note.contactIds || []).filter((id) => id !== contactId);
  if (rest.length === 0) await store.remove('note', note.id);
  else await store.update('note', note.id, { ...fieldsOf(note), contactIds: rest });
}

export function removeEverywhere(note) {
  return store.remove('note', note.id);
}

// Used when a contact is deleted: their notes lose them, and notes that belonged only to them are deleted.
export async function detachContact(contactId) {
  for (const note of listFor(contactId)) await removeFromContact(note, contactId);
}
