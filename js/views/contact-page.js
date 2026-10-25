// The contact page. It opens as a read-only view; "Edit contact" opens the editor, which saves by itself.
//   #/contact/<id>        the view
//   #/contact/<id>/edit   the editor

import { strings, t } from '../strings.js';
import * as settings from '../settings.js';
import { collapsible } from './section.js';
import { formatDate, lastTogether, relative, parseDate } from '../dates.js';
import * as store from '../store.js';
import * as notes from '../notes.js';
import * as events from '../events.js';
import { renderEventsSection } from './contact-events.js';
import * as birthdays from '../birthdays.js';
import { showToast } from './toast.js';
import { createEventFields, shortName } from './event-fields.js';
import { createTagInput } from './tag-input.js';
import * as tags from '../tags.js';
import { renderNotesSection } from './contact-notes.js';
import { createNoteFields } from './note-fields.js';
import * as rich from '../richtext.js';
import { displayName, filterByTag } from './contacts.js';
import { confirmModal } from './modal.js';
import { locale } from '../lang.js';
import * as relations from '../relations.js';
import { RELATION_GROUP, relationBlock, relationRow, readRelations, renderRelationsSection } from './relation-rows.js';
import { personIcon } from './icons.js';

const $ = (id) => document.getElementById(id);
const SAVE_DELAY = 700; // milliseconds of quiet after typing before saving

// The lists of entries on a contact. "labels" are the standard label options offered in the label menu.
const GROUPS = [
  { key: 'emails', heading: 'contact.emails', chip: 'contact.chipEmail', placeholder: 'contact.emailPlaceholder', inputType: 'email', labels: [strings['label.personal'], strings['label.work']] },
  { key: 'phones', heading: 'contact.phones', chip: 'contact.chipPhone', placeholder: 'contact.phonePlaceholder', inputType: 'tel', labels: [strings['label.mobile'], strings['label.home'], strings['label.work']] },
  { key: 'addresses', heading: 'contact.addresses', chip: 'contact.chipAddress', placeholder: 'contact.addressPlaceholder', multiline: true, labels: [strings['label.home'], strings['label.work']] },
  { key: 'handles', heading: 'contact.handles', chip: 'contact.chipHandle', placeholder: 'contact.handlePlaceholder', inputType: 'text', labels: ['Instagram', 'Facebook', 'LinkedIn', 'Telegram', 'WhatsApp', 'Signal', 'X'] },
];
const NAME_KEYS = ['firstName', 'lastName', 'nickname'];
// Everything the editor handles. Any other saved field is kept as it is.
const MANAGED = [...NAME_KEYS, 'tagIds', 'birthday', 'met', 'relations', ...GROUPS.map((group) => group.key)];
const MONTHS_SHORT = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(locale(), { month: 'short' }));
const MONTHS_LONG = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(locale(), { month: 'long' }));

let contactId = null;
let editing = false;
let isNew = false; // the "add contact" form: nothing is saved until the Save button
let snapshot = null; // the contact as it was when the editor opened, for "Discard changes"
let newId = null; // set once a new contact has been saved, so pressing Save again cannot make a second one
let dirty = false; // there are typed changes that are not saved yet
let birthdayProblem = false; // the last save left out an impossible birthday
let timer = null;
let tagInput = null; // the tag field of the editor that is open
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
  const text = t('dates.dayMonth', { d: birthday.day, m: MONTHS_LONG[birthday.month - 1] });
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

  const tagList = (contact.tagIds || []).map((id) => tags.get(id)).filter(Boolean);
  if (tagList.length) {
    const row = make('div', 'tag-row');
    tagList.forEach((tag) => {
      const chip = make('button', 'tag-chip tag-link', tag.name);
      chip.type = 'button';
      chip.dataset.tag = tag.id;
      chip.title = strings['tags.showContacts'];
      row.append(chip);
    });
    page.append(row);
  }

  const lastMet = settings.get('showLastMet') ? lastTogether(events.listFor(contact.id)) : null;
  if (lastMet) {
    page.append(make('p', 'last-met', t('contact.lastMet', { when: formatDate(lastMet.event.date), ago: relative(lastMet.time) })));
  }

  const details = collapsible({ key: 'details', title: strings['contact.details'], defaultOpen: false, className: 'details' });
  const previewParts = [];
  if (contact.birthday) {
    previewParts.push(strings['contact.birthday']);
    const block = make('div', 'group');
    block.append(make('h3', 'group-title', strings['contact.birthday']), infoItem('', make('span', 'info-value', formatBirthday(contact.birthday))));
    details.bodyEl.append(block);
  }
  if (contact.met) {
    previewParts.push(strings['contact.met']);
    const block = make('div', 'group');
    block.append(make('h3', 'group-title', strings['contact.met']), infoItem('', make('span', 'info-value', formatDate(contact.met))));
    details.bodyEl.append(block);
  }
  GROUPS.forEach((group) => {
    const entries = contact[group.key] || [];
    if (!entries.length) return;
    previewParts.push(entries.length > 1 ? `${strings[group.heading]} ×${entries.length}` : strings[group.heading]);
    const block = make('div', 'group');
    block.append(make('h3', 'group-title', strings[group.heading]));
    entries.forEach((entry) => block.append(infoItem(entry.label, valueNode(group, entry.value))));
    details.bodyEl.append(block);
  });
  if (!previewParts.length) details.bodyEl.append(make('p', 'empty', strings['contact.nothingYet']));
  details.update({ preview: previewParts.length ? previewParts.join(' · ') : strings['contact.nothingYet'] });
  page.append(details);
  const relationsSection = renderRelationsSection(contact, render);
  if (relationsSection) page.append(relationsSection);
  page.append(renderEventsSection(contact), renderNotesSection(contact));
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
  const group = [...GROUPS, RELATION_GROUP].find((g) => g.key === box.dataset.group);
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

