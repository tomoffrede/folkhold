// Adding and editing a note or an event. One screen for all of it:
//   #/add-note, #/add-event                 a new one (choose the contacts first)
//   #/add-note/<contactId>                  a new one for that contact (more can be added)
//   #/note/<id>/<contactId>, #/event/<id>/<contactId>   edit one, opened from that contact's page
// Unsaved typing is kept as an encrypted draft on this device, so a reload does not lose it.

import { leave } from '../nav.js';
import { strings, t } from '../strings.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import * as events from '../events.js';
import * as rich from '../richtext.js';
import { saveDraft, loadDraft, clearDraft } from '../drafts.js';
import { createPicker } from './contact-picker.js';
import { createNoteFields } from './note-fields.js';
import { createEventFields, shortName } from './event-fields.js';
import { displayName } from './contacts.js';
import * as birthdays from '../birthdays.js';
import { formatDate } from '../dates.js';
import { showToast } from './toast.js';
import { openModal, confirmModal } from './modal.js';

const $ = (id) => document.getElementById(id);
const ID = '([0-9a-f-]+)';
const DRAFT_DELAY = 500; // milliseconds of quiet after typing before the draft is kept

// What differs between a note and an event: the fields, how a value is compared, and what counts as a mistake.
const KINDS = {
  note: {
    api: notes,
    makeFields: createNoteFields,
    pick: (v) => ({ title: v.title || '', body: v.body || [], priority: v.priority || 0 }),
    isBlank: (v) => !v.title && rich.isEmpty(v.body) && !v.priority,
    problem: (v) => (!v.title && rich.isEmpty(v.body) ? strings['note.errEmpty'] : null),
  },
  event: {
    api: events,
    makeFields: createEventFields,
    pick: (v) => ({ title: v.title || '', details: v.details || '', date: v.date || null, repeat: Boolean(v.repeat), kind: v.kind === 'together' ? 'together' : '' }),
    isBlank: (v) => !v.title && !v.details && v.blank,
    problem: (v) => (v.date ? null : strings[`event.err.${v.problem || 'empty'}`]),
  },
};

// Texts: an event has its own where the wording differs ("event.save"), otherwise the note text is used.
const key = (kind, name) => (strings[`${kind}.${name}`] !== undefined ? `${kind}.${name}` : `note.${name}`);
const S = (kind, name) => strings[key(kind, name)];
const T = (kind, name, values) => t(key(kind, name), values);

let builtFor = null; // the address the page was last built for
let draftTimer = null;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function parseRoute() {
  let match = location.hash.match(new RegExp(`^#/add-(note|event)(?:/${ID})?$`, 'i'));
  if (match) return { kind: match[1].toLowerCase(), mode: 'new', contactId: match[2] || null };
  match = location.hash.match(new RegExp(`^#/(note|event)/${ID}/${ID}$`, 'i'));
  if (match) return { kind: match[1].toLowerCase(), mode: 'edit', itemId: match[2], contactId: match[3] };
  return null;
}

// The page an event or note was opened from, when that was Home, Upcoming or the Contacts list (search results): "Back" and the end of saving go there.
let origin = null;

function backHref(route) {
  if (origin && (route.mode === 'edit' || origin.endsWith('/edit'))) return origin; // also back to a contact's edit page
  return route.contactId ? `#/contact/${route.contactId}` : '#/home';
}

// A new or changed event that is really a birthday goes into the contact's details instead. Returns true when it did.
async function moveBirthday(route, values, contact, existing) {
  if (route.kind !== 'event' || !contact) return false;
  const birthday = birthdays.detect(values, contact);
  if (!birthday) return false;
  const result = await birthdays.save(contact, birthday);
  if (existing) await events.removeEverywhere(existing);
  clearTimeout(draftTimer);
  clearDraft(draftName(route));
  leave(`#/contact/${contact.id}`);
  showToast(t(`birthday.${result}`, { name: displayName(contact), date: formatDate(values.date) }));
  return true;
}

