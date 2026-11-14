// The contacts list and the quick-add form.

import { primeKeyboard } from '../keyboard.js';
import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as tags from '../tags.js';
import { search } from '../search.js';
import { formatDate } from '../dates.js';
import { HAS_FIELDS, LAST_MET_CHOICES, matchesAll } from '../filters.js';
import { locale } from '../lang.js';
import { pinIcon } from './icons.js';
import { eventTitle } from '../eventtitle.js';
import * as events from '../events.js';
import { lastTogether, relative } from '../dates.js';
import { showToast } from './toast.js';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(locale(), { sensitivity: 'base', numeric: true });

let loaded = false;
const selected = new Set(); // tags the list is filtered by
let matchAll = true; // true: a contact needs all the selected tags; false: any one of them
let filterOpen = false;
let advancedOpen = false;
const conditions = []; // advanced filter conditions (see filters.js)
let query = ''; // what is typed in the search box

// "First Last", or the nickname when there is no name.
export function displayName(contact) {
  const full = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  return full || contact.nickname || '';
}

function personRow(contact) {
  const name = displayName(contact);
  const item = document.createElement('li');
  const row = document.createElement('a');
  row.href = `#/contact/${contact.id}`;
  row.className = 'person';

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = ([...name][0] || '?').toUpperCase();

  const text = document.createElement('span');
  const nameEl = document.createElement('span');
  nameEl.className = 'person-name';
  nameEl.textContent = name;
  text.append(nameEl);

  // The nickname goes underneath, unless it is already the name shown.
  if (contact.nickname && contact.nickname !== name) {
    const nick = document.createElement('span');
    nick.className = 'person-nick';
    nick.textContent = `“${contact.nickname}”`;
    text.append(document.createElement('br'), nick);
  }

  // While sorted by last met, each row says when (so the order is understandable).
  if (settings.get('contactSort') === 'met' && !query) {
    const time = lastMetTime(contact);
    const when = document.createElement('span');
    when.className = 'person-nick';
    when.textContent = time === null ? strings['contacts.metNone'] : relative(time);
    text.append(document.createElement('br'), when);
  }
  row.append(avatar, text);
  // The pin sits beside the link (a button cannot be inside a link): tap it to pin or unpin without opening the contact.
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = contact.pinned ? 'person-pin is-pinned' : 'person-pin';
  pin.setAttribute('aria-pressed', String(Boolean(contact.pinned)));
  pin.setAttribute('aria-label', strings[contact.pinned ? 'contact.unpin' : 'contact.pin']);
  pin.title = strings[contact.pinned ? 'contact.unpin' : 'contact.pin'];
  pin.append(pinIcon(Boolean(contact.pinned)));
  pin.addEventListener('click', () => {
    const { id, ...rest } = contact;
    if (rest.pinned) delete rest.pinned;
    else rest.pinned = true;
    store.update('contact', id, rest).catch((error) => showToast(error.message));
  });
  item.append(row, pin);
  return item;
}

// What the list is sorted by: the full name, or the last name first (chosen with the chips above the list).
// Pinned contacts come first, then the usual sort order.
function byPinThenName(a, b) {
  const pins = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pins) return pins;
  if (settings.get('contactSort') === 'met') {
    const x = lastMetTime(a);
    const y = lastMetTime(b);
    if (x !== y && (x === null || y === null)) return x === null ? 1 : -1; // contacts with no meet-up logged always go last
    if (x !== y) return settings.get('contactMetOrder') === 'oldest' ? x - y : y - x;
  }
  return collator.compare(sortName(a), sortName(b));
}

// When you last met someone (a time, or null when no meet-up is logged), worked out once per drawing of the list.
let metTimes = new Map();
function lastMetTime(contact) {
  if (!metTimes.has(contact.id)) {
    const found = lastTogether(events.listFor(contact.id));
    metTimes.set(contact.id, found ? found.time : null);
  }
  return metTimes.get(contact.id);
}

