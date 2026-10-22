// Tags: your own labels for contacts ("work friend", "likes puzzles"). A tag is { name }; a contact lists its tags as "tagIds".

import * as store from './store.js';
import { strings } from './strings.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function clean(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

export function list() {
  return store.list('tag').sort((a, b) => collator.compare(a.name, b.name));
}

export function get(id) {
  return store.get('tag', id);
}

export function findByName(name) {
  const wanted = clean(name).toLowerCase();
  return list().find((tag) => tag.name.toLowerCase() === wanted) || null;
}

// Returns the id of the tag with this name, making the tag first when there is none yet.
export async function create(name) {
  const existing = findByName(name);
  if (existing) return existing.id;
  return store.add('tag', { name: clean(name) });
}

// The tags that at least one contact has, sorted by name.
export function inUse() {
  const used = new Set();
  store.list('contact').forEach((contact) => (contact.tagIds || []).forEach((id) => used.add(id)));
  return list().filter((tag) => used.has(tag.id));
}

// How many contacts have this tag.
export function count(id) {
  return store.list('contact').filter((contact) => (contact.tagIds || []).includes(id)).length;
}

// Renames a tag. A name that another tag already has is refused (changing only the capitals of its own name is fine).
export async function rename(id, name) {
  const next = clean(name);
  if (!next) throw new Error(strings['tags.errEmpty']);
  const other = findByName(next);
  if (other && other.id !== id) throw new Error(strings['tags.errExists']);
  await store.update('tag', id, { name: next });
}

// Deletes a tag and takes it off every contact that has it. The tag goes last, so a failure part-way loses nothing.
export async function remove(id) {
  for (const contact of store.list('contact')) {
    if (!(contact.tagIds || []).includes(id)) continue;
    const { id: contactId, ...fields } = contact;
    const rest = fields.tagIds.filter((tagId) => tagId !== id);
    if (rest.length) fields.tagIds = rest;
    else delete fields.tagIds;
    await store.update('contact', contactId, fields);
  }
  await store.remove('tag', id);
}
