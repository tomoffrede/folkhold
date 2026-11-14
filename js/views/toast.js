// A short message that appears at the bottom of the screen for a few seconds, on whatever page is shown.
// action: { label, run } adds a button (for example "Undo").

let timer = null;

export function showToast(text, ms = 6000, action = null) {
  document.querySelectorAll('.toast').forEach((old) => old.remove());
  clearTimeout(timer);
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.append(Object.assign(document.createElement('span'), { textContent: text }));
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      box.remove();
      action.run();
    });
    box.append(button);
  }
  box.addEventListener('click', () => box.remove());
  document.body.append(box);
  timer = setTimeout(() => box.remove(), ms);
}
