// The screens shown before the app opens: sign in, create account, unlock, and the recovery key.

import { strings, t } from '../strings.js';
import * as auth from '../auth.js';
import { clearAllDrafts } from '../drafts.js';
import { fillLangSelect, switchLang } from '../lang.js';

const $ = (id) => document.getElementById(id);

function showSection(name) {
  document.querySelectorAll('[data-auth]').forEach((el) => {
    el.hidden = el.dataset.auth !== name;
  });
  document.querySelectorAll('.form-error').forEach((el) => {
    el.hidden = true;
  });
  window.scrollTo(0, 0);
}

function setError(id, message) {
  const el = $(id);
  el.textContent = message;
  el.hidden = false;
}

function showApp() {
  $('settings-username').textContent = auth.getUsername();
  $('auth-root').hidden = true;
  $('app').hidden = false;
  window.scrollTo(0, 0);
  document.dispatchEvent(new Event('folkhold:ready'));
}

function showLocked() {
  $('locked-title').textContent = t('auth.lockedTitle', { name: auth.getUsername() });
  showSection('locked');
}

function showRecovery() {
  $('recovery-account').textContent = t('auth.recoveryAccount', { name: auth.getUsername() });
  $('recovery-key').textContent = auth.getPendingRecoveryKey();
  $('recovery-confirm').checked = false;
  $('recovery-finish').disabled = true;
  showSection('recovery');
}

// Shows the right screen for the state that auth.js reports.
function route(state) {
  if (state === 'ready') showApp();
  else if (state === 'settingUp') showRecovery();
  else if (state === 'locked') showLocked();
  else showSection('signin');
}

// Runs a task while the button says "Working...", and shows any error under the form.
async function runWithButton(button, errorId, task) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = strings['auth.working'];
  $(errorId).hidden = true;
  try {
    await task();
  } catch (error) {
    setError(errorId, error.message);
  } finally {
    button.textContent = label;
    button.disabled = false;
  }
}

function recoveryFileText() {
  return t('auth.recoveryFile', { name: auth.getUsername(), key: auth.getPendingRecoveryKey() });
}

async function signOutAndReload() {
  clearAllDrafts();
  await auth.signOut();
  location.hash = '';
  location.reload();
}

function bindForms() {
  $('signin-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    runWithButton(button, 'signin-error', async () => {
      const state = await auth.signIn($('signin-username').value, $('signin-password').value);
      $('signin-password').value = '';
      route(state);
    });
  });

  $('signup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    runWithButton(button, 'signup-error', async () => {
      const password = $('signup-password').value;
      if (password !== $('signup-password2').value) throw new Error(strings['auth.errMismatch']);
      const state = await auth.signUp($('signup-username').value, password);
      $('signup-password').value = '';
      $('signup-password2').value = '';
      route(state);
    });
  });

  $('reset-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    runWithButton(button, 'reset-error', async () => {
      const password = $('reset-password').value;
      if (password !== $('reset-password2').value) throw new Error(strings['auth.errMismatch']);
      const state = await auth.resetPassword($('reset-username').value, $('reset-key').value, password);
      ['reset-key', 'reset-password', 'reset-password2'].forEach((id) => ($(id).value = ''));
      route(state);
    });
  });

  $('locked-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    runWithButton(button, 'locked-error', async () => {
      const state = await auth.signIn(auth.getUsername(), $('locked-password').value);
      $('locked-password').value = '';
      route(state);
    });
  });

  document.querySelectorAll('[data-auth-go]').forEach((el) => {
    el.addEventListener('click', () => showSection(el.dataset.authGo));
  });

  document.querySelectorAll('[data-action="sign-out"]').forEach((el) => {
    el.addEventListener('click', signOutAndReload);
  });
}

function bindRecovery() {
  $('recovery-confirm').addEventListener('change', (event) => {
    $('recovery-finish').disabled = !event.currentTarget.checked;
  });

  $('recovery-download').addEventListener('click', () => {
    const blob = new Blob([recoveryFileText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'folkhold-recovery-key.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  $('recovery-copy').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(auth.getPendingRecoveryKey());
      const label = button.textContent;
      button.textContent = strings['auth.recoveryCopied'];
      setTimeout(() => {
        button.textContent = label;
      }, 1500);
    } catch {
      // Copying is not allowed here: select the key so the user can copy it by hand.
      window.getSelection().selectAllChildren($('recovery-key'));
    }
  });

  $('recovery-print').addEventListener('click', () => window.print());

  $('recovery-email').addEventListener('click', () => {
    const subject = encodeURIComponent(strings['auth.recoveryEmailSubject']);
    const body = encodeURIComponent(recoveryFileText());
    location.href = `mailto:?subject=${subject}&body=${body}`;
  });

  $('recovery-finish').addEventListener('click', (event) => {
    runWithButton(event.currentTarget, 'recovery-error', async () => {
      await auth.confirmSetup();
      showApp();
    });
  });
}

// The welcome pop-up: opens by itself on the first visit, and again from the "What is Folkhold?" link.
function bindWelcome() {
  const dialog = $('welcome');
  const seen = () => {
    try {
      localStorage.setItem('folkhold-welcome-seen', '1');
    } catch {
      // not saved: it will show again next time
    }
  };
  const close = () => {
    seen();
    dialog.close();
  };
  $('welcome-close').addEventListener('click', close);
  $('welcome-open').addEventListener('click', () => dialog.showModal());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(); // a click on the dimmed area outside the box
  });
  dialog.addEventListener('cancel', seen); // Escape key
}

function maybeShowWelcome() {
  let seen = false;
  try {
    seen = localStorage.getItem('folkhold-welcome-seen') === '1';
  } catch {
    seen = false;
  }
  const dialog = $('welcome');
  if (!seen && !$('auth-root').hidden && document.querySelector('[data-auth="signin"]:not([hidden])') && !dialog.open) dialog.showModal();
}

export async function initAuth() {
  bindForms();
  bindWelcome();
  fillLangSelect($('auth-lang'), switchLang);
  bindRecovery();
  try {
    route(await auth.startup());
    maybeShowWelcome();
  } catch (error) {
    showSection('signin');
    setError('signin-error', error.message);
  }
}
