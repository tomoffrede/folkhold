// A short message that appears at the bottom of the screen for a few seconds, on whatever page is shown.

let timer = null;

export function showToast(text, ms = 6000) {
  document.querySelectorAll('.toast').forEach((old) => old.remove());
  clearTimeout(timer);
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.textContent = text;
  box.addEventListener('click', () => box.remove());
  document.body.append(box);
  timer = setTimeout(() => box.remove(), ms);
}
