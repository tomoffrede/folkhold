// A small text editor with Bold, Italic and Underline buttons. Used for notes.
// createEditor({ placeholder, label, buttonLabels, onInput }) returns { element, getBody(), setBody(lines), focus() }.
// The text is read and saved as plain lines with style numbers (see richtext.js), never as HTML.

import { readBody, fillEditor } from '../richtext.js';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createEditor({ placeholder, label, buttonLabels, onInput = () => {} }) {
  const element = make('div', 'rt');
  const toolbar = make('div', 'rt-toolbar');
  toolbar.setAttribute('role', 'toolbar');

  const editor = make('div', 'rt-editor');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');
  editor.setAttribute('aria-label', label);
  editor.dataset.placeholder = placeholder;

  const buttons = [
    ['bold', 'B', buttonLabels.bold],
    ['italic', 'I', buttonLabels.italic],
    ['underline', 'U', buttonLabels.underline],
  ].map(([command, face, name]) => {
    const button = make('button', `rt-btn rt-${command}`);
    button.append(make(command === 'bold' ? 'b' : command === 'italic' ? 'i' : 'u', '', face));
    button.type = 'button';
    button.title = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', 'false');
    // The format is applied the moment the button is touched, and the button never takes the selection away
    // (on an iPhone a normal tap first moved the selection, so it took several taps).
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      apply(command);
    });
    button.addEventListener('click', (event) => {
      if (event.detail === 0) apply(command); // a click made with the keyboard (Enter or Space)
    });
    toolbar.append(button);
    return { command, button };
  });

  // Remembers the last selection inside the text, in case the browser drops it when a button is touched.
  let savedRange = null;
  function inside() {
    const selection = document.getSelection();
    return selection.rangeCount > 0 && editor.contains(selection.anchorNode);
  }
  function apply(command) {
    if (!inside()) {
      editor.focus();
      if (savedRange) {
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
    }
    document.execCommand(command);
    refreshButtons();
    onInput();
  }

  // Shows which formats are on at the cursor.
  function refreshButtons() {
    const inside = editor.contains(document.getSelection().anchorNode);
    buttons.forEach(({ command, button }) => {
      button.setAttribute('aria-pressed', inside && document.queryCommandState(command) ? 'true' : 'false');
    });
  }
  document.addEventListener('selectionchange', () => {
    if (!element.isConnected) return;
    if (inside()) savedRange = document.getSelection().getRangeAt(0).cloneRange();
    refreshButtons();
  });
  // Ctrl+B, Ctrl+I, Ctrl+U (Cmd on a Mac).
  editor.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
    const command = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()];
    if (!command) return;
    event.preventDefault();
    apply(command);
  });

  editor.addEventListener('focus', () => {
    document.execCommand('styleWithCSS', false, false); // use <b>, <i>, <u> rather than style attributes
  });
  // Enter always makes a simple line break, the same in every browser.
  editor.addEventListener('beforeinput', (event) => {
    if (event.inputType === 'insertParagraph') {
      event.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });
  editor.addEventListener('input', () => {
    // Browsers leave a stray line break behind when everything is deleted; remove it so the hint shows again.
    if (!editor.textContent) editor.replaceChildren();
    onInput();
  });
  // Pasting and dropping bring in plain text only (no pictures, fonts or colours).
  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  editor.addEventListener('drop', (event) => event.preventDefault());

  element.append(toolbar, editor);

  return {
    element,
    getBody: () => readBody(editor),
    setBody: (lines) => fillEditor(editor, lines),
    focus: () => editor.focus(),
  };
}
