// The "Notes" part of a contact's reading page.

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import * as rich from '../richtext.js';
import { displayName } from './contacts.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(time) {
  return time ? new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function noteCard(note, contact) {
  const card = make('a', 'note-card');
  card.href = `#/note/${note.id}/${contact.id}`;
  if (note.title) card.append(make('h4', 'note-title', note.title));

  const body = make('div', 'note-body');
  body.append(rich.renderBody(note.body || []));
  card.append(body);

  const others = (note.contactIds || [])
    .filter((id) => id !== contact.id)
    .map((id) => store.get('contact', id))
    .filter(Boolean)
    .map(displayName);
  const parts = [formatDate(note.createdAt)];
  if (others.length) parts.push(t('notes.alsoOn', { names: others.join(', ') }));
  card.append(make('p', 'note-meta', parts.filter(Boolean).join(' · ')));
  return card;
}

export function renderNotesSection(contact) {
  const section = make('div', 'group notes');

  const head = make('div', 'notes-head');
  head.append(make('h3', 'group-title', strings['notes.title']));
  const add = make('a', 'btn btn-secondary btn-small', strings['notes.add']);
  add.href = `#/add-note/${contact.id}`;
  head.append(add);
  section.append(head);

  const list = notes.listFor(contact.id);
  if (list.length === 0) section.append(make('p', 'empty', strings['notes.empty']));
  list.forEach((note) => section.append(noteCard(note, contact)));
  return section;
}
