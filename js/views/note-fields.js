// The fields of a note: title, formatted text and the optional priority. Used by the note screen and by the new-contact form.
// createNoteFields({ title, body, priority, onChange }) returns { element, get(), set(values), focus() }.

import { strings } from '../strings.js';
import { createEditor } from './rich-editor.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createNoteFields({ title = '', body = [], priority = 0, onChange = () => {} } = {}) {
  const element = make('div', 'form');

  const titleLabel = make('label', 'field');
  const titleInput = make('input');
  titleInput.type = 'text';
  titleInput.autocomplete = 'off';
  titleInput.placeholder = strings['note.titlePlaceholder'];
  titleInput.setAttribute('aria-label', strings['note.titlePlaceholder']);
  titleInput.value = title;
  titleInput.addEventListener('input', () => onChange());
  titleLabel.append(titleInput);

  const editor = createEditor({
    placeholder: strings['note.textPlaceholder'],
    label: strings['note.text'],
    buttonLabels: { bold: strings['note.bold'], italic: strings['note.italic'], underline: strings['note.underline'] },
    onInput: () => onChange(),
  });
  editor.setBody(body);

  // Priority: tap a level to choose it, tap it again to clear it.
  let current = priority || 0;
  const row = make('div', 'prio-row');
  row.append(make('span', 'prio-label', strings['note.priority']));
  const buttons = [1, 2, 3].map((level) => {
    const button = make('button', `chip prio-chip prio-${level}`, strings[`note.priority${level}`]);
    button.type = 'button';
    button.addEventListener('click', () => {
      current = current === level ? 0 : level;
      refresh();
      onChange();
    });
    row.append(button);
    return button;
  });
  function refresh() {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(current === index + 1)));
  }
  refresh();

  element.append(titleLabel, editor.element, row);

  return {
    element,
    get: () => ({ title: titleInput.value.trim(), body: editor.getBody(), priority: current }),
    set(values) {
      titleInput.value = values.title || '';
      editor.setBody(values.body || []);
      current = values.priority || 0;
      refresh();
    },
    focus: () => editor.focus(),
  };
}
