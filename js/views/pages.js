// The information pages (About, Data privacy explained, Privacy policy, Impressum).
// They can be opened before signing in, so they sit outside the app and the sign-in screens: #/about, #/data-privacy, #/privacy, #/impressum

import { strings } from '../strings.js';
import { PAGES } from '../pages.js';
import { PAGES_DE } from '../pages-de.js';
import { OWNER, REPO_URL, LAST_UPDATED } from '../owner.js';

const $ = (id) => document.getElementById(id);
let backTo = '';

function pageKey() {
  const key = location.hash.replace('#/', '');
  return PAGES[key] ? key : null;
}

function fill(text) {
  return text.replaceAll('{name}', OWNER.name).replaceAll('{email}', OWNER.email).replaceAll('{repo}', REPO_URL).replaceAll('{updated}', fill.german ? germanDate(LAST_UPDATED) : LAST_UPDATED);
}

// Privacy policy and Impressum exist in German and English. German for browsers set to German, English for everyone else, until the visitor picks one.
const LEGAL = ['privacy', 'impressum'];
const MONTHS_DE = { January: 'Januar', February: 'Februar', March: 'März', April: 'April', May: 'Mai', June: 'Juni', July: 'Juli', August: 'August', September: 'September', October: 'Oktober', November: 'November', December: 'Dezember' };

function legalLang() {
  try {
    const saved = localStorage.getItem('folkhold-legal-lang');
    if (saved === 'de' || saved === 'en') return saved;
  } catch (error) {
    // storage not available: fall back to the browser language
  }
  return (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
}

function germanDate(text) {
  return text.replace(/^(\d+) (\w+) (\d+)$/, (all, d, m, y) => (MONTHS_DE[m] ? `${d}. ${MONTHS_DE[m]} ${y}` : all));
}

function render(key) {
  const german = LEGAL.includes(key) && legalLang() === 'de';
  fill.german = german;
  const page = german ? PAGES_DE[key] : PAGES[key];
  const article = $('page-content');
  article.replaceChildren();
  if (LEGAL.includes(key)) {
    const switcher = document.createElement('p');
    switcher.className = 'lang-switch no-print';
    [['de', 'Deutsch'], ['en', 'English']].forEach(([code, label], index) => {
      if (index) switcher.append(' · ');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'link';
      button.textContent = label;
      if ((code === 'de') === german) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => {
        try {
          localStorage.setItem('folkhold-legal-lang', code);
        } catch (error) {
          // not saved: the choice only lasts for this page view
        }
        render(key);
      });
      switcher.append(button);
    });
    article.append(switcher);
  }
  article.lang = german ? 'de' : 'en';
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = page.title;
  if (key === 'about') {
    const logo = document.createElement('img');
    logo.className = 'about-logo';
    logo.src = 'icons/logo.svg';
    logo.alt = '';
    logo.width = 72;
    logo.height = 72;
    article.append(logo);
  }
  article.append(title);
  page.blocks.forEach(([kind, value]) => {
    if (kind === 'h') {
      const heading = document.createElement('h3');
      heading.className = 'page-heading';
      heading.textContent = fill(value);
      article.append(heading);
    } else if (kind === 'p') {
      const p = document.createElement('p');
      p.textContent = fill(value);
      article.append(p);
    } else {
      const list = document.createElement('ul');
      list.className = 'page-list';
      value.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = fill(item);
        list.append(li);
      });
      article.append(list);
    }
  });
  document.title = `${page.title} · Folkhold`;
  window.scrollTo(0, 0);
}

function update(event) {
  const key = pageKey();
  if (key) {
    // Remember where the visitor came from, unless they moved from one information page to another.
    if (event && event.oldURL) {
      const before = `#${event.oldURL.split('#')[1] || ''}`;
      if (!PAGES[before.replace('#/', '')]) backTo = before === '#' ? '' : before;
    }
    render(key);
    $('pages-root').hidden = false;
    document.body.classList.add('page-open');
  } else {
    $('pages-root').hidden = true;
    document.body.classList.remove('page-open');
    document.title = 'Folkhold';
  }
}

export function initPages() {
  $('pages-back').addEventListener('click', (event) => {
    event.preventDefault();
    location.hash = backTo || '#/home';
  });
  window.addEventListener('hashchange', update);
  update(null);
}