function sortName(contact) {
  if (settings.get('contactSort') === 'last') {
    const last = contact.lastName || contact.firstName || contact.nickname || '';
    return `${last} ${contact.firstName || ''}`;
  }
  return displayName(contact);
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(locale(), { month: 'long' }));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function select(options, value, onChange, label) {
  const box = el('select', 'cond-select');
  if (label) box.setAttribute('aria-label', label);
  options.forEach(([optionValue, text]) => {
    const option = el('option', '', text);
    option.value = String(optionValue);
    box.append(option);
  });
  box.value = String(value);
  box.addEventListener('change', () => onChange(box.value));
  return box;
}

function refresh() {
  renderFilter();
  renderList();
}

function conditionKey(condition) {
  return condition.type === 'has' ? condition.field : condition.type;
}

function conditionRow(condition, index) {
  const row = el('div', condition.type === 'has' ? 'cond-row' : 'cond-row cond-wide');
  if (condition.type === 'has') {
    row.append(
      select([[0, strings['filter.has']], [1, strings['filter.hasNot']]], condition.not ? 1 : 0, (value) => {
        condition.not = value === '1';
        refresh();
      }),
    );
  }
  const whats = [...HAS_FIELDS.map((field) => [field, strings[`filter.field.${field}`]]), ['lastMet', strings['filter.lastMet']], ['birthdayMonth', strings['filter.birthdayIn']]];
  row.append(
    select(whats, conditionKey(condition), (value) => {
      if (value === 'lastMet') conditions[index] = { type: 'lastMet', since: '6m' };
      else if (value === 'birthdayMonth') conditions[index] = { type: 'birthdayMonth', month: new Date().getMonth() + 1 };
      else conditions[index] = { type: 'has', field: value, not: condition.type === 'has' ? condition.not : false };
      refresh();
    }),
  );
  if (condition.type === 'lastMet') {
    row.append(
      select(LAST_MET_CHOICES.map(([key]) => [key, strings[`filter.lm.${key}`]]), condition.since, (value) => {
        condition.since = value;
        refresh();
      }),
    );
  } else if (condition.type === 'birthdayMonth') {
    row.append(
      select(MONTHS.map((name, i) => [i + 1, name]), condition.month, (value) => {
        condition.month = Number(value);
        refresh();
      }),
    );
  }
  const remove = el('button', 'cond-remove', '×');
  remove.type = 'button';
  remove.setAttribute('aria-label', strings['filter.remove']);
  remove.addEventListener('click', () => {
    conditions.splice(index, 1);
    refresh();
  });
  row.append(remove);
  return row;
}

function tagSection(used) {
  const section = el('div', 'filter-section');
  section.append(el('h3', 'filter-heading', strings['filter.tags']));
  const chips = el('div', 'prio-row filter-chips');
  used.forEach((tag) => {
    const chip = el('button', 'chip prio-chip', tag.name);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(selected.has(tag.id)));
    chip.addEventListener('click', () => {
      if (selected.has(tag.id)) selected.delete(tag.id);
      else selected.add(tag.id);
      refresh();
    });
    chips.append(chip);
  });
  section.append(chips);
  if (selected.size >= 2) {
    const mode = el('div', 'tag-mode');
    mode.append(el('span', 'tag-mode-label', strings['tags.matchLabel']));
    const group = el('div', 'segmented');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', strings['tags.matchLabel']);
    [[true, strings['tags.matchAll']], [false, strings['tags.matchAny']]].forEach(([value, text]) => {
      const button = el('button', '', text);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(matchAll === value));
      button.addEventListener('click', () => {
        matchAll = value;
        refresh();
      });
      group.append(button);
    });
    mode.append(group);
    section.append(mode);
  }
  return section;
}

