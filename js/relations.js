// Relationships between people. A relationship is saved once, on the contact it was added to:
//   contact.relations = [{ id, kind | label, contactId | name }]
// "kind" is one of the standard ones (partner, parent...); "label" is a word the user typed. The other side is either
// another contact ("contactId") or just a name ("name").
// The other contact's page shows the same relationship the other way round (Parent becomes Child), worked out here when needed.

import * as store from './store.js';
import { getLang } from './lang.js';
import { KINDS } from './relkinds.js';

const fold = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // letters and numbers of every script (not only a-z)
    .trim();

// What each kind is called from the other side ("mother" -> "child"), and the general kind of a specific one ("mother" -> "parent").
export const INVERSE = Object.fromEntries(KINDS.map((kind) => [kind.key, kind.inverse]));
const BASE = Object.fromEntries(KINDS.filter((kind) => kind.base).map((kind) => [kind.key, kind.base]));
export const KIND_ORDER = KINDS.map((kind) => kind.key);
const BY_KEY = Object.fromEntries(KINDS.map((kind) => [kind.key, kind]));

// Every word of every language, and the kind it means. Words are matched with their accents first ("avó" is a grandmother, "avô" a
// grandfather) and without accents second ("avo"). When two kinds share a word, the first kind in the list wins.
const exactFold = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const WORDS = new Map();
const EXACT = new Map();
KINDS.forEach((kind) => {
  Object.values(kind.terms).forEach((list) => {
    list.forEach((term) => {
      if (fold(term) && !WORDS.has(fold(term))) WORDS.set(fold(term), kind.key);
      if (exactFold(term) && !EXACT.has(exactFold(term))) EXACT.set(exactFold(term), kind.key);
    });
  });
});

// How a kind is shown in the language in use.
export const labelOf = (kind) => {
  const entry = BY_KEY[kind];
  return entry ? entry.terms[getLang()][0] || entry.terms.en[0] : '';
};

// The kinds offered in the menu; every other kind is suggested while typing.
const MENU = ['partner', 'spouse', 'friend', 'bestFriend', 'parent', 'child', 'sibling', 'grandparent', 'cousin', 'colleague', 'neighbor', 'ex'];
export const standardLabels = () => MENU.map(labelOf);

// The kind that a typed word means (in any language); null for any other word.
export function kindOf(text) {
  const wanted = fold(text);
  return (wanted && (EXACT.get(exactFold(text)) || WORDS.get(wanted))) || null;
}

// Kinds that match what is being typed, as they are shown in the language in use: words that start with it first.
export function suggest(text, limit = 8) {
  const wanted = fold(text);
  if (!wanted) return [];
  const found = [];
  KINDS.forEach((kind, order) => {
    let best = 9;
    Object.values(kind.terms).forEach((list) =>
      list.forEach((term) => {
        const folded = fold(term);
        const at = folded.indexOf(wanted);
        if (at < 0) return;
        const score = at === 0 ? 0 : folded[at - 1] === ' ' ? 1 : 2;
        if (score < best) best = score;
      }),
    );
    if (best < 9) found.push({ kind: kind.key, best, order });
  });
  return found
    .sort((a, b) => a.best - b.best || a.order - b.order)
    .slice(0, limit)
    .map((item) => labelOf(item.kind));
}

// The kind a saved relationship stands for: the standard one, or the one its typed word means.
export const kindFor = (rel) => rel.kind || kindOf(rel.label);

export const labelText = (rel) => {
  const kind = kindFor(rel);
  return kind ? labelOf(kind) : rel.label || '';
};
export const newId = () => crypto.randomUUID();

