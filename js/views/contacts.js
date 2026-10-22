// The contacts list and the quick-add form.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as tags from '../tags.js';
import { search } from '../search.js';
import { formatDate } from '../dates.js';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

let loaded = false;
const selected = new Set(); // tags the list is filtered by
let matchAll = true; // true: a contact needs all the selected tags; false: any one of them
let filterOpen = false;
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

  row.append(avatar, text);
  item.append(row);
  return item;
}

// What the list is sorted by: the full name, or (in Settings) the last name first.
function sortName(contact) {
  if (settings.get('contactSort') === 'last') {
    const last = contact.lastName || contact.firstName || contact.nickname || '';
    return `${last} ${contact.firstName || ''}`;
  }
  return displayName(contact);
}

function renderFilter() {
  const box = $('contacts-filter');
  if (query) {
    box.hidden = true;
    return;
  }
  const used = tags.inUse();
  [...selected].forEach((id) => {
    if (!used.some((tag) => tag.id === id)) selected.delete(id);
  });
  box.hidden = used.length === 0;
  box.replaceChildren();
  if (used.length === 0) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-secondary btn-small filter-toggle';
  toggle.textContent = selected.size ? t('tags.filterCount', { n: selected.size }) : strings['tags.filter'];
  toggle.setAttribute('aria-expanded', String(filterOpen));
  toggle.addEventListener('click', () => {
    filterOpen = !filterOpen;
    renderFilter();
  });
  box.append(toggle);
  if (selected.size) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'link';
    clear.textContent = strings['tags.clear'];
    clear.addEventListener('click', () => {
      selected.clear();
      renderFilter();
      renderList();
    });
    box.append(clear);
  }
  if (!filterOpen) return;

  const chips = document.createElement('div');
  chips.className = 'prio-row filter-chips';
  used.forEach((tag) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip prio-chip';
    chip.textContent = tag.name;
    chip.setAttribute('aria-pressed', String(selected.has(tag.id)));
    chip.addEventListener('click', () => {
      if (selected.has(tag.id)) selected.delete(tag.id);
      else selected.add(tag.id);
      renderFilter();
      renderList();
    });
    chips.append(chip);
  });
  box.append(chips);

  if (selected.size >= 2) {
    const mode = document.createElement('div');
    mode.className = 'tag-mode';
    const label = document.createElement('span');
    label.className = 'tag-mode-label';
    label.textContent = strings['tags.matchLabel'];
    const group = document.createElement('div');
    group.className = 'segmented';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', strings['tags.matchLabel']);
    [[true, strings['tags.matchAll']], [false, strings['tags.matchAny']]].forEach(([value, text]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.setAttribute('aria-pressed', String(matchAll === value));
      button.addEventListener('click', () => {
        matchAll = value;
        renderFilter();
        renderList();
      });
      group.append(button);
    });
    mode.append(label, group);
    box.append(mode);
  }
}

// Used from a contact's page: show only the contacts with this tag.
export function filterByTag(id) {
  selected.clear();
  selected.add(id);
  filterOpen = true;
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
  const contacts = found.contacts.sort((a, b) => collator.compare(sortName(a), sortName(b)));
  group('search.contacts', contacts.length, [Object.assign(document.createElement('ul'), { className: 'people' })]);
  box.querySelector('ul.people')?.append(...contacts.map(personRow));
  const noteNodes = found.notes.map(({ item, snippet }) => {
    const first = (item.contactIds || [])[0];
    return resultLink(`#/note/${item.id}/${first}`, item.title || strings['search.untitledNote'], snippet, namesOf(item).join(', '));
  });
  group('search.notes', noteNodes.length, noteNodes);
  const eventNodes = found.events.map(({ item, snippet }) => {
    const first = (item.contactIds || [])[0];
    return resultLink(`#/event/${item.id}/${first}`, `${item.title || strings['event.untitled']} · ${formatDate(item.date)}`, item.details ? snippet : '', namesOf(item).join(', '));
  });
  group('search.events', eventNodes.length, eventNodes);
  if (!contacts.length && !noteNodes.length && !eventNodes.length) {
    const none = document.createElement('p');
    none.className = 'empty';
    none.textContent = strings['search.none'];
    box.append(none);
  }
}

function renderList() {
  if (query) {
    renderSearch();
    return;
  }
  $('search-results').hidden = true;
  $('contacts-list').hidden = false;
  const everyone = store.list('contact');
  const contacts = everyone
    .filter((contact) => {
      if (selected.size === 0) return true;
      const own = contact.tagIds || [];
      const test = (id) => own.includes(id);
      return matchAll ? [...selected].every(test) : [...selected].some(test);
    })
    .sort((a, b) => collator.compare(sortName(a), sortName(b)));
  $('contacts-list').replaceChildren(...contacts.map(personRow));
  $('contacts-empty').hidden = !(loaded && everyone.length === 0);
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
      location.hash = '#/add-contact';
    });
  });
  const input = $('contacts-search');
  input.addEventListener('input', () => {
    query = input.value.trim();
    renderFilter();
    renderList();
  });
  document.addEventListener('folkhold:ready', load);
  document.addEventListener('folkhold:saved', () => {
    renderFilter();
    renderList();
  });
  // Coming back from a contact page: show the latest names.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#/contacts') renderList();
  });
}