function advancedSection() {
  const section = el('div', 'filter-section');
  const head = el('button', 'filter-adv-toggle', strings['filter.advanced']);
  head.type = 'button';
  head.setAttribute('aria-expanded', String(advancedOpen));
  head.addEventListener('click', () => {
    advancedOpen = !advancedOpen;
    renderFilter();
  });
  section.append(head);
  if (!advancedOpen) return section;
  conditions.forEach((condition, index) => section.append(conditionRow(condition, index)));
  const add = el('button', 'link filter-add', strings['filter.add']);
  add.type = 'button';
  add.addEventListener('click', () => {
    conditions.push({ type: 'has', field: 'birthday', not: false });
    refresh();
  });
  section.append(add);
  return section;
}

function renderFilter() {
  const box = $('contacts-filter');
  const button = $('filter-button');
  button.hidden = Boolean(query);
  if (query) {
    box.hidden = true;
    return;
  }
  const used = tags.inUse();
  [...selected].forEach((id) => {
    if (!used.some((tag) => tag.id === id)) selected.delete(id);
  });
  const active = selected.size + conditions.length;
  button.textContent = active ? t('filter.buttonCount', { n: active }) : strings['filter.button'];
  button.setAttribute('aria-expanded', String(filterOpen));
  box.hidden = !filterOpen;
  box.replaceChildren();
  if (!filterOpen) return;

  if (used.length) box.append(tagSection(used));
  box.append(advancedSection());
  if (active) {
    const clear = el('button', 'link', strings['filter.clearAll']);
    clear.type = 'button';
    clear.addEventListener('click', () => {
      selected.clear();
      conditions.length = 0;
      refresh();
    });
    box.append(clear);
  }
}

// Used from a contact's page: show only the contacts with this tag.
export function filterByTag(id) {
  selected.clear();
  selected.add(id);
  filterOpen = true;
  conditions.length = 0;
  location.hash = '#/contacts';
  renderFilter();
  renderList();
}

function resultLink(href, title, small, names) {
  const link = document.createElement('a');
  link.className = 'result';
  link.href = href;
  const top = document.createElement('b');
  top.textContent = title;
  link.append(top);
  if (small) {
    const line = document.createElement('span');
    line.className = 'result-text';
    line.textContent = small;
    link.append(line);
  }
  const who = document.createElement('small');
  who.textContent = names;
  link.append(who);
  return link;
}

// What the typed search found: contacts, notes and events, each in its own group.
function renderSearch() {
  const box = $('search-results');
  const found = search(query);
  box.replaceChildren();
  $('contacts-list').hidden = true;
  $('contacts-empty').hidden = true;
  $('contacts-nomatch').hidden = true;
  box.hidden = false;
  const namesOf = (item) => (item.contactIds || []).map((id) => store.get('contact', id)).filter(Boolean).map(displayName);
  const group = (key, count, nodes) => {
    if (!count) return;
    const heading = document.createElement('h3');
    heading.className = 'ev-group';
    heading.textContent = t(key, { n: count });
    box.append(heading, ...nodes);
  };
  const contacts = found.contacts.sort(byPinThenName);
  group('search.contacts', contacts.length, [Object.assign(document.createElement('ul'), { className: 'people' })]);
  box.querySelector('ul.people')?.append(...contacts.map(personRow));
  const noteNodes = found.notes.map(({ item, snippet }) => {
    const first = (item.contactIds || [])[0];
    return resultLink(`#/note/${item.id}/${first}`, item.title || strings['search.untitledNote'], snippet, namesOf(item).join(', '));
  });
  group('search.notes', noteNodes.length, noteNodes);
  const eventNodes = found.events.map(({ item, snippet }) => {
    const first = (item.contactIds || [])[0];
    return resultLink(`#/event/${item.id}/${first}`, `${eventTitle(item)} · ${formatDate(item.date)}`, item.details ? snippet : '', namesOf(item).join(', '));
  });
  group('search.events', eventNodes.length, eventNodes);
  if (!contacts.length && !noteNodes.length && !eventNodes.length) {
    const none = document.createElement('p');
    none.className = 'empty';
    none.textContent = strings['search.none'];
    box.append(none);
  }
}

