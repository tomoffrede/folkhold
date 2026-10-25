// Search across contacts, notes and events. Ignores capitals and accents; every word typed must appear somewhere in the item.

import * as store from './store.js';
import * as tags from './tags.js';

const SKIP = new Set(['id', 'tagIds', 'noteOrder', 'contactIds', 'priority', 'repeat', 'kind', 'src', 'createdAt', 'updatedAt', 'contactId']);

export const fold = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Every piece of text inside an item, joined (note bodies are lines of [text, style] pieces).
function textOf(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((part) => textOf(part, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, part]) => !SKIP.has(key) && textOf(part, out));
  return out;
}

function words(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

// A short piece of text around the first match, for showing why a note or event was found.
function snippet(text, list) {
  const flat = text.replace(/\s+/g, ' ');
  const at = list.map((word) => fold(flat).indexOf(word)).filter((i) => i >= 0).sort((a, b) => a - b)[0] || 0;
  const start = Math.max(0, at - 30);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 90)}${start + 90 < flat.length ? '…' : ''}`;
}

// The names of the contacts a note or event belongs to, so "Max" also finds his notes and events.
const linkedNames = (item) =>
  (item.contactIds || [])
    .map((id) => store.get('contact', id))
    .filter(Boolean)
    .map((c) => [c.firstName, c.lastName, c.nickname].filter(Boolean).join(' '))
    .join(' ');

// Returns { contacts, notes: [{ item, snippet }], events: [{ item, snippet }] } for a typed query ({} when it is empty).
export function search(query) {
  const list = words(query);
  if (!list.length) return null;
  const find = (items, extra = () => '') =>
    items
      .map((item) => {
        const text = `${textOf(item).join(' \n ')} ${extra(item)}`;
        return { item, text, hit: list.every((word) => fold(text).includes(word)) };
      })
      .filter((entry) => entry.hit);
  return {
    contacts: find(store.list('contact'), (c) => (c.tagIds || []).map((id) => (tags.get(id) || {}).name || '').join(' ')).map((e) => e.item),
    notes: find(store.list('note'), linkedNames).map((e) => ({ item: e.item, snippet: snippet(e.text, list) })),
    events: find(store.list('event'), linkedNames).map((e) => ({ item: e.item, snippet: snippet(e.text, list) })),
  };
}
