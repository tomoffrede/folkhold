// The Settings screen: the choices you can change, and your tags. (Sign out is handled in views/auth.js.)

import { strings, t } from '../strings.js';
import * as settings from '../settings.js';
import * as tags from '../tags.js';
import * as auth from '../auth.js';
import { downloadExport } from '../export.js';
import { clearAllDrafts } from '../drafts.js';
import { confirmModal, closeOnOutsideClick } from './modal.js';

const $ = (id) => document.getElementById(id);
const radios = () => document.querySelectorAll('input[name="contact-sort"]');
const fieldBoxes = () => document.querySelectorAll('[data-hide-field]');

let loaded = false;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(text) {
  const message = $('settings-message');
  message.textContent = text || '';
  message.hidden = !text;
}

// Shows the saved choices. The choices stay switched off until the data has loaded.
function show() {
  loaded = true;
  const value = settings.get('contactSort');
  radios().forEach((radio) => {
    radio.checked = radio.value === value;
    radio.disabled = false;
  });
  const lastMet = $('setting-lastmet');
  lastMet.checked = settings.get('showLastMet');
  lastMet.disabled = false;
  const priority = $('setting-priority');
  priority.checked = settings.get('showPriority');
  priority.disabled = false;
  const hidden = settings.get('hiddenFields') || [];
  fieldBoxes().forEach((box) => {
    box.checked = !hidden.includes(box.dataset.hideField);
    box.disabled = false;
  });
  renderTags();
}

// Saves one setting; on a problem, shows it and goes back to what is really saved.
async function save(key, value) {
  showMessage('');
  try {
    await settings.set(key, value);
  } catch (error) {
    showMessage(error.message);
    show();
  }
}

// ---------- tags ----------

let renaming = null; // id of the tag being renamed

async function run(task) {
  showMessage('');
  try {
    await task();
  } catch (error) {
    showMessage(error.message);
  }
}

function tagRow(tag) {
  const row = make('li', 'tag-manage-row');
  const total = tags.count(tag.id);

  if (renaming === tag.id) {
    const input = make('input', 'tag-rename');
    input.type = 'text';
    input.value = tag.name;
    input.setAttribute('aria-label', strings['settings.tagRename']);
    const ok = make('button', 'btn btn-primary btn-small', strings['settings.tagSave']);
    const cancel = make('button', 'btn btn-secondary btn-small', strings['settings.tagCancel']);
    ok.type = 'button';
    cancel.type = 'button';
    const done = () =>
      run(async () => {
        if (tags.clean(input.value) !== tag.name) await tags.rename(tag.id, input.value);
        renaming = null;
        renderTags();
      });
    ok.addEventListener('click', done);
    cancel.addEventListener('click', () => {
      renaming = null;
      showMessage('');
      renderTags();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') done();
      else if (event.key === 'Escape') cancel.click();
    });
    row.append(input, ok, cancel);
    setTimeout(() => input.focus(), 0);
    return row;
  }

  const name = make('span', 'tag-manage-name');
  name.append(make('b', '', tag.name), make('small', '', t(total === 1 ? 'settings.tagOne' : 'settings.tagMany', { n: total })));
  row.append(name);

  const actions = make('div', 'tag-manage-actions');
  const rename = make('button', 'btn btn-secondary btn-small', strings['settings.tagRename']);
  const del = make('button', 'link link-danger', strings['settings.tagDelete']);
  rename.type = 'button';
  del.type = 'button';
  rename.addEventListener('click', () => {
    renaming = tag.id;
    showMessage('');
    renderTags();
  });
  del.addEventListener('click', async () => {
    renaming = null;
    showMessage('');
    const yes = await confirmModal({
      text: total ? t('settings.tagDeleteSure', { n: total }) : strings['settings.tagDeleteSureNone'],
      yes: strings['settings.tagDeleteYes'],
      no: strings['note.keep'],
    });
    if (!yes) return renderTags();
    run(async () => {
      await tags.remove(tag.id);
      renderTags();
    });
  });
  actions.append(rename, del);
  row.append(actions);
  return row;
}

function renderTags() {
  const list = $('settings-tags');
  if (!list) return;
  const all = loaded ? tags.list() : [];
  list.replaceChildren(...all.map(tagRow));
  $('settings-tags-empty').hidden = !loaded || all.length > 0;
}

// ---------- password, export, delete ----------

function bindAccount() {
  $('export-data').addEventListener('click', downloadExport);

  const passwordForm = $('password-form');
  const closePassword = () => {
    passwordForm.hidden = true;
    $('password-open').hidden = false;
    ['password-current', 'password-new', 'password-new2'].forEach((id) => ($(id).value = ''));
    $('password-error').hidden = true;
  };
  $('password-open').addEventListener('click', () => {
    passwordForm.hidden = false;
    $('password-open').hidden = true;
    $('password-done').hidden = true;
    $('password-current').focus();
  });
  $('password-cancel').addEventListener('click', closePassword);
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = passwordForm.querySelector('[type="submit"]');
    const error = $('password-error');
    error.hidden = true;
    button.disabled = true;
    try {
      if ($('password-new').value !== $('password-new2').value) throw new Error(strings['auth.errMismatch']);
      await auth.changePassword($('password-current').value, $('password-new').value);
      closePassword();
      $('password-done').textContent = strings['settings.passwordChanged'];
      $('password-done').hidden = false;
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  const deleteForm = $('delete-form');
  const deleteDialog = $('delete-dialog');
  closeOnOutsideClick(deleteDialog);
  deleteDialog.addEventListener('close', () => {
    $('delete-password').value = '';
    $('delete-error').hidden = true;
  });
  $('delete-open').addEventListener('click', () => deleteDialog.showModal());
  $('delete-cancel').addEventListener('click', () => deleteDialog.close());
  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = deleteForm.querySelector('[type="submit"]');
    const error = $('delete-error');
    error.hidden = true;
    button.disabled = true;
    try {
      await auth.deleteAccount($('delete-password').value);
      clearAllDrafts();
      try {
        Object.keys(localStorage)
          .filter((name) => name.startsWith('folkhold'))
          .forEach((name) => localStorage.removeItem(name));
      } catch {
        // nothing more to clear
      }
      location.hash = '';
      location.reload();
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
}

export function initSettings() {
  bindAccount();
  document.addEventListener('folkhold:data', show);
  document.addEventListener('folkhold:saved', () => {
    if (loaded && !renaming) renderTags();
  });
  $('setting-lastmet').addEventListener('change', (event) => save('showLastMet', event.target.checked));
  $('setting-priority').addEventListener('change', (event) => save('showPriority', event.target.checked));
  fieldBoxes().forEach((box) =>
    box.addEventListener('change', () => save('hiddenFields', [...fieldBoxes()].filter((b) => !b.checked).map((b) => b.dataset.hideField))),
  );
  radios().forEach((radio) => radio.addEventListener('change', () => save('contactSort', radio.value)));
}
