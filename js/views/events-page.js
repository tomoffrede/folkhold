// "See all": every event of one contact, in groups. #/events/<contactId>

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as events from '../events.js';
import { nextOccurrence, sortEvents, span, startOfToday } from '../dates.js';
import { eventRow } from './contact-events.js';
import { shortName } from './event-fields.js';
import { displayName } from './contacts.js';

let filter = 'all'; // 'all', 'life' or 'together'
let shownFor = null;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function contactId() {
  const match = location.hash.match(/^#\/events\/([0-9a-f-]+)$/i);
  return match ? match[1] : null;
}

function render() {
  const id = contactId();
  if (!id) return;
  const page = document.getElementById('events-page');
  page.replaceChildren();
  if (shownFor !== id) filter = 'all';
  shownFor = id;

  const back = make('a', 'link back', strings['events.back']);
  back.href = `#/contact/${id}`;
  page.append(back);

  const contact = store.isLoaded() ? store.get('contact', id) : null;
  if (!contact) {
    page.append(make('p', 'empty', strings[store.isLoaded() ? 'contact.notFound' : 'contacts.loading']));
    return;
  }
  const name = shortName(contact) || displayName(contact);
  page.append(make('h2', 'section-title', t('events.pageTitle', { name })));

  const chips = make('div', 'prio-row');
  [['all', strings['events.filterAll']], ['life', t('event.kind.life', { name })], ['together', t('event.kind.together', { name })]].forEach(([value, label]) => {
    const chip = make('button', 'chip prio-chip', label);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(filter === value));
    chip.addEventListener('click', () => {
      filter = value;
      render();
    });
    chips.append(chip);
  });
  page.append(chips);

  const today = startOfToday();
  const list = sortEvents(events.listWithBirthday(id).filter((event) => filter === 'all' || (filter === 'together') === (event.kind === 'together')), today);
  if (list.length === 0) page.append(make('p', 'empty', strings['events.empty']));

  const coming = list.filter((event) => nextOccurrence(event, today) !== null);
  const past = list.filter((event) => nextOccurrence(event, today) === null);
  const group = (heading, items, showYear) => {
    page.append(make('h3', 'ev-group', heading));
    items.forEach((event) => page.append(eventRow(event, contact, { showYear })));
  };
  if (coming.length) group(strings['events.coming'], coming, true);
  const years = [];
  past.forEach((event) => {
    const year = new Date((span(event.date) || { latest: 0 }).latest).getFullYear();
    if (!years.length || years[years.length - 1].year !== year) years.push({ year, items: [] });
    years[years.length - 1].items.push(event);
  });
  years.forEach(({ year, items }) => group(String(year), items, false));
}

export function initEventsPage() {
  window.addEventListener('hashchange', render);
  document.addEventListener('folkhold:ready', render);
  document.addEventListener('folkhold:data', render);
  document.addEventListener('folkhold:saved', () => {
    if (contactId()) render();
  });
}
