// Events. An event looks like: { title?, details?, date: {precision, ...}, repeat?, contactIds, createdAt, updatedAt? }.
// See dates.js for "date". Linked to several contacts like notes (see linked.js).

import * as store from './store.js';
import * as linked from './linked.js';
import { sortEvents } from './dates.js';

const MANAGED = ['title', 'details', 'date', 'repeat'];

export function listFor(contactId) {
  return sortEvents(linked.listOf('event', contactId));
}

export function get(id) {
  return store.get('event', id);
}

export function create({ title, details, date, repeat, contactIds }) {
  return linked.create('event', { title, details, date, repeat }, contactIds);
}

export function saveEdit(event, { title, details, date, repeat }, originId, appliedIds) {
  return linked.saveEdit('event', event, MANAGED, { title, details, date, repeat }, originId, appliedIds);
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
