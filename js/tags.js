// Tags: your own labels for contacts ("work friend", "likes puzzles"). A tag is { name }; a contact lists its tags as "tagIds".

import * as store from './store.js';

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
