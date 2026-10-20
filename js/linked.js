// Notes and events can be linked to several contacts (their "contactIds"). These are the shared rules for changing them.

import * as store from './store.js';

function fieldsOf(item) {
  const { id, ...fields } = item;
  return fields;
}

// Empty values are left out of the saved item.
function clean(values) {
  const out = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 0 || value === false) return;
    out[key] = value;
  });
  return out;
}

export function listOf(type, contactId) {
  return store.list(type).filter((item) => (item.contactIds || []).includes(contactId));
}

export function create(type, values, contactIds) {
  return store.add(type, { ...clean(values), contactIds, createdAt: Date.now() });
}

// Saves a changed item that was opened from the contact "originId". "managed" lists the fields the form handles.
// "appliedIds": the other contacts that get the change too. The rest keep a copy of the old item.
export async function saveEdit(type, item, managed, values, originId, appliedIds) {
  const others = (item.contactIds || []).filter((id) => id !== originId);
  const left = others.filter((id) => !appliedIds.includes(id));

  // The copy is made first, so nothing can be lost if the second step fails.
  if (left.length) await store.add(type, { ...fieldsOf(item), contactIds: left });

  const fields = fieldsOf(item);
  managed.forEach((key) => delete fields[key]);
  Object.assign(fields, clean(values), {
    contactIds: [originId, ...others.filter((id) => appliedIds.includes(id))],
    updatedAt: Date.now(),
  });
  await store.update(type, item.id, fields);
}

// Takes some contacts off an item. If nobody is left, the item is deleted.
export async function removeFromContacts(type, item, contactIds) {
  const rest = (item.contactIds || []).filter((id) => !contactIds.includes(id));
  if (rest.length === 0) await store.remove(type, item.id);
  else await store.update(type, item.id, { ...fieldsOf(item), contactIds: rest });
}

// Used when a contact is deleted: their items lose them, and items that belonged only to them are deleted.
export async function detachContact(type, contactId) {
  for (const item of listOf(type, contactId)) await removeFromContacts(type, item, [contactId]);
}
