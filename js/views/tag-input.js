// Adding tags to a contact: the chosen tags as chips, and a field that suggests your existing tags and can make a new one.
// createTagInput({ tagIds, immediate, onChange }) returns { element, ids(), count(), resolve() }.
//   immediate: make a new tag the moment it is added (used while editing, which saves by itself).
//   Otherwise new tags are only made when resolve() is called (used by the new-contact form, when Save is pressed).

import { strings, t } from '../strings.js';
import * as tags from '../tags.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function createTagInput({ tagIds = [], immediate = false, onChange = () => {} } = {}) {
  const entries = tagIds.map((id) => tags.get(id)).filter(Boolean).map((tag) => ({ id: tag.id, name: tag.name }));

  const element = make('div', 'picker tag-input');
  const chips = make('div', 'picker-chips');
  const field = make('div', 'picker-field');
  const input = make('input', 'picker-input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = strings['tags.placeholder'];
  input.setAttribute('aria-label', strings['tags.label']);
  const toggle = make('button', 'picker-toggle', '▾');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', strings['tags.show']);
  const menu = make('ul', 'picker-menu');
  menu.hidden = true;
  field.append(input, toggle, menu);
  element.append(chips, field);

  const has = (name) => entries.some((entry) => entry.name.toLowerCase() === name.toLowerCase());

  function renderChips() {
    chips.replaceChildren();
    entries.forEach((entry) => {
      const chip = make('span', 'chip-contact tag-chip');
      chip.append(make('span', '', entry.name));
      const remove = make('button', 'chip-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', t('tags.remove', { name: entry.name }));
      remove.addEventListener('click', () => {
        entries.splice(entries.indexOf(entry), 1);
        renderChips();
        onChange();
      });
      chip.append(remove);
      chips.append(chip);
    });
    chips.hidden = entries.length === 0;
  }

  async function add(name) {
    const clean = tags.clean(name);
    if (!clean || has(clean)) return;
    const existing = tags.findByName(clean);
    const entry = { id: existing ? existing.id : null, name: existing ? existing.name : clean };
    entries.push(entry);
    input.value = '';
    closeMenu();
    renderChips();
    if (immediate && !entry.id) {
      try {
        entry.id = await tags.create(entry.name);
      } catch {
        entries.splice(entries.indexOf(entry), 1);
        renderChips();
        return;
      }
    }
    onChange();
  }

  function openMenu() {
    menu.replaceChildren();
    const typed = tags.clean(input.value);
    const words = fold(typed).split(' ').filter(Boolean);
    const found = tags.list().filter((tag) => !has(tag.name) && words.every((word) => fold(tag.name).includes(word)));
    found.forEach((tag) => {
      const item = make('li');
      const option = make('button', 'picker-option', tag.name);
      option.type = 'button';
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => add(tag.name));
      item.append(option);
      menu.append(item);
    });
    if (typed && !tags.findByName(typed) && !has(typed)) {
      const item = make('li');
      const option = make('button', 'picker-option picker-create', t('tags.create', { name: typed }));
      option.type = 'button';
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('pointerdown', (event) => event.preventDefault());
      option.addEventListener('click', () => add(typed));
      item.append(option);
      menu.append(item);
    }
    if (!menu.children.length) menu.append(make('li', 'picker-empty', strings['tags.none']));
    active = -1;
    menu.hidden = false;
  }

  function closeMenu() {
    menu.hidden = true;
    active = -1;
  }

  // Keyboard: arrows move through the suggestions, Enter picks the highlighted one.
  let active = -1;
  function options() {
    return [...menu.querySelectorAll('.picker-option')];
  }
  function highlight(index) {
    const list = options();
    if (!list.length) return;
    active = (index + list.length) % list.length;
    list.forEach((option, i) => option.classList.toggle('is-active', i === active));
    list[active].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', openMenu);
  input.addEventListener('click', openMenu);
  input.addEventListener('input', openMenu);
  input.addEventListener('blur', () => setTimeout(closeMenu, 200));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (menu.hidden) openMenu();
      highlight(active < 0 ? (event.key === 'ArrowDown' ? 0 : -1) : active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' || (event.key === ',' && active < 0)) {
      event.preventDefault();
      const picked = !menu.hidden && active >= 0 ? options()[active] : null;
      if (picked) picked.click();
      else add(input.value);
    } else if (event.key === 'Backspace' && !input.value && entries.length) {
      entries.pop();
      renderChips();
      onChange();
    }
  });
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('pointerdown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (!menu.hidden) closeMenu();
    else {
      input.focus();
      openMenu();
    }
  });

  renderChips();

  return {
    element,
    ids: () => entries.filter((entry) => entry.id).map((entry) => entry.id),
    count: () => entries.length,
    // Makes the tags that do not exist yet. Call before saving.
    async resolve() {
      for (const entry of entries) {
        if (!entry.id) entry.id = await tags.create(entry.name);
      }
    },
  };
}
