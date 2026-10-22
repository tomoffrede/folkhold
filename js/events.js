// Events. An event looks like: { title?, details?, date, repeat?, kind? ('together'; no kind means "their life"), contactIds, createdAt, updatedAt? }.
// See dates.js for "date". Linked to several contacts like notes (see linked.js).

import * as store from './store.js';
import * as linked from './linked.js';
import { sortEvents, yearlyDate } from './dates.js';

const MANAGED = ['title', 'details', 'date', 'repeat', 'kind'];

export function listFor(contactId) {
  return sortEvents(linked.listOf('event', contactId));
}

// The contact's events plus their birthday (from the details) as a yearly event, so it shows up with the others.
export function listWithBirthday(contactId) {
  const list = linked.listOf('event', contactId);
  const b = (store.get('contact', contactId) || {}).birthday;
  if (b && b.month && b.day) list.push({ id: 'birthday', virtual: 'birthday', date: yearlyDate(b.month, b.day), birthYear: b.year || 0, contactIds: [contactId] });
  return sortEvents(list);
}

export function get(id) {
  return store.get('event', id);
}

export function create({ title, details, date, repeat, kind, contactIds }) {
  return linked.create('event', { title, details, date, repeat, kind: kind === 'together' ? 'together' : '' }, contactIds);
}

export function saveEdit(event, { title, details, date, repeat, kind }, originId, appliedIds) {
  return linked.saveEdit('event', event, MANAGED, { title, details, date, repeat, kind: kind === 'together' ? 'together' : '' }, originId, appliedIds);
}

export function removeFromContacts(event, contactIds) {
  return linked.removeFromContacts('event', event, contactIds);
}

export function removeEverywhere(event) {
  return store.remove('event', event.id);
}

export function detachContact(contactId) {
  return linked.detachContact('event', contactId);
}