const nameOf = (contact) => [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.nickname || '';

// "Maria Santos" gives { firstName: 'Maria', lastName: 'Santos' }.
export function splitName(text) {
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  const fields = { firstName: parts[0] || '' };
  if (parts.length > 1) fields.lastName = parts.slice(1).join(' ');
  return fields;
}

// Contacts made from a relationship field of an editor that is open: if the relationship is then dropped
// (Discard, or the row removed), a contact that is still only a name and is used nowhere is removed again.
export const createdInEditor = new Set();

export function createContact(name) {
  return store.add('contact', splitName(name));
}

export async function dropUnused() {
  const ids = [...createdInEditor];
  createdInEditor.clear();
  const kept = []; // still only a name, and in use: their details can be offered
  for (const id of ids) {
    const contact = store.get('contact', id);
    if (!contact) continue;
    const edited = Object.keys(contact).some((key) => !['id', 'firstName', 'lastName'].includes(key));
    const used =
      store.list('contact').some((other) => (other.relations || []).some((rel) => rel.contactId === id) || (other.metThrough && other.metThrough.contactId === id)) ||
      store.list('note').some((note) => (note.contactIds || []).includes(id)) ||
      store.list('event').some((event) => (event.contactIds || []).includes(id));
    if (!edited && !used) await store.remove('contact', id);
    else if (!edited) kept.push({ id, name: nameOf(contact) });
  }
  return kept;
}

function withoutId(contact) {
  const { id, ...fields } = contact;
  return fields;
}

// Every relationship shown on this contact's page, sorted: standard kinds first (in menu order), then typed ones.
// { relId, ownerId (the contact it is saved on), own (saved on this contact), label, contactId, name }
export function listFor(contact) {
  const rows = [];
  (contact.relations || []).forEach((rel) => {
    const target = rel.contactId ? store.get('contact', rel.contactId) : null;
    const name = target ? nameOf(target) : rel.name || '';
    if (!name) return;
    rows.push({ relId: rel.id, ownerId: contact.id, own: true, kind: kindFor(rel), label: labelText(rel), contactId: target ? target.id : null, name });
  });
  store.list('contact').forEach((other) => {
    if (other.id === contact.id) return;
    (other.relations || []).forEach((rel) => {
      if (rel.contactId !== contact.id) return;
      const ownKind = kindFor(rel);
      const kind = ownKind ? INVERSE[ownKind] : null;
      const label = kind ? labelOf(kind) : rel.label || '';
      // The same relationship entered on both pages is shown once ("Mother" here, "Child" there; "Daughter" there is the same as "Child").
      const twice = rows.some((row) => row.own && row.contactId === other.id && (kind ? row.kind === kind || BASE[row.kind] === kind || BASE[kind] === row.kind : !row.kind && fold(row.label) === fold(label)));
      if (twice) return;
      rows.push({ relId: rel.id, ownerId: other.id, own: false, kind, label, contactId: other.id, name: nameOf(other) });
    });
  });
  const rank = (row) => (row.kind ? KIND_ORDER.indexOf(row.kind) : KIND_ORDER.length);
  return rows.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
}

export const hasAny = (contact) => listFor(contact).length > 0;

// Removes one relationship that is saved on another contact (used from this contact's editor).
export async function removeFrom(ownerId, relId) {
  const owner = store.get('contact', ownerId);
  if (!owner) return;
  const rest = (owner.relations || []).filter((rel) => rel.id !== relId);
  const fields = withoutId(owner);
  if (rest.length) fields.relations = rest;
  else delete fields.relations;
  await store.update('contact', ownerId, fields);
}

// A name-only relationship becomes a real contact (made from that name).
export async function makeContact(ownerId, relId) {
  const owner = store.get('contact', ownerId);
  const rel = owner && (owner.relations || []).find((r) => r.id === relId);
  if (!rel || !rel.name) return null;
  const contactId = await createContact(rel.name);
  const relations = owner.relations.map((r) => {
    if (r.id !== relId) return r;
    const { name, ...rest } = r;
    return { ...rest, contactId };
  });
  await store.update('contact', ownerId, { ...withoutId(owner), relations });
  return contactId;
}

// New-contact form: relationships marked "create" get their contact now, so the saved list only has ids and names.
// Returns { list, created: [{ id, name }] }.
export async function materialize(list) {
  const result = [];
  const created = [];
  for (const rel of list || []) {
    if (!rel.create) {
      result.push(rel);
      continue;
    }
    const { create, name, ...rest } = rel;
    const contactId = await createContact(name);
    created.push({ id: contactId, name });
    result.push({ ...rest, contactId });
  }
  return { list: result, created };
}

// "Met through": who introduced this contact, as { name } or { contactId }. Gives { name, contactId? } with the current name, or null.
export function throughOf(contact) {
  const through = contact.metThrough;
  if (!through) return null;
  const target = through.contactId ? store.get('contact', through.contactId) : null;
  if (target) return { contactId: target.id, name: nameOf(target) };
  return through.name ? { name: through.name } : null;
}

// The contacts that were introduced by this one, sorted by name.
export function introducedBy(contact) {
  return store
    .list('contact')
    .filter((other) => other.metThrough && other.metThrough.contactId === contact.id)
    .map((other) => ({ id: other.id, name: nameOf(other) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A contact is about to be deleted: relationships to them stay, as plain names.
export async function detachContact(contact) {
  const deletedName = nameOf(contact);
  for (const other of store.list('contact')) {
    if (other.id !== contact.id && other.metThrough && other.metThrough.contactId === contact.id) {
      await store.update('contact', other.id, { ...withoutId(other), metThrough: { name: deletedName } });
    }
  }
  for (const other of store.list('contact')) {
    if (other.id === contact.id) continue;
    const list = other.relations || [];
    const fromOther = list.some((rel) => rel.contactId === contact.id);
    const mirrored = (contact.relations || []).filter((rel) => rel.contactId === other.id);
    if (!fromOther && !mirrored.length) continue;
    let relations = list.map((rel) => {
      if (rel.contactId !== contact.id) return rel;
      const { contactId, ...rest } = rel;
      return { ...rest, name: deletedName };
    });
    // What the deleted contact had saved about this person is kept on this person's page, unless it was entered there too.
    mirrored.forEach((rel) => {
      const own = kindFor(rel);
      const kind = own ? INVERSE[own] : null;
      const known = relations.some((r) => r.name === deletedName && (kind ? kindFor(r) === kind : !kindFor(r) && fold(r.label) === fold(rel.label)));
      if (!known && deletedName) relations.push({ id: newId(), ...(kind ? { kind } : { label: rel.label }), name: deletedName });
    });
    relations = relations.filter((rel) => rel.contactId || rel.name);
    await store.update('contact', other.id, { ...withoutId(other), relations });
  }
}