function draftName(route) {
  const prefix = route.kind === 'event' ? 'event-' : '';
  return prefix + (route.mode === 'new' ? `new:${route.contactId || ''}` : `edit:${route.itemId}`);
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

function makeError() {
  const error = make('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  return error;
}

// Leaves the screen; the draft is dropped because the work is saved (or deliberately thrown away).
function finish(route) {
  clearTimeout(draftTimer);
  clearDraft(draftName(route));
  leave(backHref(route));
}

// The offer to bring back a draft: "Restore unsaved note" or "Discard".
function draftBanner(route, restore) {
  const kind = route.kind;
  loadDraft(draftName(route)).then((draft) => {
    const slot = $('draft-slot');
    if (!draft || !slot || builtFor !== location.hash) return;
    const box = make('div', 'prompt');
    box.append(make('p', 'prompt-title', S(kind, 'draftFound')));
    const actions = make('div', 'prompt-actions');
    const yes = make('button', 'btn btn-primary btn-small', S(kind, 'draftRestore'));
    const no = make('button', 'btn btn-secondary btn-small', S(kind, 'draftDiscard'));
    yes.type = 'button';
    no.type = 'button';
    yes.addEventListener('click', () => {
      restore(draft);
      box.remove();
    });
    no.addEventListener('click', () => {
      clearDraft(draftName(route));
      box.remove();
    });
    actions.append(yes, no);
    box.append(actions);
    slot.append(box);
  });
}

// ---------- a new note or event ----------

function buildNew(page, route) {
  const kind = KINDS[route.kind];
  const preselected = route.contactId && store.get('contact', route.contactId) ? [route.contactId] : [];
  const name = draftName(route);

  const keepDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const values = fields.get();
      if (kind.isBlank(values)) clearDraft(name);
      else saveDraft(name, { ...values, contactIds: picker.getSelected() });
    }, DRAFT_DELAY);
  };

  // An event's two choices carry the contact's first name (when exactly one contact is chosen).
  const syncNames = () => {
    if (!fields.setName) return;
    const chosen = picker.getSelected().map((id) => store.get('contact', id)).filter(Boolean);
    fields.setName(chosen.length === 1 ? shortName(chosen[0]) : '');
  };
  const picker = createPicker({ selected: preselected, onChange: () => { syncNames(); keepDraft(); } });
  const fields = kind.makeFields({ onChange: keepDraft });
  syncNames();
  const error = makeError();
  const save = make('button', 'btn btn-primary btn-form', S(route.kind, 'save'));
  save.type = 'button';

  const form = make('div', 'form');
  const slot = make('div');
  slot.id = 'draft-slot';
  form.append(slot, picker.element, fields.element, error, save);
  page.append(form);

  save.addEventListener('click', () =>
    runBusy(save, error, async () => {
      const contactIds = picker.getSelected();
      const values = fields.get();
      if (contactIds.length === 0) return showError(error, strings['note.errNoContact']);
      const mistake = kind.problem(values);
      if (mistake) return showError(error, mistake);
      clearTimeout(draftTimer);
      if (contactIds.length === 1 && (await moveBirthday(route, values, store.get('contact', contactIds[0]), null))) return;
      await kind.api.create({ ...kind.pick(values), contactIds });
      clearDraft(name);
      const target = `#/contact/${preselected[0] || contactIds[0]}`;
      leave(origin === `${target}/edit` ? origin : target); // from a contact's edit page: back to it
    }),
  );

  draftBanner(route, (draft) => {
    fields.set(draft);
    picker.setSelected(draft.contactIds || []);
    syncNames();
  });

  if (preselected.length) fields.focus();
  else picker.element.querySelector('input').focus();
}

// ---------- editing ----------

function buildEdit(page, route, note, contact) {
  const kind = KINDS[route.kind];
  const name = draftName(route);
  const others = (note.contactIds || [])
    .filter((id) => id !== route.contactId)
    .map((id) => store.get('contact', id))
    .filter(Boolean);

  const original = kind.pick(note);
  const isChanged = (values) => JSON.stringify(kind.pick(values)) !== JSON.stringify(original);

  const keepDraft = () => {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const values = fields.get();
      if (isChanged(values)) saveDraft(name, values);
      else clearDraft(name);
    }, DRAFT_DELAY);
  };

  const fields = kind.makeFields({ ...original, onChange: keepDraft });
  if (fields.setName) fields.setName(shortName(contact));
  const error = makeError();
  const save = make('button', 'btn btn-primary btn-form', S(route.kind, 'save'));
  save.type = 'button';

  const formWrap = make('div', 'form');
  const slot = make('div');
  slot.id = 'draft-slot';
  formWrap.append(slot, make('p', 'hint', T(route.kind, 'forLine', { name: displayName(contact) })));
  if (others.length) {
    formWrap.append(make('p', 'hint', t('notes.alsoOn', { names: others.map(displayName).join(', ') })));
  }
  const promptWrap = make('div');
  promptWrap.hidden = true;
  formWrap.append(fields.element, error, save, buildDelete({ route, note, contact, others, error, formWrap, promptWrap }));
  page.append(formWrap, promptWrap);

  save.addEventListener('click', () =>
    runBusy(save, error, async () => {
      const changes = fields.get();
      const mistake = kind.problem(changes);
      if (mistake) return showError(error, mistake);
      if (!isChanged(changes)) return finish(route);
      if (others.length === 0) {
        if (await moveBirthday(route, changes, contact, note)) return;
        await kind.api.saveEdit(note, kind.pick(changes), route.contactId, []);
        return finish(route);
      }
      showChoice({
        formWrap,
        promptWrap,
        title: strings['note.sharedTitle'],
        text: strings['note.sharedText'],
        confirmLabel: strings['note.saveChanges'],
        others,
        onConfirm: async (applied) => {
          await kind.api.saveEdit(note, kind.pick(changes), route.contactId, applied);
          finish(route);
        },
      });
    }),
  );

  draftBanner(route, (draft) => fields.set(draft));
}

