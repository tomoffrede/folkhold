// The contacts list and the quick-add form.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as settings from '../settings.js';
import * as tags from '../tags.js';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

let loaded = false;
const selected = new Set(); // tags the list is filtered by
let matchAll = true; // true: a contact needs all the selected tags; false: any one of them
let filterOpen = false;

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

function renderList() {
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
