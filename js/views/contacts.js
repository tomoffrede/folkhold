// The contacts list and the quick-add form.

import { strings, t } from '../strings.js';
import * as store from '../store.js';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

let loaded = false;

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

function renderList() {
  const contacts = store
    .list('contact')
    .sort((a, b) => collator.compare(displayName(a), displayName(b)));
  $('contacts-list').replaceChildren(...contacts.map(personRow));
  $('contacts-empty').hidden = !(loaded && contacts.length === 0);
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
  renderList();
  try {
    const { failed } = await store.loadAll();
    loaded = true;
    setStatus(failed ? t('data.errUnreadable', { count: failed }) : null);
  } catch (error) {
    setStatus(error.message, true);
  }
  renderList();
}

function showFormError(message) {
  const el = $('contact-error');
  el.textContent = message || '';
  el.hidden = !message;
}

function bindForm() {
  const form = $('contact-form');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = {};
    for (const [key, id] of [
      ['firstName', 'contact-first'],
      ['lastName', 'contact-last'],
      ['nickname', 'contact-nick'],
    ]) {
      const value = $(id).value.trim();
      if (value) fields[key] = value;
    }
    if (Object.keys(fields).length === 0) {
      showFormError(strings['addContact.errNeedName']);
      return;
    }

    const button = form.querySelector('[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = strings['auth.working'];
    showFormError(null);
    try {
      await store.add('contact', fields);
      renderList();
      location.hash = '#/contacts';
    } catch (error) {
      showFormError(error.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  // Opening the form starts empty, with the cursor in the first field.
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#/add-contact') return;
    form.reset();
    showFormError(null);
    $('contact-first').focus();
  });
}

export function initContacts() {
  document.querySelectorAll('[data-action="add-contact"]').forEach((el) => {
    el.addEventListener('click', () => {
      location.hash = '#/add-contact';
    });
  });
  bindForm();
  document.addEventListener('folkhold:ready', load);
  document.addEventListener('folkhold:saved', renderList);
  // Coming back from a contact page: show the latest names.
  window.addEventListener('hashchange', () => {
    if (location.hash === '#/contacts') renderList();
  });
}
