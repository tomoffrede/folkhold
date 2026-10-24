// Centered pop-up windows for questions. A click outside the window, or the Escape key, cancels.

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Lets a <dialog> that is already in the page close when the dimmed area outside it is clicked.
export function closeOnOutsideClick(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

// Shows any content in a pop-up. Returns the dialog (call .close() to close it).
export function openModal(content, onClose) {
  const dialog = make('dialog', 'modal');
  dialog.append(content);
  document.body.append(dialog);
  closeOnOutsideClick(dialog);
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (onClose) onClose();
  });
  dialog.showModal();
  return dialog;
}

// A yes/no question. Resolves true for "yes" and false for everything else (No, outside click, Escape).
export function confirmModal({ text, yes, no, danger = true }) {
  return new Promise((resolve) => {
    let answer = false;
    const panel = make('div', 'modal-panel');
    const yesButton = make('button', `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-small`, yes);
    const noButton = make('button', 'btn btn-secondary btn-small', no);
    yesButton.type = 'button';
    noButton.type = 'button';
    const actions = make('div', 'modal-actions');
    actions.append(yesButton, noButton);
    panel.append(make('p', 'modal-text', text), actions);
    const dialog = openModal(panel, () => resolve(answer));
    yesButton.addEventListener('click', () => {
      answer = true;
      dialog.close();
    });
    noButton.addEventListener('click', () => dialog.close());
    noButton.focus();
  });
}
