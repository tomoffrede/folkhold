// Events on the contact page: a short list (the "Events" section) and the row shown for each event.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as events from '../events.js';
import { dateLines, nextOccurrence, relative, repeats, span, startOfToday } from '../dates.js';
import { displayName } from './contacts.js';
import { collapsible } from './section.js';
import { personIcon } from './icons.js';

const LIMIT = 5; // events shown on the contact page; the rest are on the "See all" page

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// One event as a compact row: the date on the left, the text on the right.
// "showYear: false" leaves the year out of past rows (the "See all" page shows it as a heading).
export function eventRow(event, contact, { showYear = true } = {}) {
  const today = startOfToday();
  const next = nextOccurrence(event, today);
  const coming = next !== null;
  const [main, year] = dateLines(event.date);
  let second = year;
  if (repeats(event)) second = strings['event.everyYear'];
  else if (coming) {
    const range = span(event.date);
    second = range && range.earliest <= today ? strings['event.now'] : relative(next, today);
  } else if (!showYear) second = '';

  const row = make('a', `ev-row ${coming ? 'up' : 'past'}`);
  row.href = event.virtual ? `#/contact/${contact.id}` : `#/event/${event.id}/${contact.id}`;
  if (event.virtual) {
    // The birthday lives in the details: opening it starts editing the contact.
    row.addEventListener('click', (click) => {
      click.preventDefault();
      const edit = document.querySelector('[data-act="edit"]');
      if (edit) edit.click();
    });
  }
  const date = make('div', 'ev-date');
  date.append(make('span', 'ev-main', main));
  if (second) date.append(make('small', '', second));

  const text = make('div', 'ev-text');
  const together = event.kind === 'together';
  const title = make('b', 'ev-title');
  const dot = make('span', 'who');
  dot.append(personIcon(together ? 2 : 1));
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', t(`event.kind.${together ? 'together' : 'life'}`, { name: contact.firstName || contact.nickname || displayName(contact) }));
  title.append(dot, document.createTextNode(event.virtual ? strings['birthday.event'] : event.title || strings['event.untitled']));
  text.append(title);

  const others = (event.contactIds || [])
    .filter((id) => id !== contact.id)
    .map((id) => store.get('contact', id))
    .filter(Boolean)
    .map(displayName);
  const age = event.virtual && event.birthYear && next ? t('birthday.turns', { age: new Date(next).getFullYear() - event.birthYear }) : '';
  const more = [age, event.details ? event.details.replace(/\s+/g, ' ') : '', others.length ? t('notes.alsoOn', { names: others.join(', ') }) : ''].filter(Boolean).join(' · ');
  if (more) text.append(make('span', 'ev-more', more));
  row.append(date, text);
  return row;
}

export function renderEventsSection(contact) {
  const list = events.listWithBirthday(contact.id);
  const section = collapsible({ key: 'events', title: strings['events.title'], count: list.length, className: 'events' });
  const add = make('a', 'btn btn-secondary btn-small', strings['events.add']);
  add.href = `#/add-event/${contact.id}`;
  section.actionsEl.append(add);

  if (list.length === 0) section.bodyEl.append(make('p', 'empty', strings['events.empty']));
  list.slice(0, LIMIT).forEach((event) => section.bodyEl.append(eventRow(event, contact)));
  if (list.length > LIMIT) {
    const more = make('a', 'see-all', t('events.seeAll', { n: list.length }));
    more.href = `#/events/${contact.id}`;
    section.bodyEl.append(more);
  }
  return section;
}
