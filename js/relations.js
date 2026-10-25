// Relationships between people. A relationship is saved once, on the contact it was added to:
//   contact.relations = [{ id, kind | label, contactId | name }]
// "kind" is one of the standard ones (partner, parent...); "label" is a word the user typed. The other side is either
// another contact ("contactId") or just a name ("name").
// The other contact's page shows the same relationship the other way round (Parent becomes Child), worked out here when needed.

import * as store from './store.js';
import { strings } from './strings.js';

// Standard kinds and what each one is called from the other side.
export const INVERSE = { partner: 'partner', friend: 'friend', bestFriend: 'bestFriend', parent: 'child', child: 'parent', sibling: 'sibling', colleague: 'colleague', ex: 'ex' };
export const KIND_ORDER = Object.keys(INVERSE);
const ENGLISH = { partner: 'partner', friend: 'friend', bestFriend: 'best friend', parent: 'parent', child: 'child', sibling: 'sibling', colleague: 'colleague', ex: 'ex' };

const fold = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const standardLabels = () => KIND_ORDER.map((kind) => strings[`rel.${kind}`]);

// The standard kind that a typed word means, in the language in use or in English; null for any other word.
export function kindOf(text) {
  const wanted = fold(text);
  if (!wanted) return null;
  return KIND_ORDER.find((kind) => fold(strings[`rel.${kind}`]) === wanted || ENGLISH[kind] === wanted) || null;
}

export const labelText = (rel) => (rel.kind ? strings[`rel.${rel.kind}`] : rel.label || '');
export const newId = () => crypto.randomUUID();

const nameOf = (contact) => [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.nickname || '';

// "Maria Santos" gives { firstName: 'Maria', lastName: 'Santos' }.
export function splitName(text) {
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  const fields = { firstName: parts[0] || '' };
  if (parts.length > 1) fields.lastName = parts.slice(1).join(' ');
  return fields;
}

export function createContact(name) {
  return store.add('contact', splitName(name));
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
    rows.push({ relId: rel.id, ownerId: contact.id, own: true, kind: rel.kind, label: labelText(rel), contactId: target ? target.id : null, name });
  });
  store.list('contact').forEach((other) => {
    if (other.id === contact.id) return;
    (other.relations || []).forEach((rel) => {
      if (rel.contactId !== contact.id) return;
      const kind = rel.kind ? INVERSE[rel.kind] : null;
      const label = kind ? strings[`rel.${kind}`] : rel.label || '';
      // The same relationship entered on both pages is shown once.
      const twice = rows.some((row) => row.own && row.contactId === other.id && (kind ? row.kind === kind : !row.kind && fold(row.label) === fold(label)));
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
export async function materialize(list) {
  const result = [];
  for (const rel of list || []) {
    if (!rel.create) {
      result.push(rel);
      continue;
    }
    const { create, name, ...rest } = rel;
    result.push({ ...rest, contactId: await createContact(name) });
  }
  return result;
}

// A contact is about to be deleted: relationships to them stay, as plain names.
export async function detachContact(contact) {
  const deletedName = nameOf(contact);
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
      const kind = rel.kind ? INVERSE[rel.kind] : null;
      const known = relations.some((r) => r.name === deletedName && (kind ? r.kind === kind : !r.kind && fold(r.label) === fold(rel.label)));
      if (!known && deletedName) relations.push({ id: newId(), ...(kind ? { kind } : { label: rel.label }), name: deletedName });
    });
    relations = relations.filter((rel) => rel.contactId || rel.name);
    await store.update('contact', other.id, { ...withoutId(other), relations });
  }
}
