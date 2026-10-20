// The "Events" part of a contact's reading page.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as events from '../events.js';
import { formatDate, repeats } from '../dates.js';
import { displayName } from './contacts.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderEventsSection(contact) {
  const section = make('div', 'group events');
  const head = make('div', 'notes-head');
  head.append(make('h3', 'group-title', strings['events.title']));
  const add = make('a', 'btn btn-secondary btn-small', strings['events.add']);
  add.href = `#/add-event/${contact.id}`;
  head.append(add);
  section.append(head);

  const list = events.listFor(contact.id);
  if (list.length === 0) section.append(make('p', 'empty', strings['events.empty']));
  list.forEach((event) => {
    const card = make('a', 'note-card event-card');
    card.href = `#/event/${event.id}/${contact.id}`;
    const when = formatDate(event.date) + (repeats(event) ? ` · ${strings['event.everyYear']}` : '');
    card.append(make('p', 'event-date', when));
    if (event.title) card.append(make('h4', 'note-title', event.title));
    if (event.details) card.append(make('p', 'event-details', event.details));
    const others = (event.contactIds || [])
      .filter((id) => id !== contact.id)
      .map((id) => store.get('contact', id))
      .filter(Boolean)
      .map(displayName);
    if (others.length) card.append(make('p', 'note-meta', t('notes.alsoOn', { names: others.join(', ') })));
    section.append(card);
  });
  return section;
}
