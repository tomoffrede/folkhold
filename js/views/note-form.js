// Adding and editing a note. One screen for both:
//   #/add-note                 a new note (choose the contacts first)
//   #/add-note/<contactId>     a new note for that contact (more can be added)
//   #/note/<noteId>/<contactId>   edit a note, opened from that contact's page

import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import * as rich from '../richtext.js';
import { createPicker } from './contact-picker.js';
import { createEditor } from './rich-editor.js';
import { displayName } from './contacts.js';

const $ = (id) => document.getElementById(id);
const ID = '([0-9a-f-]+)';

let builtFor = null; // the address the page was last built for

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function parseRoute() {
  let match = location.hash.match(new RegExp(`^#/add-note(?:/${ID})?$`, 'i'));
  if (match) return { mode: 'new', contactId: match[1] || null };
  match = location.hash.match(new RegExp(`^#/note/${ID}/${ID}$`, 'i'));
  if (match) return { mode: 'edit', noteId: match[1], contactId: match[2] };
  return null;
}

function backHref(route) {
  return route.contactId ? `#/contact/${route.contactId}` : '#/home';
}

// Runs a task while the button says "Working...", and shows a problem under the form instead of leaving the page.
async function runBusy(button, errorEl, task) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = strings['auth.working'];
  errorEl.hidden = true;
  try {
    await task();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function showError(errorEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function buildEditor(onInput) {
  return createEditor({
    placeholder: strings['note.textPlaceholder'],
    label: strings['note.text'],
    buttonLabels: { bold: strings['note.bold'], italic: strings['note.italic'], underline: strings['note.underline'] },
    onInput,
  });
}

function buildTitleField(value) {
  const label = make('label', 'field');
  const input = make('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.placeholder = strings['note.titlePlaceholder'];
  input.setAttribute('aria-label', strings['note.titlePlaceholder']);
  input.value = value || '';
  label.append(input);
  return { label, input };
}

// ---------- a new note ----------

function buildNew(page, route) {
  const preselected = route.contactId && store.get('contact', route.contactId) ? [route.contactId] : [];
  const picker = createPicker({ selected: preselected });
  const title = buildTitleField('');
  const editor = buildEditor();
  const error = make('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const save = make('button', 'btn btn-primary btn-form', strings['note.save']);
  save.type = 'button';

  const form = make('div', 'form');
  form.append(picker.element, title.label, editor.element, error, save);
  page.append(form);

  save.addEventListener('click', () =>
    runBusy(save, error, async () => {
      const contactIds = picker.getSelected();
      const body = editor.getBody();
      const titleText = title.input.value.trim();
      if (contactIds.length === 0) return showError(error, strings['note.errNoContact']);
      if (!titleText && rich.isEmpty(body)) return showError(error, strings['note.errEmpty']);
      await notes.create({ title: titleText, body, contactIds });
      location.hash = `#/contact/${preselected[0] || contactIds[0]}`;
    }),
  );

  if (preselected.length) editor.focus();
  else picker.element.querySelector('input').focus();
}

// ---------- editing a note ----------

function buildEdit(page, route, note, contact) {
  const others = (note.contactIds || [])
    .filter((id) => id !== route.contactId)
    .map((id) => store.get('contact', id))
    .filter(Boolean);

  const title = buildTitleField(note.title);
  const editor = buildEditor();
  editor.setBody(note.body || []);
  const error = make('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const save = make('button', 'btn btn-primary btn-form', strings['note.save']);
  save.type = 'button';

  const formWrap = make('div', 'form');
  formWrap.append(make('p', 'hint', t('note.forLine', { name: displayName(contact) })));
  if (others.length) {
    formWrap.append(make('p', 'hint', t('notes.alsoOn', { names: others.map(displayName).join(', ') })));
  }
  formWrap.append(title.label, editor.element, error, save, buildDelete(route, note, contact, others, error));
  const promptWrap = make('div');
  promptWrap.hidden = true;
  page.append(formWrap, promptWrap);

  save.addEventListener('click', () =>
    runBusy(save, error, async () => {
      const changes = { title: title.input.value.trim(), body: editor.getBody() };
      if (!changes.title && rich.isEmpty(changes.body)) return showError(error, strings['note.errEmpty']);
      const unchanged = changes.title === (note.title || '') && rich.sameBody(changes.body, note.body);
      if (unchanged) {
        location.hash = backHref(route);
        return;
      }
      if (others.length === 0) {
        await notes.saveEdit(note, changes, route.contactId, []);
        location.hash = backHref(route);
        return;
      }
      showPrompt({ route, note, others, changes, formWrap, promptWrap });
    }),
  );
}

// The question shown when other contacts share the note: who gets the change?
function showPrompt({ route, note, others, changes, formWrap, promptWrap }) {
  promptWrap.replaceChildren();
  const panel = make('div', 'prompt form');
  panel.append(make('h3', 'prompt-title', strings['note.sharedTitle']), make('p', '', strings['note.sharedText']));

  const list = make('div', 'prompt-list');
  const boxes = others.map((contact) => {
    const label = make('label', 'check');
    const box = make('input');
    box.type = 'checkbox';
    box.checked = true;
    box.value = contact.id;
    label.append(box, make('span', '', displayName(contact)));
    list.append(label);
    return box;
  });

  const actions = make('div', 'prompt-actions');
  const all = make('button', 'btn btn-secondary btn-small', strings['note.applyAll']);
  const none = make('button', 'btn btn-secondary btn-small', strings['note.applyNone']);
  all.type = 'button';
  none.type = 'button';
  all.addEventListener('click', () => boxes.forEach((box) => (box.checked = true)));
  none.addEventListener('click', () => boxes.forEach((box) => (box.checked = false)));
  actions.append(all, none);

  const error = make('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const confirm = make('button', 'btn btn-primary btn-form', strings['note.saveChanges']);
  confirm.type = 'button';
  const back = make('button', 'link', strings['note.backToEditing']);
  back.type = 'button';

  panel.append(list, actions, error, confirm, back);
  promptWrap.append(panel);
  formWrap.hidden = true;
  promptWrap.hidden = false;
  window.scrollTo(0, 0);

  back.addEventListener('click', () => {
    promptWrap.hidden = true;
    formWrap.hidden = false;
  });
  confirm.addEventListener('click', () =>
    runBusy(confirm, error, async () => {
      const applied = boxes.filter((box) => box.checked).map((box) => box.value);
      await notes.saveEdit(note, changes, route.contactId, applied);
      location.hash = backHref(route);
    }),
  );
}

// "Delete note": asks first. A note on several contacts can be removed from this contact only, or for everyone.
function buildDelete(route, note, contact, others, errorEl) {
  const wrap = make('div', 'danger');
  const ask = make('button', 'link link-danger', strings['note.delete']);
  ask.type = 'button';
  const sure = make('div', 'confirm-row');
  sure.hidden = true;
  const shared = others.length > 0;
  sure.append(make('span', 'confirm-text', shared ? t('note.deleteShared', { name: displayName(contact) }) : strings['note.deleteSure']));

  const action = (text, className, task) => {
    const button = make('button', `btn ${className} btn-small`, text);
    button.type = 'button';
    button.addEventListener('click', () =>
      runBusy(button, errorEl, async () => {
        await task();
        location.hash = backHref(route);
      }),
    );
    return button;
  };
  const keep = make('button', 'btn btn-secondary btn-small', strings['note.keep']);
  keep.type = 'button';
  keep.addEventListener('click', () => {
    sure.hidden = true;
    ask.hidden = false;
  });

  if (shared) {
    sure.append(
      action(t('note.removeFrom', { name: displayName(contact) }), 'btn-secondary', () => notes.removeFromContact(note, route.contactId)),
      action(strings['note.deleteAll'], 'btn-danger', () => notes.removeEverywhere(note)),
    );
  } else {
    sure.append(action(strings['note.deleteYes'], 'btn-danger', () => notes.removeEverywhere(note)));
  }
  sure.append(keep);

  ask.addEventListener('click', () => {
    ask.hidden = true;
    sure.hidden = false;
  });
  wrap.append(ask, sure);
  return wrap;
}

// ---------- showing the right page ----------

function render() {
  const route = parseRoute();
  if (!route) {
    builtFor = null;
    return;
  }
  const page = $('note-page');
  page.replaceChildren();
  builtFor = location.hash;

  const back = make('a', 'link back', strings['note.back']);
  back.href = backHref(route);
  page.append(back);

  if (!store.isLoaded()) {
    builtFor = null; // build again once the data has loaded
    page.append(make('p', 'empty', strings['contacts.loading']));
    return;
  }
  page.append(make('h2', 'section-title', strings[route.mode === 'new' ? 'note.addTitle' : 'note.editTitle']));

  if (route.mode === 'new') {
    buildNew(page, route);
    return;
  }
  const note = notes.get(route.noteId);
  const contact = store.get('contact', route.contactId);
  if (!note || !contact || !(note.contactIds || []).includes(route.contactId)) {
    page.append(make('p', 'empty', strings['note.notFound']));
    return;
  }
  buildEdit(page, route, note, contact);
}

export function initNoteForm() {
  document.querySelectorAll('[data-action="add-note"]').forEach((el) => {
    el.addEventListener('click', () => {
      location.hash = '#/add-note';
    });
  });
  window.addEventListener('hashchange', render);
  // When the data finishes loading (for example after a reload on this page), build the page if it is not built yet.
  const buildIfNeeded = () => {
    if (parseRoute() && builtFor !== location.hash) render();
  };
  document.addEventListener('folkhold:ready', buildIfNeeded);
  document.addEventListener('folkhold:data', buildIfNeeded);
}
