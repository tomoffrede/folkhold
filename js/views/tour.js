// The tour: a few short cards in a pop-up (Next / Back / Skip). It is offered by a small card on Home during the
// first two visits (counted in the account's settings) and always by a button in Settings.

import { strings, t } from '../strings.js';
import * as settings from '../settings.js';
import { openModal } from './modal.js';

const $ = (id) => document.getElementById(id);
const SHOWN_VISITS = 2; // the Home card appears on this many visits
const COUNTED = 'folkhold-tour-counted';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const G = 'var(--color-primary)';
const SAND = 'var(--color-secondary)';

// Small drawn pictures, one per card (simplified on purpose: they never go out of date).
const ART = [
  // 1: type a name, tap +
  `<rect x="14" y="30" width="104" height="30" rx="10" ${S}/><text x="26" y="50" font-size="15" fill="currentColor" font-family="inherit">Anna|</text><circle cx="136" cy="45" r="14" fill="${G}"/><path d="M136 39v12M130 45h12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  // 2: a person's page
  `<circle cx="36" cy="26" r="13" fill="${SAND}" stroke="currentColor" stroke-width="2"/><rect x="58" y="16" width="60" height="8" rx="4" fill="currentColor"/><rect x="58" y="30" width="40" height="6" rx="3" fill="currentColor" opacity=".35"/><rect x="18" y="52" width="34" height="14" rx="7" fill="${SAND}" stroke="currentColor" stroke-width="1.5"/><rect x="58" y="52" width="40" height="14" rx="7" fill="${SAND}" stroke="currentColor" stroke-width="1.5"/><rect x="104" y="52" width="30" height="14" rx="7" fill="${SAND}" stroke="currentColor" stroke-width="1.5"/><rect x="18" y="74" width="116" height="6" rx="3" fill="currentColor" opacity=".25"/>`,
  // 3: a note and an event shared by two people
  `<rect x="14" y="14" width="56" height="56" rx="8" ${S}/><path d="M24 30h36M24 40h36M24 50h22" ${S}/><rect x="86" y="24" width="56" height="52" rx="8" ${S}/><path d="M86 38h56M100 18v12M128 18v12" ${S}/><circle cx="102" cy="58" r="5" fill="${G}"/><circle cx="118" cy="58" r="5" fill="${G}" opacity=".55"/>`,
  // 4: calendar with a clock
  `<rect x="16" y="16" width="84" height="64" rx="10" ${S}/><path d="M16 34h84M36 10v12M80 10v12" ${S}/><rect x="28" y="44" width="14" height="10" rx="3" fill="${G}"/><circle cx="118" cy="56" r="20" fill="var(--color-card)" stroke="currentColor" stroke-width="2"/><path d="M118 44v12l8 5" ${S}/>`,
  // 5: upcoming list
  `<rect x="14" y="12" width="132" height="22" rx="8" ${S}/><rect x="14" y="40" width="132" height="22" rx="8" ${S}/><rect x="14" y="68" width="132" height="14" rx="7" ${S} opacity=".5"/><rect x="20" y="17" width="26" height="12" rx="5" fill="${G}"/><rect x="20" y="45" width="26" height="12" rx="5" fill="${G}" opacity=".7"/><rect x="54" y="20" width="60" height="6" rx="3" fill="currentColor"/><rect x="54" y="48" width="48" height="6" rx="3" fill="currentColor"/>`,
  // 6: search and filters
  `<circle cx="62" cy="38" r="20" ${S}/><path d="M77 53l16 16" ${S} stroke-width="4"/><rect x="104" y="20" width="40" height="14" rx="7" fill="${SAND}" stroke="currentColor" stroke-width="1.5"/><rect x="104" y="40" width="32" height="14" rx="7" fill="${G}"/><rect x="104" y="60" width="38" height="14" rx="7" fill="${SAND}" stroke="currentColor" stroke-width="1.5"/>`,
  // 7: padlock
  `<rect x="52" y="38" width="56" height="42" rx="10" fill="${G}"/><path d="M62 38V30a18 18 0 0 1 36 0v8" ${S} stroke-width="4"/><circle cx="80" cy="56" r="5" fill="#fff"/><path d="M80 60v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
];

export function openTour() {
  let index = 0;
  const panel = make('div', 'modal-panel tour');
  const art = make('div', 'tour-art');
  art.setAttribute('aria-hidden', 'true');
  const title = make('h3', 'tour-title');
  const text = make('p', 'tour-text');
  const dots = make('div', 'tour-dots');
  const back = make('button', 'btn btn-secondary btn-small', strings['tour.back']);
  const next = make('button', 'btn btn-primary btn-small');
  const skip = make('button', 'link link-small', strings['tour.skip']);
  for (const b of [back, next, skip]) b.type = 'button';
  const actions = make('div', 'modal-actions tour-actions');
  actions.append(back, next);
  panel.append(art, title, text, dots, actions, skip);
  panel.setAttribute('aria-live', 'polite');
  const dialog = openModal(panel);

  function render() {
    art.innerHTML = `<svg viewBox="0 0 160 90" width="160" height="90" role="presentation">${ART[index]}</svg>`;
    title.textContent = strings[`tour.${index + 1}.title`];
    text.textContent = strings[`tour.${index + 1}.text`];
    dots.replaceChildren(...ART.map((_, i) => make('span', i === index ? 'tour-dot is-on' : 'tour-dot')));
    dots.setAttribute('aria-label', t('tour.progress', { n: index + 1, total: ART.length }));
    back.hidden = index === 0;
    next.textContent = strings[index === ART.length - 1 ? 'tour.done' : 'tour.next'];
    skip.hidden = index === ART.length - 1;
  }
  back.addEventListener('click', () => {
    index -= 1;
    render();
  });
  next.addEventListener('click', () => {
    if (index === ART.length - 1) dialog.close();
    else {
      index += 1;
      render();
    }
  });
  skip.addEventListener('click', () => dialog.close());
  render();
}

// The card on Home: counts one visit per session; shown on the first two visits unless it was dismissed or the tour was opened.
function updateCard() {
  const card = $('tour-card');
  let first = false;
  try {
    first = !sessionStorage.getItem(COUNTED);
    sessionStorage.setItem(COUNTED, '1');
  } catch {
    /* no session storage: the count simply does not grow */
  }
  let visits = Number(settings.get('tourVisits')) || 0;
  if (first) {
    visits += 1;
    settings.set('tourVisits', visits).catch(() => {});
  }
  card.hidden = settings.get('tourDone') === true || visits > SHOWN_VISITS;
  if (!card.hidden) $('a2hs-card').hidden = true; // one card at a time
}

function finishedWithCard() {
  $('tour-card').hidden = true;
  settings.set('tourDone', true).catch(() => {});
}

export function initTour() {
  $('tour-settings').addEventListener('click', openTour);
  $('tour-show').addEventListener('click', () => {
    finishedWithCard();
    openTour();
  });
  $('tour-hide').addEventListener('click', finishedWithCard);
  document.addEventListener('folkhold:data', updateCard, { once: false });
}
