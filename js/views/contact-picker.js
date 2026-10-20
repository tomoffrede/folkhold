// Chooses contacts: type to search (first name, last name or nickname) or tap the field to see them all.
// createPicker({ selected, locked, onChange }) returns { element, getSelected() }.
//   locked: a contact id that stays selected and cannot be removed

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import { displayName } from './contacts.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Lower case without accents, so "jose" finds "José".
function fold(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function createPicker({ selected = [], locked = null, onChange = () => {} }) {
  const ids = [...selected];
  const element = make('div', 'picker');
  const chips = make('div', 'picker-chips');
  const input = make('input', 'picker-input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.setAttribute('aria-label', strings['note.contacts']);
  const menu = make('ul', 'picker-menu');
  menu.hidden = true;
  const toggle = make('button', 'picker-toggle', '▾');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', strings['note.showContacts']);
  const field = make('div', 'picker-field');
  field.append(input, toggle, menu);
  element.append(chips, field);

  function nameOf(id) {
    const contact = store.get('contact', id);
    return contact ? displayName(contact) : '';
  }

  function renderChips() {
    chips.replaceChildren();
    ids.forEach((id) => {
      const chip = make('span', 'chip-contact');
      chip.append(make('span', '', nameOf(id)));
      if (id !== locked) {
        const remove = make('button', 'chip-remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', t('note.removeContact', { name: nameOf(id) }));
        remove.addEventListener('click', () => {
          ids.splice(ids.indexOf(id), 1);
          renderChips();
          onChange();
        });
        chip.append(remove);
      }
      chips.append(chip);
    });
    chips.hidden = ids.length === 0;
    input.placeholder = strings[ids.length ? 'note.pickerMore' : 'note.pickerFirst'];
  }

  function matches() {
    const words = fold(input.value).split(/\s+/).filter(Boolean);
    return store
      .list('contact')
      .filter((contact) => !ids.includes(contact.id))
      .filter((contact) => {
        const text = fold([contact.firstName, contact.lastName, contact.nickname].filter(Boolean).join(' '));
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => collator.compare(displayName(a), displayName(b)));
  }

  function choose(id) {
    ids.push(id);
    input.value = '';
    closeMenu();
    renderChips();
    onChange();
  }

  function openMenu() {
    menu.replaceChildren();
    const found = matches();
    if (found.length === 0) {
      menu.append(make('li', 'picker-empty', strings['note.pickerNone']));
    }
    found.forEach((contact) => {
      const item = make('li');
      const option = make('button', 'picker-option', displayName(contact));
      option.type = 'button';
      // Keep the cursor in the field while tapping an option.
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => choose(contact.id));
      item.append(option);
      menu.append(item);
    });
    menu.hidden = false;
  }

  function closeMenu() {
    menu.hidden = true;
  }

  // The arrow opens or closes the list; the cursor stays in the field.
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('pointerdown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (!menu.hidden) {
      closeMenu();
    } else {
      input.focus();
      openMenu();
    }
  });
  input.addEventListener('focus', openMenu);
  input.addEventListener('click', openMenu);
  input.addEventListener('input', openMenu);
  // A short delay, so that tapping an option (or the arrow) still counts before the list closes.
  input.addEventListener('blur', () => setTimeout(closeMenu, 200));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const first = matches()[0];
      if (first && input.value.trim()) choose(first.id);
    }
  });

  renderChips();
  return {
    element,
    getSelected: () => [...ids],
    setSelected(list) {
      ids.splice(0, ids.length, ...list.filter((id) => store.get('contact', id)));
      renderChips();
    },
  };
}
