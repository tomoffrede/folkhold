// The Upcoming screen (#/upcoming) and the short "Upcoming" list on the Home screen.
// Shows events that are coming (including yearly ones such as birthdays) and contacts' birthdays, soonest first.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import { daysInMonth, formatDate, nextOccurrence, relative, span, startOfToday } from '../dates.js';
import { displayName } from './contacts.js';

const RANGES = [30, 90, 365, 0]; // days; 0 means everything that is coming
const HOME_LIMIT = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KEY = 'folkhold-upcoming';

let days = 90;
try {
  const raw = localStorage.getItem(KEY);
  if (raw !== null && RANGES.includes(Number(raw))) days = Number(raw);
} catch {
  // storage not available: keep the default
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Every coming item within `limitDays` (0 = no limit): { ts, exact, label, title, names, href, birthday }.
export function collect(limitDays, today = startOfToday()) {
  const end = limitDays ? today + limitDays * 86400000 : Infinity;
  const items = [];

  store.list('event').forEach((event) => {
    const next = nextOccurrence(event, today);
    if (next === null || next > end) return;
    const contacts = (event.contactIds || []).map((id) => store.get('contact', id)).filter(Boolean);
    if (!contacts.length) return;
    const range = span(event.date);
    const exact = !range || range.earliest === range.latest || nextOccurrenceIsYearly(event);
    items.push({
      ts: next,
      exact,
      label: formatDate(event.date),
      title: event.title || strings['event.untitled'],
      names: contacts.map(displayName).join(', '),
      href: `#/event/${event.id}/${contacts[0].id}`,
      together: event.kind === 'together',
    });
  });

  store.list('contact').forEach((contact) => {
    const b = contact.birthday;
    if (!b || !b.month || !b.day) return;
    const year = new Date(today).getFullYear();
    let ts = new Date(year, b.month - 1, Math.min(b.day, daysInMonth(b.month, year))).getTime();
    let turning = year;
    if (ts < today) {
      turning = year + 1;
      ts = new Date(turning, b.month - 1, Math.min(b.day, daysInMonth(b.month, turning))).getTime();
    }
    if (ts > end) return;
    items.push({
      ts,
      exact: true,
      birthday: true,
      title: b.year ? t('upcoming.turns', { name: displayName(contact), age: turning - b.year }) : t('upcoming.birthday', { name: displayName(contact) }),
      names: '',
      href: `#/contact/${contact.id}`,
    });
  });

  return items.sort((a, b) => a.ts - b.ts);
}

function nextOccurrenceIsYearly(event) {
  return Boolean(event.repeat) || Boolean(event.date && event.date.yearly);
}

function row(item, today) {
  const link = make('a', 'ev-row up');
  link.href = item.href;
  const date = make('div', 'ev-date');
  const d = new Date(item.ts);
  if (item.exact) {
    date.append(make('span', 'ev-main', `${d.getDate()} ${MONTHS[d.getMonth()]}`));
    const sub = `${WEEKDAYS[d.getDay()]}${d.getFullYear() !== new Date(today).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    date.append(make('small', '', sub));
  } else {
    date.append(make('span', 'ev-main', item.label));
    date.append(make('small', '', item.ts <= today ? strings['event.now'] : relative(item.ts, today)));
  }
  const text = make('div', 'ev-text');
  text.append(make('b', 'ev-title', item.title));
  const more = [item.names, item.exact ? relative(item.ts, today) : ''].filter(Boolean).join(' · ');
  if (more) text.append(make('span', 'ev-more', more));
  link.append(date, text);
  return link;
}

function renderHome() {
  const box = document.getElementById('home-upcoming');
  if (!box) return;
  box.replaceChildren();
  const today = startOfToday();
  const items = collect(90, today);
  document.getElementById('home-upcoming-empty').hidden = items.length > 0;
  items.slice(0, HOME_LIMIT).forEach((item) => box.append(row(item, today)));
  if (items.length > HOME_LIMIT) {
    const more = make('a', 'see-all', t('upcoming.seeAll', { n: items.length }));
    more.href = '#/upcoming';
    box.append(more);
  }
}

function renderScreen() {
  const box = document.getElementById('upcoming-list');
  if (!box) return;
  const chips = document.getElementById('upcoming-range');
  chips.replaceChildren();
  RANGES.forEach((value) => {
    const chip = make('button', 'chip prio-chip', strings[`upcoming.range.${value}`]);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(days === value));
    chip.addEventListener('click', () => {
      days = value;
      try {
        localStorage.setItem(KEY, String(value));
      } catch {
        // not saved: the choice only lasts until the page is closed
      }
      render();
    });
    chips.append(chip);
  });
  box.replaceChildren();
  const today = startOfToday();
  const items = collect(days, today);
  document.getElementById('upcoming-empty').hidden = items.length > 0;
  items.forEach((item) => box.append(row(item, today)));
}

function render() {
  if (!store.isLoaded()) return;
  renderHome();
  renderScreen();
}

export function initUpcoming() {
  document.addEventListener('folkhold:ready', render);
  document.addEventListener('folkhold:data', render);
  document.addEventListener('folkhold:saved', render);
  window.addEventListener('hashchange', render);
}
