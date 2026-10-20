// The contact page. It opens as a read-only view; "Edit contact" opens the editor, which saves by itself.
//   #/contact/<id>        the view
//   #/contact/<id>/edit   the editor

import { strings } from '../strings.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import { renderNotesSection } from './contact-notes.js';
import { createNoteFields } from './note-fields.js';
import * as rich from '../richtext.js';
import { displayName } from './contacts.js';

const $ = (id) => document.getElementById(id);
const SAVE_DELAY = 700; // milliseconds of quiet after typing before saving

// The lists of entries on a contact. "labels" are the standard label options offered in the label menu.
const GROUPS = [
  { key: 'emails', heading: 'contact.emails', chip: 'contact.chipEmail', placeholder: 'contact.emailPlaceholder', inputType: 'email', labels: ['Personal', 'Work'] },
  { key: 'phones', heading: 'contact.phones', chip: 'contact.chipPhone', placeholder: 'contact.phonePlaceholder', inputType: 'tel', labels: ['Mobile', 'Home', 'Work'] },
  { key: 'addresses', heading: 'contact.addresses', chip: 'contact.chipAddress', placeholder: 'contact.addressPlaceholder', multiline: true, labels: ['Home', 'Work'] },
  { key: 'handles', heading: 'contact.handles', chip: 'contact.chipHandle', placeholder: 'contact.handlePlaceholder', inputType: 'text', labels: ['Instagram', 'Facebook', 'LinkedIn', 'Telegram', 'WhatsApp', 'Signal', 'X'] },
];
const NAME_KEYS = ['firstName', 'lastName', 'nickname'];
// Everything the editor handles. Any other saved field is kept as it is.
const MANAGED = [...NAME_KEYS, 'birthday', ...GROUPS.map((group) => group.key)];
const MONTHS_SHORT = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'short' }));
const MONTHS_LONG = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' }));

