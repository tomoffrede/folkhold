// The advanced contact filter: a list of conditions, all of which must be true for a contact to be shown.
// A condition is one of:
//   { type: 'has', field, not }      field: birthday, emails, phones, addresses, handles, met, notes, events, tags, important
//   { type: 'lastMet', months }      last met more than this many months ago, or never
//   { type: 'birthdayMonth', month } birthday in this month (1 to 12)

import * as notes from './notes.js';
import * as events from './events.js';
import * as relations from './relations.js';
import { lastTogether, startOfToday } from './dates.js';

export const HAS_FIELDS = ['birthday', 'emails', 'phones', 'addresses', 'handles', 'met', 'notes', 'events', 'tags', 'important', 'relations'];
export const LAST_MET_MONTHS = [3, 6, 12];

function has(contact, field) {
  switch (field) {
    case 'birthday':
      return Boolean(contact.birthday);
    case 'met':
      return Boolean(contact.met);
    case 'tags':
      return (contact.tagIds || []).length > 0;
    case 'notes':
      return notes.listFor(contact.id).length > 0;
    case 'events':
      return events.listFor(contact.id).length > 0;
    case 'relations':
      return relations.hasAny(contact);
    case 'important':
      return notes.listFor(contact.id).some((note) => note.priority === 1);
    default:
      return (contact[field] || []).length > 0; // emails, phones, addresses, handles
  }
}

function lastMetBefore(contact, months) {
  const found = lastTogether(events.listFor(contact.id));
  if (!found) return true; // never met counts as "more than N months ago"
  const limit = new Date(startOfToday());
  limit.setMonth(limit.getMonth() - months);
  return found.time < limit.getTime();
}

export function matches(contact, condition) {
  if (condition.type === 'lastMet') return lastMetBefore(contact, condition.months);
  if (condition.type === 'birthdayMonth') return Boolean(contact.birthday) && contact.birthday.month === condition.month;
  return has(contact, condition.field) !== Boolean(condition.not);
}

export function matchesAll(contact, conditions) {
  return conditions.every((condition) => matches(contact, condition));
}
