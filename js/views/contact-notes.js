// The "Notes" part of a contact's reading page, including the "Arrange" mode (up and down arrows).

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

function cardContent(card, note, contact) {
  if (note.priority) card.append(make('span', `note-priority prio-${note.priority}`, strings[`note.priority${note.priority}`]));
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
}

function arrow(text, label, disabled, onClick) {
  const button = make('button', 'move-btn', text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

export function renderNotesSection(contact) {
  let arranging = false;
  const section = make('div', 'group notes');

  function build() {
    section.replaceChildren();
    const list = notes.listFor(contact.id);
    if (list.length < 2) arranging = false;

    const head = make('div', 'notes-head');
    head.append(make('h3', 'group-title', strings['notes.title']));
    const buttons = make('div', 'notes-buttons');
    if (list.length >= 2) {
      const arrange = make('button', 'btn btn-secondary btn-small', strings[arranging ? 'notes.arrangeDone' : 'notes.arrange']);
      arrange.type = 'button';
      arrange.addEventListener('click', () => {
        arranging = !arranging;
        build();
      });
      buttons.append(arrange);
    }
    if (!arranging) {
      const add = make('a', 'btn btn-secondary btn-small', strings['notes.add']);
      add.href = `#/add-note/${contact.id}`;
      buttons.append(add);
    }
    head.append(buttons);
    section.append(head);

    if (list.length === 0) section.append(make('p', 'empty', strings['notes.empty']));
    if (arranging) section.append(make('p', 'hint', strings['notes.arrangeHint']));

    list.forEach((note, index) => {
      if (!arranging) {
        const card = make('a', 'note-card');
        card.href = `#/note/${note.id}/${contact.id}`;
        cardContent(card, note, contact);
        section.append(card);
        return;
      }
      const same = (other) => other && (other.priority || 0) === (note.priority || 0);
      const row = make('div', 'note-row');
      const card = make('div', 'note-card');
      cardContent(card, note, contact);
      const move = async (step) => {
        try {
          await notes.move(contact.id, note.id, step);
        } finally {
          build();
        }
      };
      row.append(
        card,
        make('div', 'move-col'),
      );
      row.lastChild.append(
        arrow('▲', strings['notes.moveUp'], !same(list[index - 1]), () => move(-1)),
        arrow('▼', strings['notes.moveDown'], !same(list[index + 1]), () => move(1)),
      );
      section.append(row);
    });
  }

  build();
  return section;
}
