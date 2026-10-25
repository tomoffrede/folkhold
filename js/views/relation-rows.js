// The relationship rows of the contact page: the editor rows (a label menu and a person field) and the read-only section.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as relations from '../relations.js';
import { collapsible } from './section.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

// The group for the label menu (see contact-page.js: labelOptions and toggleMenu use "labels" and "key").
export const RELATION_GROUP = { key: 'relations', labels: relations.standardLabels() };

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const nameOf = (contact) => [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.nickname || '';
const fold = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ---------- the editor ----------

function labelBox(entry) {
  const box = make('div', 'label-box');
  box.dataset.group = RELATION_GROUP.key;
  const input = make('input', 'entry-label');
  input.type = 'text';
  input.autocomplete = 'off';
  input.value = relations.labelText(entry);
  input.placeholder = strings['rel.labelPlaceholder'];
  input.setAttribute('aria-label', strings['rel.labelPlaceholder']);
  const toggle = make('button', 'label-toggle', '▾');
  toggle.type = 'button';
  toggle.dataset.act = 'labels';
  toggle.setAttribute('aria-label', strings['contact.showLabels']);
  toggle.setAttribute('aria-expanded', 'false');
  box.append(input, toggle);
  return box;
}

function closeMenu(row) {
  row.querySelectorAll('.rel-menu').forEach((menu) => menu.remove());
}

// Shows the person that was chosen. state: 'contact' (an existing contact), 'name' (just a name) or 'create' (a contact made when saving).
function setPerson(row, state, text, contactId) {
  const person = row.querySelector('.rel-person');
  row.dataset.state = state;
  if (contactId) row.dataset.contactId = contactId;
  else delete row.dataset.contactId;
  person.value = text;
  row.querySelector('.rel-badge').hidden = state !== 'create';
  row.querySelector('.rel-edit').hidden = true;
  closeMenu(row);
}

// A choice was made without typing: tell the page, so it saves.
function announce(row) {
  const person = row.querySelector('.rel-person');
  person.dataset.programmatic = '1';
  person.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(row, choice, defer) {
  if (choice.type === 'contact') setPerson(row, 'contact', choice.name, choice.id);
  else if (choice.type === 'name') setPerson(row, 'name', choice.name);
  else if (defer) setPerson(row, 'create', choice.name); // a new-contact form: the contact is made when it is saved
  else {
    setPerson(row, 'name', choice.name);
    relations.createContact(choice.name).then((id) => {
      if (row.isConnected && row.querySelector('.rel-person').value === choice.name) {
        setPerson(row, 'contact', choice.name, id);
        const edit = row.querySelector('.rel-edit'); // the new contact can be opened right away
        edit.href = `#/contact/${id}/edit`;
        edit.hidden = false;
        announce(row);
      }
    });
  }
  announce(row);
}

function showMenu(row, selfId, defer) {
  closeMenu(row);
  const person = row.querySelector('.rel-person');
  const text = person.value.trim();
  if (!text) return;
  const wanted = fold(text);
  const matches = store
    .list('contact')
    .filter((contact) => contact.id !== selfId && fold(`${nameOf(contact)} ${contact.nickname || ''}`).includes(wanted))
    .sort((a, b) => collator.compare(nameOf(a), nameOf(b)))
    .slice(0, 6);

  const menu = make('ul', 'label-menu rel-menu');
  const add = (label, choice, className = '') => {
    const item = make('li');
    const button = make('button', `label-option ${className}`.trim(), label);
    button.type = 'button';
    button.addEventListener('click', () => choose(row, choice, defer));
    item.append(button);
    menu.append(item);
  };
  matches.forEach((contact) => add(contact.nickname && nameOf(contact) !== contact.nickname ? `${nameOf(contact)} “${contact.nickname}”` : nameOf(contact), { type: 'contact', id: contact.id, name: nameOf(contact) }));
  // These two are always offered: two different people can have the same name.
  add(t('rel.justName', { name: text }), { type: 'name', name: text }, 'rel-just');
  add(t('rel.create', { name: text }), { type: 'create', name: text }, 'rel-create');
  row.querySelector('.rel-field').append(menu);
}

function personField(row, entry, selfId, defer) {
  const field = make('div', 'rel-field');
  const person = make('input', 'entry-value rel-person');
  person.type = 'text';
  person.autocomplete = 'off';
  person.autocapitalize = 'words';
  person.placeholder = strings['rel.personPlaceholder'];
  person.setAttribute('aria-label', strings['rel.personPlaceholder']);
  const badge = make('span', 'rel-badge', strings['rel.newBadge']);
  badge.hidden = true;
  const edit = make('a', 'rel-edit', strings['rel.editDetails']);
  edit.hidden = true;
  field.append(person, badge, edit);
  row.append(field);

  const target = entry.contactId ? store.get('contact', entry.contactId) : null;
  if (target) setPerson(row, 'contact', nameOf(target), target.id);
  else if (entry.name) setPerson(row, 'name', entry.name);

  person.addEventListener('input', (event) => {
    if (person.dataset.programmatic) {
      delete person.dataset.programmatic;
      return;
    }
    // Typing again: whatever was chosen before no longer counts, and the suggestions are shown.
    delete row.dataset.state;
    delete row.dataset.contactId;
    badge.hidden = true;
    edit.hidden = true;
    showMenu(row, selfId, defer);
  });
  person.addEventListener('focus', () => {
    if (person.value.trim() && !row.dataset.state) showMenu(row, selfId, defer);
  });
  person.addEventListener('keydown', (event) => {
    const options = [...row.querySelectorAll('.rel-menu .label-option')];
    if (event.key === 'Enter') {
      event.preventDefault();
      if (person.value.trim()) choose(row, { type: 'name', name: person.value.trim() }, defer);
    } else if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'Escape') closeMenu(row);
  });
  field.addEventListener('keydown', (event) => {
    if (event.target === person) return;
    const options = [...field.querySelectorAll('.label-option')];
    const at = options.indexOf(event.target);
    if (event.key === 'ArrowDown' && at < options.length - 1) {
      event.preventDefault();
      options[at + 1].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      (at > 0 ? options[at - 1] : person).focus();
    }
  });
  return field;
}

// One editable row. "defer": in the new-contact form, "create contact" waits until the form is saved.
export function relationRow(entry = {}, selfId = null, defer = false) {
  const row = make('div', 'entry rel-entry');
  row.dataset.relId = entry.id || relations.newId();
  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove';
  remove.setAttribute('aria-label', strings['contact.remove']);
  row.append(labelBox(entry));
  personField(row, entry, selfId, defer);
  row.append(remove);
  return row;
}

// A relationship saved on the other contact: shown here the other way round. It can be removed, but not edited.
function inboundRow(item) {
  const row = make('div', 'entry rel-inbound');
  row.dataset.owner = item.ownerId;
  row.dataset.relId = item.relId;
  const link = make('a', 'rel-static info-link', item.name);
  link.href = `#/contact/${item.contactId}`;
  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove';
  remove.setAttribute('aria-label', strings['contact.remove']);
  row.append(make('span', 'rel-static rel-static-label', item.label), link, remove);
  return row;
}

export function relationBlock(contact, defer) {
  const block = make('div', 'group');
  block.dataset.group = RELATION_GROUP.key;
  const list = make('div', 'entries');
  (contact.relations || []).forEach((entry) => list.append(relationRow(entry, contact.id, defer)));
  if (contact.id) {
    relations
      .listFor(contact)
      .filter((item) => !item.own)
      .forEach((item) => list.append(inboundRow(item)));
  }
  block.hidden = !list.children.length;
  block.append(make('h3', 'group-title', strings['contact.relations']), list);
  return block;
}

// What the editor shows as saved relationships on this contact (the ones that are stored on it).
export function readRelations(page) {
  const list = [];
  page.querySelectorAll('[data-group="relations"] .rel-entry').forEach((row) => {
    const text = row.querySelector('.rel-person').value.trim();
    if (!text) return;
    const label = row.querySelector('.entry-label').value.trim();
    const kind = relations.kindOf(label);
    const entry = { id: row.dataset.relId };
    if (kind) entry.kind = kind;
    else if (label) entry.label = label;
    if (row.dataset.state === 'contact' && row.dataset.contactId) entry.contactId = row.dataset.contactId;
    else {
      entry.name = text;
      if (row.dataset.state === 'create') entry.create = true;
    }
    list.push(entry);
  });
  return list;
}

// ---------- the read-only section ----------

export function renderRelationsSection(contact, refresh) {
  const rows = relations.listFor(contact);
  if (!rows.length) return null;
  const section = collapsible({ key: 'relations', title: strings['contact.relations'], count: rows.length, defaultOpen: true, className: 'relations' });
  rows.forEach((item) => {
    const row = make('div', 'info-item');
    if (item.label) row.append(make('span', 'info-label', item.label));
    if (item.contactId) {
      const link = make('a', 'info-value info-link', item.name);
      link.href = `#/contact/${item.contactId}`;
      row.append(link);
    } else {
      row.append(make('span', 'info-value', item.name));
      const make_ = make('button', 'link rel-make', strings['rel.makeContact']);
      make_.type = 'button';
      make_.addEventListener('click', () => {
        make_.disabled = true;
        relations.makeContact(item.ownerId, item.relId).then(refresh, () => (make_.disabled = false));
      });
      row.append(make_);
    }
    section.bodyEl.append(row);
  });
  return section;
}
