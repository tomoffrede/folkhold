// The "Notes" part of a contact's reading page, including the "Arrange" mode (up and down arrows).

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import * as rich from '../richtext.js';
import { displayName } from './contacts.js';
import { collapsible } from './section.js';

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
  const section = collapsible({ key: 'notes', title: strings['notes.title'], className: 'notes' });
  const { actionsEl, bodyEl } = section;

  function build() {
    bodyEl.replaceChildren();
    actionsEl.replaceChildren();
    const list = notes.listFor(contact.id);
    if (list.length < 2) arranging = false;
    section.update({ count: list.length });

    if (list.length >= 2) {
      const arrange = make('button', 'btn btn-secondary btn-small', strings[arranging ? 'notes.arrangeDone' : 'notes.arrange']);
      arrange.type = 'button';
      arrange.addEventListener('click', () => {
        arranging = !arranging;
        build();
      });
      actionsEl.append(arrange);
    }
    if (!arranging) {
      const add = make('a', 'btn btn-secondary btn-small', strings['notes.add']);
      add.href = `#/add-note/${contact.id}`;
      actionsEl.append(add);
    }

    if (list.length === 0) bodyEl.append(make('p', 'empty', strings['notes.empty']));
    if (arranging) bodyEl.append(make('p', 'hint', strings['notes.arrangeHint']));

    list.forEach((note, index) => {
      if (!arranging) {
        const card = make('a', 'note-card');
        card.href = `#/note/${note.id}/${contact.id}`;
        cardContent(card, note, contact);
        bodyEl.append(card);
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
      const column = make('div', 'move-col');
      column.append(
        arrow('▲', strings['notes.moveUp'], !same(list[index - 1]), () => move(-1)),
        arrow('▼', strings['notes.moveDown'], !same(list[index + 1]), () => move(1)),
      );
      row.append(card, column);
      bodyEl.append(row);
    });
  }

  build();
  return section;
}
