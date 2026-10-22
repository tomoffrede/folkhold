// Startup and navigation. Screens are switched by the part of the address after "#".

import { strings } from './strings.js';
import { initAuth } from './views/auth.js';
import { initContacts } from './views/contacts.js';
import { initContact } from './views/contact-page.js';
import { initSettings } from './views/settings.js';
import { initNoteForm } from './views/item-form.js';
import { initEventsPage } from './views/events-page.js';
import { initUpcoming } from './views/upcoming.js';

const SCREENS = ['home', 'contacts', 'contact', 'events', 'note', 'upcoming', 'settings'];

// Put the text from strings.js into every element that has a data-text attribute.
function fillStrings() {
  document.querySelectorAll('[data-text]').forEach((el) => {
    const key = el.dataset.text;
    if (strings[key] === undefined) {
      console.warn('Missing string:', key);
      return;
    }
    el.textContent = strings[key];
  });
}

// Put the text from strings.js into placeholders (data-placeholder).
function fillPlaceholders() {
  document.querySelectorAll('[data-label]').forEach((el) => el.setAttribute('aria-label', strings[el.dataset.label] || ''));
  document.querySelectorAll('[data-placeholder]').forEach((el) => {
    el.placeholder = strings[el.dataset.placeholder] || '';
    el.setAttribute('aria-label', el.placeholder);
  });
}

// Which screen the address asks for ("#/contacts" gives "contacts"). Unknown or empty gives "home".
function currentScreen() {
  const name = location.hash.replace('#/', '').split('/')[0];
  if (name === 'add-note' || name === 'add-event' || name === 'event') return 'note';
  if (name === 'add-contact') return 'contact';
  return SCREENS.includes(name) ? name : 'home';
}

// Show that screen, hide the others, and mark the matching navigation item.
function showScreen() {
  const name = currentScreen();
  const navName =
    name === 'contact' || name === 'events' ? 'contacts' : name === 'note' ? (/^#\/add-(note|event)$/.test(location.hash) ? 'home' : 'contacts') : name;

  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.dataset.screen !== name;
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    if (el.dataset.nav === navName) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showScreen);
fillStrings();
fillPlaceholders();
showScreen();
initContacts();
initContact();
initSettings();
initNoteForm();
initEventsPage();
initUpcoming();
initAuth();