// The question shown when other contacts share the note: which of them get this (a change, or the deletion)?
function showChoice({ formWrap, promptWrap, title, text, confirmLabel, danger, others, onConfirm }) {
  promptWrap.replaceChildren();
  const panel = make('div', 'prompt form');
  panel.append(make('h3', 'prompt-title', title), make('p', '', text));

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

  const error = makeError();
  const confirm = make('button', `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-form`, confirmLabel);
  confirm.type = 'button';
  const back = make('button', 'link', strings['note.backToEditing']);
  back.type = 'button';

  panel.append(list, actions, error, confirm, back);
  const dialog = openModal(panel);

  back.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', () =>
    runBusy(confirm, error, async () => {
      await onConfirm(boxes.filter((box) => box.checked).map((box) => box.value));
      dialog.close();
    }),
  );
}

// "Delete note". Unshared: one question. Shared: choose which other contacts lose it too (this contact always does).
function buildDelete({ route, note, contact, others, error, formWrap, promptWrap }) {
  const wrap = make('div', 'danger');
  const kind = KINDS[route.kind];
  const ask = make('button', 'link link-danger', S(route.kind, 'delete'));
  ask.type = 'button';

  if (others.length) {
    ask.addEventListener('click', () =>
      showChoice({
        formWrap,
        promptWrap,
        title: strings['note.deleteSharedTitle'],
        text: T(route.kind, 'deleteSharedText', { name: displayName(contact) }),
        confirmLabel: S(route.kind, 'deleteConfirm'),
        danger: true,
        others,
        onConfirm: async (picked) => {
          await kind.api.removeFromContacts(note, [route.contactId, ...picked]);
          finish(route);
        },
      }),
    );
    wrap.append(ask);
    return wrap;
  }

  ask.addEventListener('click', async () => {
    const yes = await confirmModal({ text: S(route.kind, 'deleteSure'), yes: strings['note.deleteYes'], no: strings['note.keep'] });
    if (!yes) return;
    runBusy(ask, error, async () => {
      await kind.api.removeEverywhere(note);
      finish(route);
    });
  });
  wrap.append(ask);
  return wrap;
}

// ---------- showing the right page ----------

function render() {
  const route = parseRoute();
  clearTimeout(draftTimer);
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
  page.append(make('h2', 'section-title', S(route.kind, route.mode === 'new' ? 'addTitle' : 'editTitle')));

  if (route.mode === 'new') {
    buildNew(page, route);
    return;
  }
  const note = KINDS[route.kind].api.get(route.itemId);
  const contact = store.get('contact', route.contactId);
  if (!note || !contact || !(note.contactIds || []).includes(route.contactId)) {
    page.append(make('p', 'empty', S(route.kind, 'notFound')));
    return;
  }
  buildEdit(page, route, note, contact);
}

export function initNoteForm() {
  ['note', 'event'].forEach((kind) => {
    document.querySelectorAll(`[data-action="add-${kind}"]`).forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#/add-${kind}`;
      });
    });
  });
  window.addEventListener('hashchange', (event) => {
    // Remember Home or Upcoming as the page to go back to, when an event is opened from there.
    if (parseRoute()) {
      const before = (event.oldURL || '').split('#')[1] ? `#${event.oldURL.split('#')[1]}` : '';
      if (before === '#/home' || before === '#/upcoming' || before === '#/contacts' || /^#\/contact\/[0-9a-f-]+\/edit$/i.test(before)) origin = before;
      else if (!/^#\/(add-)?(note|event)/.test(before)) origin = null;
    }
    render();
  });
  // When the data finishes loading (for example after a reload on this page), build the page if it is not built yet.
  const buildIfNeeded = () => {
    if (parseRoute() && builtFor !== location.hash) render();
  };
  document.addEventListener('folkhold:ready', buildIfNeeded);
  document.addEventListener('folkhold:data', buildIfNeeded);
}
