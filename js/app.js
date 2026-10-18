// Startup and navigation. Screens are switched by the part of the address after "#".

import { strings } from './strings.js';
import { initAuth } from './views/auth.js';

const SCREENS = ['home', 'contacts', 'upcoming', 'settings'];

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

// Which screen the address asks for ("#/contacts" gives "contacts"). Unknown or empty gives "home".
function currentScreen() {
  const name = location.hash.replace('#/', '');
  return SCREENS.includes(name) ? name : 'home';
}

// Show that screen, hide the others, and mark the matching navigation item.
function showScreen() {
  const name = currentScreen();

  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.dataset.screen !== name;
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    if (el.dataset.nav === name) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showScreen);
fillStrings();
showScreen();
initAuth();