function renderSortChips() {
  const chips = $('contacts-sort');
  const current = settings.get('contactSort');
  if (!chips.children.length) {
    ['first', 'last', 'met'].forEach((value) => {
      const chip = el('button', 'link sort-link');
      chip.type = 'button';
      chip.dataset.sort = value;
      chip.addEventListener('click', () => {
        if (value === 'met' && settings.get('contactSort') === 'met') {
          // tapping "Last met" again flips between most recent first and longest ago first
          settings.set('contactMetOrder', settings.get('contactMetOrder') === 'oldest' ? 'recent' : 'oldest').catch(() => {});
        } else {
          settings.set('contactSort', value).catch(() => {});
        }
        renderList(); // the list changes at once; the choice is saved in the background
      });
      chips.append(chip);
    });
  }
  chips.querySelectorAll('.sort-link').forEach((chip) => {
    const value = chip.dataset.sort;
    let label = strings[{ first: 'settings.sortFirst', last: 'settings.sortLast', met: 'settings.sortMet' }[value]];
    if (value === 'met' && current === 'met') label += settings.get('contactMetOrder') === 'oldest' ? ' ↑' : ' ↓';
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(value === current));
  });
}

function renderList() {
  metTimes = new Map();
  renderSortChips();
  if (query) {
    renderSearch();
    return;
  }
  $('search-results').hidden = true;
  $('contacts-list').hidden = false;
  const everyone = store.list('contact');
  const contacts = everyone
    .filter((contact) => {
      if (!matchesAll(contact, conditions)) return false;
      if (selected.size === 0) return true;
      const own = contact.tagIds || [];
      const test = (id) => own.includes(id);
      return matchAll ? [...selected].every(test) : [...selected].some(test);
    })
    .sort(byPinThenName);
  $('contacts-list').replaceChildren(...contacts.map(personRow));
  $('contacts-empty').hidden = !(loaded && everyone.length === 0);
  $('contacts-nomatch').textContent = strings['filter.noMatch'];
  $('contacts-nomatch').hidden = !(loaded && everyone.length > 0 && contacts.length === 0);
}

// Shows a message above the list. Pass retry = true to add a "Try again" button.
function setStatus(message, retry = false) {
  const el = $('contacts-status');
  el.hidden = !message;
  el.textContent = message || '';
  if (message && retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link';
    button.textContent = ` ${strings['data.retry']}`;
    button.addEventListener('click', load);
    el.append(button);
  }
}

async function load() {
  loaded = false;
  setStatus(strings['contacts.loading']);
  renderFilter();
  renderList();
  try {
    const { failed } = await store.loadAll();
    loaded = true;
    setStatus(failed ? t('data.errUnreadable', { count: failed }) : null);
  } catch (error) {
    setStatus(error.message, true);
  }
  renderFilter();
  renderList();
}

export function initContacts() {
  document.querySelectorAll('[data-action="add-contact"]').forEach((el) => {
    el.addEventListener('click', () => {
      primeKeyboard();
      location.hash = '#/add-contact';
    });
  });
  const input = $('contacts-search');
  const clear = $('search-clear');
  const update = () => {
    query = input.value.trim();
    clear.hidden = input.value === '';
    renderFilter();
    renderList();
  };
  $('filter-button').addEventListener('click', () => {
    filterOpen = !filterOpen;
    if (conditions.length) advancedOpen = true;
    renderFilter();
  });
  input.addEventListener('input', update);
  clear.addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
  document.addEventListener('folkhold:ready', load);
  // Coming back to the app after a while: bring in what changed on another device.
  let lastSync = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !store.isLoaded() || Date.now() - lastSync < 60000) return;
    lastSync = Date.now();
    store.sync().catch(() => {});
  });
  document.addEventListener('folkhold:saved', () => {
    renderFilter();
    renderList();
  });
  // Coming back from a contact page: show the latest names.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#/contacts') renderList();
  });
}
