// The advanced contact filter: a list of conditions, all of which must be true for a contact to be shown.
// A condition is one of:
//   { type: 'has', field, not }      field: birthday, emails, phones, addresses, handles, met, notes, events, tags, important
//   { type: 'lastMet', since }       last met more than this long ago (a key of LAST_MET_CHOICES), or no meet-up logged
//   { type: 'birthdayMonth', month } birthday in this month (1 to 12)

import * as notes from './notes.js';
import * as events from './events.js';
import * as relations from './relations.js';
import { lastTogether, startOfToday } from './dates.js';

export const HAS_FIELDS = ['birthday', 'emails', 'phones', 'addresses', 'handles', 'met', 'notes', 'events', 'tags', 'important', 'relations'];
// The choices for "last met more than …": weeks and months, as [key, weeks or months].
export const LAST_MET_CHOICES = [['2w', 'w', 2], ['1m', 'm', 1], ['2m', 'm', 2], ['3m', 'm', 3], ['6m', 'm', 6], ['1y', 'm', 12]];

function has(contact, field) {
  switch (field) {
    case 'birthday':
      return Boolean(contact.birthday);
    case 'met':
      return Boolean(contact.met || contact.metText || contact.metThrough);
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

function lastMetBefore(contact, key) {
  const found = lastTogether(events.listFor(contact.id));
  if (!found) return true; // no meet-up logged counts as "more than that ago"
  const [, unit, n] = LAST_MET_CHOICES.find((choice) => choice[0] === key) || LAST_MET_CHOICES[4];
  const limit = new Date(startOfToday());
  if (unit === 'w') limit.setDate(limit.getDate() - 7 * n);
  else limit.setMonth(limit.getMonth() - n);
  return found.time < limit.getTime();
}

export function matches(contact, condition) {
  if (condition.type === 'lastMet') return lastMetBefore(contact, condition.since);
  if (condition.type === 'birthdayMonth') return Boolean(contact.birthday) && contact.birthday.month === condition.month;
  return has(contact, condition.field) !== Boolean(condition.not);
}

export function matchesAll(contact, conditions) {
  return conditions.every((condition) => matches(contact, condition));
}
