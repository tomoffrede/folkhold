// Languages. English is built in (strings.js); the others are loaded from js/lang/<code>.js and written over the English texts.
// The choice is remembered on this device (so the sign-in screen is in the right language) and in your account (see settings.js).

import { strings } from './strings.js';

export const LANGS = {
  en: 'English',
  pt: 'Português (Brasil)',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
};

const LOCALES = { en: 'en-GB', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
const KEY = 'folkhold-lang';
let current = 'en';

function stored() {
  try {
    const code = localStorage.getItem(KEY);
    return LANGS[code] ? code : null;
  } catch {
    return null;
  }
}

// First visit: the browser's language when we have it ("pt-BR" gives Portuguese), otherwise English.
function fromBrowser() {
  const code = (navigator.language || '').toLowerCase().slice(0, 2);
  return LANGS[code] ? code : 'en';
}

export function getLang() {
  return current;
}

export function locale() {
  return LOCALES[current];
}

// Remembers a language on this device. Returns true when it could be saved.
export function saveLang(code) {
  if (!LANGS[code]) return false;
  try {
    localStorage.setItem(KEY, code);
    return localStorage.getItem(KEY) === code;
  } catch {
    return false;
  }
}

export async function initLang() {
  current = stored() || fromBrowser();
  if (current !== 'en') {
    try {
      const module = await import(`./lang/${current}.js`);
      Object.assign(strings, module.default);
    } catch {
      current = 'en'; // the language file could not be loaded: stay in English
    }
  }
  document.documentElement.lang = current;
}

// Switches the language: remembers it, then reloads the page so every text is redrawn.
export function switchLang(code) {
  if (code === current || !saveLang(code)) return;
  location.reload();
}

// Fills a <select> with the languages and calls onPick(code) when one is chosen.
export function fillLangSelect(select, onPick) {
  select.replaceChildren();
  Object.entries(LANGS).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    select.append(option);
  });
  select.value = current;
  select.addEventListener('change', () => onPick(select.value));
}
