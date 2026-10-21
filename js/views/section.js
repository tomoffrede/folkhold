// A section of the contact page that can be folded: a header with the title and count, optional buttons, and the content.
// collapsible({ key, title, count, preview, defaultOpen, className }) returns the element, with
// .actionsEl (buttons shown in the header, also when folded), .bodyEl (the content) and .update({ count, preview }).
// Whether a section is open is remembered on this device (it is only a viewing preference, nothing private).

const STORE = 'folkhold-sections';

function readOpen() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
}

function writeOpen(key, open) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readOpen(), [key]: open }));
  } catch {
    // only a convenience
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function collapsible({ key, title, count = null, preview = '', defaultOpen = true, className = '' }) {
  const saved = readOpen()[key];
  let open = saved === undefined ? defaultOpen : saved;

  const element = make('div', `group sec ${className}`.trim());
  const head = make('div', 'sec-head');
  const toggle = make('button', 'sec-toggle');
  toggle.type = 'button';
  const arrow = make('span', 'sec-arrow', '▾');
  arrow.setAttribute('aria-hidden', 'true');
  const countEl = make('span', 'sec-count');
  toggle.append(arrow, make('span', 'sec-title', title), countEl);
  const actionsEl = make('div', 'sec-actions');
  head.append(toggle, actionsEl);
  const previewEl = make('p', 'sec-preview');
  const bodyEl = make('div', 'sec-body');
  element.append(head, previewEl, bodyEl);

  function refresh() {
    toggle.setAttribute('aria-expanded', String(open));
    element.classList.toggle('is-closed', !open);
    bodyEl.hidden = !open;
    previewEl.hidden = open || !previewEl.textContent;
  }
  function update(values) {
    if ('count' in values) countEl.textContent = values.count === null ? '' : ` (${values.count})`;
    if ('preview' in values) previewEl.textContent = values.preview || '';
    refresh();
  }
  toggle.addEventListener('click', () => {
    open = !open;
    writeOpen(key, open);
    refresh();
  });

  element.actionsEl = actionsEl;
  element.bodyEl = bodyEl;
  element.update = update;
  update({ count, preview });
  return element;
}