let contactId = null;
let editing = false;
let isNew = false; // the "add contact" form: nothing is saved until the Save button
let snapshot = null; // the contact as it was when the editor opened, for "Discard changes"
let newId = null; // set once a new contact has been saved, so pressing Save again cannot make a second one
let dirty = false; // there are typed changes that are not saved yet
let birthdayProblem = false; // the last save left out an impossible birthday
let timer = null;
let previousHash = ''; // where the person came from
let cameFrom = '#/contacts'; // where "Discard" on a new contact goes back to
let queue = Promise.resolve(); // saves run one after the other

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function parseRoute() {
  if (location.hash === '#/add-contact') return { id: null, edit: true, isNew: true };
  const match = location.hash.match(/^#\/contact\/([0-9a-f-]+)(\/edit)?$/i);
  return match ? { id: match[1], edit: Boolean(match[2]), isNew: false } : null;
}

function goTo(hash) {
  location.hash = hash;
}

// ---------- the read-only view ----------

function formatBirthday(birthday) {
  const text = `${birthday.day} ${MONTHS_LONG[birthday.month - 1]}`;
  return birthday.year ? `${text} ${birthday.year}` : text;
}

// Email and phone entries become links; a handle becomes a link only if it is a web address.
function valueNode(group, value) {
  let href = null;
  if (group.key === 'emails') href = `mailto:${value}`;
  else if (group.key === 'phones') href = `tel:${value.replace(/[^\d+]/g, '')}`;
  else if (group.key === 'handles' && /^https?:\/\//i.test(value)) href = value;
  if (!href) return make('span', 'info-value', value);
  const link = make('a', 'info-value info-link', value);
  link.href = href;
  if (group.key === 'handles') {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return link;
}

function infoItem(label, valueEl) {
  const item = make('div', 'info-item');
  if (label) item.append(make('span', 'info-label', label));
  item.append(valueEl);
  return item;
}

function renderView(page, contact) {
  const name = displayName(contact);
  const head = make('div', 'contact-head');
  const titles = make('div', 'contact-titles');
  titles.append(make('h2', 'section-title', name));
  if (contact.nickname && contact.nickname !== name) {
    titles.append(make('p', 'hint', `“${contact.nickname}”`));
  }
  const edit = make('button', 'btn btn-secondary btn-small', strings['contact.edit']);
  edit.type = 'button';
  edit.dataset.act = 'edit';
  head.append(titles, edit);
  page.append(head);

  let any = false;
  if (contact.birthday) {
    any = true;
    const block = make('div', 'group');
    block.append(make('h3', 'group-title', strings['contact.birthday']), infoItem('', make('span', 'info-value', formatBirthday(contact.birthday))));
    page.append(block);
  }
  GROUPS.forEach((group) => {
    const entries = contact[group.key] || [];
    if (!entries.length) return;
    any = true;
    const block = make('div', 'group');
    block.append(make('h3', 'group-title', strings[group.heading]));
    entries.forEach((entry) => block.append(infoItem(entry.label, valueNode(group, entry.value))));
    page.append(block);
  });
  if (!any) page.append(make('p', 'empty', strings['contact.nothingYet']));
  page.append(renderNotesSection(contact));
}

// ---------- the editor ----------

function nameField(key, stringKey, contact) {
  const label = make('label', 'field');
  const input = make('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  input.dataset.field = key;
  input.value = contact[key] || '';
  label.append(make('span', '', strings[stringKey]), input);
  return label;
}

// A label input with a small arrow that opens a menu of the existing label options.
function labelBox(group, current) {
  const box = make('div', 'label-box');
  box.dataset.group = group.key;

  const input = make('input', 'entry-label');
  input.type = 'text';
  input.autocomplete = 'off';
  input.value = current || '';
  input.placeholder = strings['contact.label'];
  input.setAttribute('aria-label', strings['contact.label']);

  const toggle = make('button', 'label-toggle', '▾');
  toggle.type = 'button';
  toggle.dataset.act = 'labels';
  toggle.setAttribute('aria-label', strings['contact.showLabels']);
  toggle.setAttribute('aria-expanded', 'false');

  box.append(input, toggle);
  return box;
}

// Standard labels, plus any other label already used on a contact in this list.
function labelOptions(group) {
  const seen = new Set(group.labels.map((text) => text.toLowerCase()));
  const extra = [];
  store.list('contact').forEach((contact) => {
    (contact[group.key] || []).forEach((entry) => {
      if (entry.label && !seen.has(entry.label.toLowerCase())) {
        seen.add(entry.label.toLowerCase());
        extra.push(entry.label);
      }
    });
  });
  extra.sort((a, b) => a.localeCompare(b));
  return [...group.labels, ...extra];
}

function closeMenus() {
  document.querySelectorAll('.label-menu').forEach((menu) => menu.remove());
  document.querySelectorAll('.label-toggle[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

function toggleMenu(button) {
  const box = button.closest('.label-box');
  const wasOpen = Boolean(box.querySelector('.label-menu'));
  closeMenus();
  if (wasOpen) return;
  const group = GROUPS.find((g) => g.key === box.dataset.group);
  const menu = make('ul', 'label-menu');
  labelOptions(group).forEach((text) => {
    const item = make('li');
    const option = make('button', 'label-option', text);
    option.type = 'button';
    option.dataset.act = 'pick-label';
    item.append(option);
    menu.append(item);
  });
  box.append(menu);
  button.setAttribute('aria-expanded', 'true');
}

function pickLabel(option) {
  const box = option.closest('.label-box');
  const input = box.querySelector('.entry-label');
  input.value = option.textContent;
  input.dispatchEvent(new Event('input', { bubbles: true })); // so the change is saved
  closeMenus();
  const row = box.closest('.entry');
  row.querySelector('.entry-value').focus();
}

function entryRow(group, entry = {}) {
  const row = make('div', 'entry');

  const value = make(group.multiline ? 'textarea' : 'input', 'entry-value');
  if (group.multiline) {
    value.rows = 2;
  } else {
    value.type = group.inputType;
    value.autocapitalize = 'none';
    value.spellcheck = false;
  }
  value.autocomplete = 'off';
  value.value = entry.value || '';
  value.placeholder = strings[group.placeholder];
  value.setAttribute('aria-label', strings[group.placeholder]);

  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove';
  remove.setAttribute('aria-label', strings['contact.remove']);

  row.append(labelBox(group, entry.label), value, remove);
  return row;
}

function groupBlock(group, entries) {
  const block = make('div', 'group');
  block.dataset.group = group.key;
  block.hidden = entries.length === 0;

  const list = make('div', 'entries');
  entries.forEach((entry) => list.append(entryRow(group, entry)));

  block.append(make('h3', 'group-title', strings[group.heading]), list);
  return block;
}

function birthdayBlock(birthday) {
  const block = make('div', 'group');
  block.dataset.group = 'birthday';
  block.hidden = !birthday;

  const day = make('input');
  day.type = 'number';
  day.min = '1';
  day.max = '31';
  day.inputMode = 'numeric';
  day.dataset.part = 'day';
  day.placeholder = strings['contact.day'];
  day.setAttribute('aria-label', strings['contact.day']);
  day.value = birthday ? birthday.day : '';

  const month = make('select');
  month.dataset.part = 'month';
  month.setAttribute('aria-label', strings['contact.month']);
  const none = make('option', '', strings['contact.month']);
  none.value = '';
  month.append(none);
  MONTHS_SHORT.forEach((name, i) => {
    const option = make('option', '', name);
    option.value = String(i + 1);
    month.append(option);
  });
  month.value = birthday ? String(birthday.month) : '';

  const year = make('input');
  year.type = 'number';
  year.inputMode = 'numeric';
  year.dataset.part = 'year';
  year.placeholder = strings['contact.year'];
  year.setAttribute('aria-label', strings['contact.year']);
  year.value = birthday && birthday.year ? birthday.year : '';

  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove-birthday';
  remove.setAttribute('aria-label', strings['contact.remove']);

  const row = make('div', 'birthday-row');
  row.append(day, month, year, remove);
  block.append(make('h3', 'group-title', strings['contact.birthday']), row, make('p', 'hint birthday-note', strings['contact.birthdayHint']));
  return block;
}

function doneButton(className) {
  const done = make('button', className, strings['contact.done']);
  done.type = 'button';
  done.dataset.act = 'done';
  return done;
}

function discardButton() {
  const button = make('button', 'btn btn-secondary btn-small', strings['contact.discard']);
  button.type = 'button';
  button.dataset.act = 'discard';
  return button;
}

function renderEditor(page, contact) {
  const title = make('h2', 'section-title', displayName(contact) || strings['addContact.title']);
  title.id = 'contact-title';
  const status = make('p', 'save-status');
  status.id = 'contact-status';
  status.setAttribute('aria-live', 'polite');
  const titles = make('div', 'contact-titles');
  titles.append(title, status);
  const head = make('div', 'contact-head');
  head.append(titles, discardButton());

  const discardRow = make('div', 'confirm-row discard-row');
  discardRow.hidden = true;
  const discardYes = make('button', 'btn btn-danger btn-small', strings['contact.discardYes']);
  discardYes.type = 'button';
  discardYes.dataset.act = 'discard-yes';
  const discardNo = make('button', 'btn btn-secondary btn-small', strings['contact.discardNo']);
  discardNo.type = 'button';
  discardNo.dataset.act = 'discard-no';
  discardRow.append(make('span', 'confirm-text', strings[isNew ? 'contact.discardSureNew' : 'contact.discardSure']), discardYes, discardNo);

  const names = make('div', 'form');
  const nameRow = make('div', 'field-row');
  nameRow.append(nameField('firstName', 'addContact.firstName', contact), nameField('lastName', 'addContact.lastName', contact));
  names.append(nameRow, nameField('nickname', 'addContact.nickname', contact));

  const chips = make('div', 'chips');
  let noteRow = null;
  GROUPS.forEach((group) => {
    const chip = make('button', 'chip', strings[group.chip]);
    chip.type = 'button';
    chip.dataset.add = group.key;
    chips.append(chip);
  });
  const birthdayChip = make('button', 'chip', strings['contact.chipBirthday']);
  birthdayChip.type = 'button';
  birthdayChip.dataset.add = 'birthday';
  birthdayChip.hidden = Boolean(contact.birthday);
  chips.append(birthdayChip);
  if (isNew) {
    const noteChip = make('button', 'chip', strings['contact.chipNote']);
    noteChip.type = 'button';
    noteChip.dataset.add = 'note';
    noteChip.classList.add('chip-note'); // looks different from the detail chips above it
    noteRow = make('div', 'chips chips-note');
    noteRow.append(noteChip);
  }

  const danger = make('div', 'danger');
  const ask = make('button', 'link link-danger', strings['contact.delete']);
  ask.type = 'button';
  ask.dataset.act = 'delete';
  const sure = make('div', 'confirm-row');
  sure.hidden = true;
  const yes = make('button', 'btn btn-danger btn-small', strings['contact.deleteYes']);
  yes.type = 'button';
  yes.dataset.act = 'delete-yes';
  const no = make('button', 'btn btn-secondary btn-small', strings['contact.deleteNo']);
  no.type = 'button';
  no.dataset.act = 'delete-no';
  sure.append(make('span', 'confirm-text', strings['contact.deleteSure']), yes, no);
  danger.append(ask, sure);

  page.append(head, discardRow, names);
  GROUPS.forEach((group) => page.append(groupBlock(group, contact[group.key] || [])));
  page.append(birthdayBlock(contact.birthday));
  if (isNew) {
    const pending = make('div', 'pending-notes');
    pending.id = 'pending-notes';
    page.append(pending);
  }
  page.append(chips);
  if (noteRow) page.append(noteRow);
  if (isNew) {
    const create = make('button', 'btn btn-primary btn-form done-bottom', strings['addContact.save']);
    create.type = 'button';
    create.dataset.act = 'save-new';
    page.append(create);
  } else {
    page.append(doneButton('btn btn-primary btn-form done-bottom'), danger);
  }
}

// ---------- showing the right page ----------

function render() {
  const route = parseRoute();
  if (!route) return;
  contactId = route.id;
  editing = route.edit;
  isNew = route.isNew;
  if (isNew) cameFrom = previousHash === '#/contacts' ? '#/contacts' : '#/home';
  newId = null;
  snapshot = null;
  dirty = false;
  birthdayProblem = false;
  clearTimeout(timer);
  closeMenus();

  const page = $('contact-page');
  page.replaceChildren();

  if (!store.isLoaded()) {
    page.append(make('p', 'empty', strings['contacts.loading']));
    return;
  }
  const contact = isNew ? {} : store.get('contact', route.id);
  if (!contact) {
    page.append(make('p', 'empty', strings['contact.notFound']));
    return;
  }
  if (editing && !isNew) {
    const { id, ...fields } = contact;
    snapshot = JSON.parse(JSON.stringify(fields));
  }
  if (editing) renderEditor(page, contact);
  else renderView(page, contact);
}

// ---------- reading the editor and saving ----------

function daysInMonth(month, year) {
  return new Date(year || 2000, month, 0).getDate(); // year 2000 is a leap year, so 29 Feb is allowed without a year
}

// Returns { birthday, problem }. A birthday with a missing or impossible date is not saved, and the note says why.
function readBirthday(block) {
  const note = block.querySelector('.birthday-note');
  const say = (key, isError) => {
    note.textContent = strings[key];
    note.classList.toggle('is-error', isError);
  };
  const day = parseInt(block.querySelector('[data-part="day"]').value, 10);
  const month = parseInt(block.querySelector('[data-part="month"]').value, 10);
  const yearText = block.querySelector('[data-part="year"]').value.trim();

  if (!day && !month && !yearText) {
    say('contact.birthdayHint', false);
    return { birthday: null, problem: false };
  }
  if (!day || !month) {
    say('contact.birthdayIncomplete', true);
    return { birthday: null, problem: true };
  }
  const year = yearText ? parseInt(yearText, 10) : null;
  const yearBad = yearText && !(year >= 1900 && year <= new Date().getFullYear());
  if (yearBad || day < 1 || day > daysInMonth(month, year)) {
    say('contact.errBirthday', true);
    return { birthday: null, problem: true };
  }
  say('contact.birthdayHint', false);
  return { birthday: year ? { day, month, year } : { day, month }, problem: false };
}

function readFields() {
  const page = $('contact-page');
  const fields = { ...(contactId ? store.get('contact', contactId) : {}) };
  delete fields.id;
  MANAGED.forEach((key) => delete fields[key]);

  NAME_KEYS.forEach((key) => {
    const value = page.querySelector(`[data-field="${key}"]`).value.trim();
    if (value) fields[key] = value;
  });

  GROUPS.forEach((group) => {
    const entries = [...page.querySelectorAll(`[data-group="${group.key}"] .entry`)]
      .map((row) => ({
        label: row.querySelector('.entry-label').value.trim(),
        value: row.querySelector('.entry-value').value.trim(),
      }))
      .filter((entry) => entry.value)
      .map((entry) => (entry.label ? entry : { value: entry.value }));
    if (entries.length) fields[group.key] = entries;
  });

  let problem = false;
  const block = page.querySelector('[data-group="birthday"]');
  if (!block.hidden) {
    const result = readBirthday(block);
    if (result.birthday) fields.birthday = result.birthday;
    problem = result.problem;
  }
  return { fields, problem };
}

function setStatus(text, isError = false) {
  const el = $('contact-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-error', isError);
}

// Saves what is on the page. Returns a promise that says whether it worked (true) or not (false).
function save() {
  clearTimeout(timer);
  const id = contactId;
  if (!editing || isNew || !id || !store.get('contact', id)) return Promise.resolve(false);
  const { fields, problem } = readFields(); // read now, so a page change right after cannot mix contacts up
  birthdayProblem = problem;
  if (!NAME_KEYS.some((key) => fields[key])) {
    setStatus(strings['contact.errNeedName'], true);
    return Promise.resolve(false);
  }
  dirty = false;
  setStatus(strings['contact.saving']);
  const run = queue.then(
    () => store.update('contact', id, fields).then(
      () => {
        if (id === contactId) setStatus(strings[problem ? 'contact.savedNoBirthday' : 'contact.saved'], problem);
        return true;
      },
      (error) => {
        if (id === contactId) {
          dirty = true; // still unsaved, so leaving the page tries again
          setStatus(error.message, true);
        }
        return false;
      },
    ),
  );
  queue = run;
  return run;
}

// ---------- events ----------

function updateTitle() {
  const page = $('contact-page');
  const value = (key) => page.querySelector(`[data-field="${key}"]`).value.trim();
  const name = displayName({ firstName: value('firstName'), lastName: value('lastName'), nickname: value('nickname') });
  $('contact-title').textContent = name || (isNew ? strings['addContact.title'] : '…');
}

function addEntry(key) {
  const page = $('contact-page');
  if (key === 'birthday') {
    const block = page.querySelector('[data-group="birthday"]');
    block.hidden = false;
    page.querySelector('[data-add="birthday"]').hidden = true;
    block.querySelector('[data-part="day"]').focus();
    return;
  }
  if (key === 'note') {
    addPendingNote();
    return;
  }
  const group = GROUPS.find((g) => g.key === key);
  const block = page.querySelector(`[data-group="${key}"]`);
  const row = entryRow(group);
  block.hidden = false;
  block.querySelector('.entries').append(row);
  row.querySelector('.entry-value').focus();
}

// New-contact form: a note typed here is kept on the page and saved together with the contact.
function addPendingNote() {
  const block = make('div', 'group pending-note');
  const head = make('div', 'notes-head');
  head.append(make('h3', 'group-title', strings['contact.newNote']));
  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove-note';
  remove.setAttribute('aria-label', strings['contact.removeNote']);
  head.append(remove);
  const fields = createNoteFields();
  block.append(head, fields.element);
  block.noteFields = fields;
  $('pending-notes').append(block);
  fields.focus();
}

function pendingNotes() {
  return [...document.querySelectorAll('#pending-notes .pending-note')].map((block) => block.noteFields.get());
}

// Is there anything on the page that differs from how the contact was when the editor opened (or, when new, anything at all)?
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hasChanges() {
  const { fields } = readFields();
  if (isNew) return Object.keys(fields).length > 0 || pendingNotes().some((n) => n.title || !rich.isEmpty(n.body));
  return canonical(fields) !== canonical(snapshot);
}

function showDiscardQuestion(show) {
  const page = $('contact-page');
  page.querySelector('.discard-row').hidden = !show;
  page.querySelector('[data-act="discard"]').hidden = show;
}

function discard() {
  if (hasChanges()) showDiscardQuestion(true);
  else leaveEditor();
}

function leaveEditor() {
  goTo(isNew ? cameFrom : `#/contact/${contactId}`);
}

// "Yes, discard": put the contact back as it was when the editor opened.
async function discardYes(button) {
  button.disabled = true;
  clearTimeout(timer);
  dirty = false;
  try {
    await queue;
    if (!isNew && canonical(store.get('contact', contactId) && (({ id, ...f }) => f)(store.get('contact', contactId))) !== canonical(snapshot)) {
      await store.update('contact', contactId, snapshot);
    }
    leaveEditor();
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
}

// New contact: save it, then its notes, then show its page.
async function saveNew(button) {
  const { fields, problem } = readFields();
  if (!NAME_KEYS.some((key) => fields[key])) {
    setStatus(strings['contact.errNeedName'], true);
    return;
  }
  if (problem) {
    setStatus(strings['contact.errBirthday'], true);
    return;
  }
  button.disabled = true;
  setStatus(strings['contact.saving']);
  try {
    if (!newId) newId = await store.add('contact', fields);
    const list = pendingNotes().filter((n) => n.title || !rich.isEmpty(n.body));
    for (const n of list) await notes.create({ ...n, contactIds: [newId] });
    goTo(`#/contact/${newId}`);
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
}

function removeEntry(button) {
  const row = button.closest('.entry');
  const block = row.closest('.group');
  row.remove();
  if (!block.querySelector('.entry')) block.hidden = true;
  dirty = true;
  save();
}

function removeBirthday() {
  const page = $('contact-page');
  const block = page.querySelector('[data-group="birthday"]');
  block.querySelectorAll('input, select').forEach((field) => {
    field.value = '';
  });
  block.querySelector('.birthday-note').textContent = strings['contact.birthdayHint'];
  block.querySelector('.birthday-note').classList.remove('is-error');
  block.hidden = true;
  page.querySelector('[data-add="birthday"]').hidden = false;
  dirty = true;
  save();
}

// "Done": make sure everything is saved, then go back to the read-only view.
async function finish(button) {
  button.disabled = true;
  const id = contactId;
  clearTimeout(timer);
  const ok = dirty ? await save() : await queue.then(() => !birthdayProblem && !$('contact-status').classList.contains('is-error'));
  button.disabled = false;
  if (ok && !birthdayProblem) goTo(`#/contact/${id}`);
}

async function deleteContact(button) {
  const id = contactId;
  button.disabled = true;
  clearTimeout(timer);
  dirty = false;
  try {
    await queue;
    await notes.detachContact(id);
    await store.remove('contact', id);
    goTo('#/contacts');
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
}

function showDeleteQuestion(show) {
  const page = $('contact-page');
  page.querySelector('[data-act="delete"]').hidden = show;
  page.querySelector('.danger .confirm-row').hidden = !show;
}

function bindPage() {
  const page = $('contact-page');

  page.addEventListener('input', () => {
    if (!editing || !$('contact-title')) return;
    updateTitle();
    if (isNew) return; // a new contact is saved only when Save is pressed
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY);
  });

  page.addEventListener('change', () => {
    if (editing && dirty) save();
  });

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.add) addEntry(button.dataset.add);
    else if (button.dataset.act === 'edit') goTo(`#/contact/${contactId}/edit`);
    else if (button.dataset.act === 'done') finish(button);
    else if (button.dataset.act === 'discard') discard();
    else if (button.dataset.act === 'discard-no') showDiscardQuestion(false);
    else if (button.dataset.act === 'discard-yes') discardYes(button);
    else if (button.dataset.act === 'save-new') saveNew(button);
    else if (button.dataset.act === 'remove-note') button.closest('.pending-note').remove();
    else if (button.dataset.act === 'labels') toggleMenu(button);
    else if (button.dataset.act === 'pick-label') pickLabel(button);
    else if (button.dataset.act === 'remove') removeEntry(button);
    else if (button.dataset.act === 'remove-birthday') removeBirthday();
    else if (button.dataset.act === 'delete') showDeleteQuestion(true);
    else if (button.dataset.act === 'delete-no') showDeleteQuestion(false);
    else if (button.dataset.act === 'delete-yes') deleteContact(button);
  });

  // A tap anywhere else, or Escape, closes an open label menu.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.label-box')) closeMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });
}

export function initContact() {
  bindPage();

  window.addEventListener('hashchange', (event) => {
    previousHash = new URL(event.oldURL).hash;
    // Leaving the editor (or switching contact) with unsaved typing: save first, and show the page once it is saved.
    const leavingWithChanges = editing && dirty && contactId;
    if (leavingWithChanges) save();
    (leavingWithChanges ? queue : Promise.resolve()).then(render);
  });

  document.addEventListener('folkhold:ready', render);
  document.addEventListener('folkhold:data', render);
}
