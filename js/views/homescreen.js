// Help for adding Folkhold to the phone's home screen: a section in Settings, and a small card on Home
// that appears from the second visit (not when the app already runs from the home screen, and not on wide screens).

import { strings } from '../strings.js';
import { openModal } from './modal.js';

const $ = (id) => document.getElementById(id);
const VISITS = 'folkhold-visits';
const HIDDEN = 'folkhold-a2hs-hidden';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isPhone() {
  return window.matchMedia('(max-width: 799px)').matches;
}

function isApple() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function steps(title, keys) {
  const box = make('div', 'a2hs-group');
  box.append(make('h4', 'a2hs-title', strings[title]));
  const list = make('ol', 'a2hs-steps');
  keys.forEach((key) => list.append(make('li', '', strings[key])));
  box.append(list);
  return box;
}

function openHelp() {
  const panel = make('div', 'modal-panel');
  panel.append(make('h3', 'modal-title', strings['a2hs.title']), make('p', 'modal-text', strings['a2hs.intro']));
  const ios = steps('a2hs.ios', ['a2hs.ios1', 'a2hs.ios2', 'a2hs.ios3']);
  const android = steps('a2hs.android', ['a2hs.and1', 'a2hs.and2', 'a2hs.and3']);
  panel.append(...(isApple() ? [ios, android] : [android, ios]));
  const close = make('button', 'btn btn-secondary btn-small', strings['a2hs.close']);
  close.type = 'button';
  const actions = make('div', 'modal-actions');
  actions.append(close);
  panel.append(actions);
  const dialog = openModal(panel);
  close.addEventListener('click', () => dialog.close());
}

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function initHomeScreen() {
  $('a2hs-settings').addEventListener('click', openHelp);

  // Count the visits (one per browser session).
  safe(() => {
    if (!sessionStorage.getItem('folkhold-counted')) {
      sessionStorage.setItem('folkhold-counted', '1');
      localStorage.setItem(VISITS, String((Number(localStorage.getItem(VISITS)) || 0) + 1));
    }
  });
  const visits = safe(() => Number(localStorage.getItem(VISITS)) || 0, 0);
  const hidden = safe(() => localStorage.getItem(HIDDEN) === '1', false);
  const card = $('a2hs-card');
  card.hidden = !(visits >= 2 && !hidden && !isStandalone() && isPhone());
  $('a2hs-show').addEventListener('click', openHelp);
  $('a2hs-hide').addEventListener('click', () => {
    card.hidden = true;
    safe(() => localStorage.setItem(HIDDEN, '1'));
  });
}