// "Met": when you first met, typed freely like an event date (a year is enough).
function metBlock(met) {
  const block = make('div', 'group');
  block.dataset.group = 'met';
  block.hidden = !met;
  const input = make('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.dataset.part = 'met';
  input.placeholder = strings['contact.metPlaceholder'];
  input.setAttribute('aria-label', strings['contact.met']);
  input.value = met ? met.src || met.text || '' : '';
  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove-met';
  remove.setAttribute('aria-label', strings['contact.remove']);
  const row = make('div', 'met-row');
  row.append(input, remove);
  const reading = make('p', 'date-reading met-reading');
  block.append(make('h3', 'group-title', strings['contact.met']), row, reading);
  showMetReading(block);
  return block;
}

// Reads the "Met" box. Returns { date } or { problem: the text key of what is wrong }; an empty box is neither.
function readMet(block) {
  const text = block.querySelector('[data-part="met"]').value;
  if (!text.trim()) return {};
  const result = parseDate(text);
  if (result.error) return { problem: `event.err.${result.error}` };
  if (result.yearly) return { problem: 'event.err.needYear' }; // a day and month alone is not a time you met
  return { date: result.date };
}

function showMetReading(block) {
  const text = block.querySelector('[data-part="met"]').value;
  const result = parseDate(text);
  const reading = block.querySelector('.met-reading');
  const bad = result.error || result.yearly;
  reading.textContent = !text.trim() ? '' : bad ? strings[result.error === 'needYear' || result.yearly ? 'event.err.needYear' : 'event.readingUnsure'] : `→ ${result.reading}`;
  reading.classList.toggle('is-unsure', Boolean(bad));
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

  const names = make('div', 'form');
  const nameRow = make('div', 'field-row');
  nameRow.append(nameField('firstName', 'addContact.firstName', contact), nameField('lastName', 'addContact.lastName', contact));
  tagInput = createTagInput({ tagIds: contact.tagIds || [], immediate: !isNew, onChange: tagsChanged });
  const tagField = make('div', 'field');
  tagField.append(make('span', '', strings['tags.label']), tagInput.element);
  names.append(nameRow, nameField('nickname', 'addContact.nickname', contact), tagField);

  const chips = make('div', 'chips');
  const hiddenFields = settings.get('hiddenFields') || []; // detail buttons switched off in Settings
  let noteRow = null;
  GROUPS.forEach((group) => {
    const chip = make('button', 'chip', strings[group.chip]);
    chip.type = 'button';
    chip.dataset.add = group.key;
    if (hiddenFields.includes(group.key)) chip.dataset.off = '1';
    chips.append(chip);
  });
  const birthdayChip = make('button', 'chip', strings['contact.chipBirthday']);
  birthdayChip.type = 'button';
  birthdayChip.dataset.add = 'birthday';
  birthdayChip.hidden = Boolean(contact.birthday);
  if (hiddenFields.includes('birthday')) birthdayChip.dataset.off = '1';
  chips.append(birthdayChip);
  const metChip = make('button', 'chip', strings['contact.chipMet']);
  metChip.type = 'button';
  metChip.dataset.add = 'met';
  metChip.hidden = Boolean(contact.met);
  if (hiddenFields.includes('met')) metChip.dataset.off = '1';
  chips.append(metChip);
  const relationRowChips = make('div', 'chips chips-relation');
  const relationChip = make('button', 'chip chip-relation');
  relationChip.type = 'button';
  relationChip.dataset.add = 'relations';
  relationChip.append(personIcon(2), strings['contact.chipRelation']);
  if (hiddenFields.includes('relations')) relationChip.dataset.off = '1';
  relationRowChips.append(relationChip);
  if (isNew) {
    const noteChip = make('button', 'chip', strings['contact.chipNote']);
    noteChip.type = 'button';
    noteChip.dataset.add = 'note';
    noteChip.classList.add('chip-note'); // looks different from the detail chips above it
    const eventChip = make('button', 'chip chip-note', strings['contact.chipEvent']);
    eventChip.type = 'button';
    eventChip.dataset.add = 'event';
    noteRow = make('div', 'chips chips-note');
    noteRow.append(eventChip, noteChip);
  }

  const danger = make('div', 'danger');
  const ask = make('button', 'link link-danger', strings['contact.delete']);
  ask.type = 'button';
  ask.dataset.act = 'delete';
  danger.append(ask);

  page.append(head, names);
  GROUPS.forEach((group) => page.append(groupBlock(group, contact[group.key] || [])));
  page.append(birthdayBlock(contact.birthday), metBlock(contact.met), relationBlock(contact, isNew));
  if (isNew) {
    const pending = make('div', 'pending-notes');
    pending.id = 'pending-notes';
    page.append(pending);
  }
  page.append(chips, relationRowChips);
  if (noteRow) page.append(noteRow);
  if (isNew) {
    const problem = make('p', 'form-error');
    problem.id = 'contact-new-error';
    problem.setAttribute('role', 'alert');
    problem.hidden = true;
    page.append(problem);
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

  const relationList = readRelations(page);
  if (relationList.length) fields.relations = relationList;

  if (tagInput && tagInput.ids().length) fields.tagIds = tagInput.ids();

  let problem = null; // the text key of what could not be saved, if anything
  const block = page.querySelector('[data-group="birthday"]');
  if (!block.hidden) {
    const result = readBirthday(block);
    if (result.birthday) fields.birthday = result.birthday;
    if (result.problem) problem = 'contact.errBirthday';
  }
  const metBox = page.querySelector('[data-group="met"]');
  if (!metBox.hidden) {
    const result = readMet(metBox);
    if (result.date) fields.met = result.date;
    if (result.problem && !problem) problem = result.problem;
  }
  return { fields, problem };
}

// A tag was added or removed: while editing, that is saved at once.
function tagsChanged() {
  if (isNew || !editing) return;
  dirty = true;
  save();
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
  if (key === 'met') {
    const block = page.querySelector('[data-group="met"]');
    block.hidden = false;
    page.querySelector('[data-add="met"]').hidden = true;
    block.querySelector('[data-part="met"]').focus();
    return;
  }
  if (key === 'note') {
    addPendingNote();
    return;
  }
  if (key === 'event') {
    addPendingEvent();
    return;
  }
  if (key === 'relations') {
    const block = page.querySelector('[data-group="relations"]');
    const row = relationRow({}, contactId, isNew);
    block.hidden = false;
    block.querySelector('.entries').append(row);
    toggleMenu(row.querySelector('.label-toggle')); // the relationship choices open at once
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

// The same for an event: kept on the page and saved together with the contact.
function addPendingEvent() {
  const block = make('div', 'group pending-note pending-event');
  const head = make('div', 'notes-head');
  head.append(make('h3', 'group-title', strings['contact.newEvent']));
  const remove = make('button', 'entry-remove', '×');
  remove.type = 'button';
  remove.dataset.act = 'remove-note';
  remove.setAttribute('aria-label', strings['contact.removeEvent']);
  head.append(remove);
  const fields = createEventFields();
  block.append(head, fields.element);
  block.eventFields = fields;
  $('pending-notes').append(block);
  block.eventFields.setName(shortName(typedName()));
  fields.focus();
}

// The name typed so far in the new-contact form, used in the labels of its events.
function typedName() {
  const value = (key) => ($('contact-page').querySelector(`[data-field="${key}"]`) || { value: '' }).value.trim();
  return { firstName: value('firstName'), nickname: value('nickname'), lastName: value('lastName') };
}

function syncEventNames() {
  document.querySelectorAll('#pending-notes .pending-event').forEach((block) => block.eventFields.setName(shortName(typedName())));
}

function pendingEvents() {
  return [...document.querySelectorAll('#pending-notes .pending-event')].map((block) => block.eventFields.get());
}

function pendingNotes() {
  return [...document.querySelectorAll('#pending-notes .pending-note:not(.pending-event)')].map((block) => block.noteFields.get());
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
  if (isNew) {
    const blankEvent = (e) => !e.title && !e.details && e.blank;
    return Object.keys(fields).length > 0 || tagInput.count() > 0 || pendingNotes().some((n) => n.title || !rich.isEmpty(n.body)) || pendingEvents().some((e) => !blankEvent(e));
  }
  return canonical(fields) !== canonical(snapshot);
}

async function discard(button) {
  if (!hasChanges()) return leaveEditor();
  const yes = await confirmModal({
    text: strings[isNew ? 'contact.discardSureNew' : 'contact.discardSure'],
    yes: strings['contact.discardYes'],
    no: strings['contact.discardNo'],
  });
  if (yes) discardYes(button);
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
// Problems with a new contact are shown right above the Save button.
function showNewError(message) {
  const el = $('contact-new-error');
  if (!el) return;
  el.textContent = message || '';
  el.hidden = !message;
  if (message) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

async function saveNew(button) {
  showNewError('');
  const { fields, problem } = readFields();
  if (!NAME_KEYS.some((key) => fields[key])) {
    showNewError(strings['contact.errNeedName']);
    return;
  }
  if (problem) {
    showNewError(strings[problem]);
    return;
  }
  const eventList = pendingEvents().filter((e) => e.title || e.details || !e.blank);
  const badEvent = eventList.find((e) => !e.date);
  if (badEvent) {
    showNewError(strings[`event.err.${badEvent.problem || 'empty'}`]);
    return;
  }
  // A pending event that is really this person's birthday becomes their birthday detail.
  let movedBirthday = null;
  if (!fields.birthday && eventList.length) {
    const found = eventList.find((e) => birthdays.detect(e, fields));
    if (found) {
      movedBirthday = found;
      fields.birthday = birthdays.detect(found, fields);
      eventList.splice(eventList.indexOf(found), 1);
    }
  }
  button.disabled = true;
  setStatus(strings['contact.saving']);
  try {
    if (!newId) {
      await tagInput.resolve();
      if (tagInput.ids().length) fields.tagIds = tagInput.ids();
      if (fields.relations) fields.relations = await relations.materialize(fields.relations);
      newId = await store.add('contact', fields);
    }
    const list = pendingNotes().filter((n) => n.title || !rich.isEmpty(n.body));
    for (const n of list) await notes.create({ ...n, contactIds: [newId] });
    for (const e of eventList) await events.create({ title: e.title, details: e.details, date: e.date, repeat: e.repeat, kind: e.kind, contactIds: [newId] });
    goTo(`#/contact/${newId}`);
    if (movedBirthday) showToast(t('birthday.saved', { name: displayName(fields), date: formatDate(movedBirthday.date) }));
  } catch (error) {
    showNewError(error.message);
    button.disabled = false;
  }
}

function removeEntry(button) {
  const row = button.closest('.entry');
  const block = row.closest('.group');
  const owner = row.classList.contains('rel-inbound') ? { id: row.dataset.owner, relId: row.dataset.relId } : null;
  row.remove();
  if (!block.querySelector('.entry')) block.hidden = true;
  if (owner) {
    // Saved on the other contact: removed there, at once.
    relations.removeFrom(owner.id, owner.relId).catch((error) => setStatus(error.message, true));
    return;
  }
  dirty = true;
  save();
}

function removeMet() {
  const page = $('contact-page');
  const block = page.querySelector('[data-group="met"]');
  block.querySelector('[data-part="met"]').value = '';
  showMetReading(block);
  block.hidden = true;
  page.querySelector('[data-add="met"]').hidden = false;
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
    await relations.detachContact(store.get('contact', id));
    await notes.detachContact(id);
    await events.detachContact(id);
    await store.remove('contact', id);
    goTo('#/contacts');
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
}

async function askDelete(button) {
  const yes = await confirmModal({
    text: strings['contact.deleteSure'],
    yes: strings['contact.deleteYes'],
    no: strings['contact.deleteNo'],
  });
  if (yes) deleteContact(button);
}

function bindPage() {
  const page = $('contact-page');

  page.addEventListener('input', (event) => {
    if (!editing || !$('contact-title')) return;
    updateTitle();
    if (isNew) syncEventNames();
    if (event.target.dataset && event.target.dataset.part === 'met') showMetReading(event.target.closest('[data-group="met"]'));
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
    else if (button.dataset.tag) filterByTag(button.dataset.tag);
    else if (button.dataset.act === 'edit') goTo(`#/contact/${contactId}/edit`);
    else if (button.dataset.act === 'done') finish(button);
    else if (button.dataset.act === 'discard') discard(button);
    else if (button.dataset.act === 'save-new') saveNew(button);
    else if (button.dataset.act === 'remove-note') button.closest('.pending-note').remove();
    else if (button.dataset.act === 'labels') toggleMenu(button);
    else if (button.dataset.act === 'pick-label') pickLabel(button);
    else if (button.dataset.act === 'remove') removeEntry(button);
    else if (button.dataset.act === 'remove-birthday') removeBirthday();
    else if (button.dataset.act === 'remove-met') removeMet();
    else if (button.dataset.act === 'delete') askDelete(button);
  });

  // A tap anywhere else, or Escape, closes an open label menu.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.label-box, .rel-field, .chip-relation')) closeMenus();
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
