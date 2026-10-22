// The information pages (About, Data privacy explained, Privacy policy, Impressum).
// They can be opened before signing in, so they sit outside the app and the sign-in screens: #/about, #/data-privacy, #/privacy, #/impressum

import { strings } from '../strings.js';
import { PAGES } from '../pages.js';
import { OWNER, REPO_URL, LAST_UPDATED } from '../owner.js';

const $ = (id) => document.getElementById(id);
let backTo = '';

function pageKey() {
  const key = location.hash.replace('#/', '');
  return PAGES[key] ? key : null;
}

function fill(text) {
  return text.replaceAll('{name}', OWNER.name).replaceAll('{email}', OWNER.email).replaceAll('{repo}', REPO_URL).replaceAll('{updated}', LAST_UPDATED);
}

function render(key) {
  const page = PAGES[key];
  const article = $('page-content');
  article.replaceChildren();
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = page.title;
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
