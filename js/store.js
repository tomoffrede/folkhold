// Your data: loads, decrypts, keeps in memory, and saves (encrypted) to Supabase.
// Every contact, note, event, tag and setting is one "item". Other files use list(), add() and loadAll().

import { supabase } from './db.js';
import { getMasterKey } from './auth.js';
import * as vault from './crypto.js';
import { strings } from './strings.js';

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request, so we ask page by page
const byType = new Map(); // type -> Map of id -> item (decrypted)
let loaded = false;

// Tells the screens that something was saved, added or deleted (the contacts list redraws itself).
function saved() {
  document.dispatchEvent(new Event('folkhold:saved'));
}

function itemsOf(type) {
  if (!byType.has(type)) byType.set(type, new Map());
  return byType.get(type);
}

const versions = new Map(); // id -> "updated_at" as the server last told us (to notice changes made on another device)
let writing = 0; // saves in progress: a refresh waits, so it cannot bring back older data

// One page after another: every row of this user as { id, type, data, updated_at }.
async function fetchRows() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('items')
      .select('id, type, data, updated_at')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(strings['data.errLoad']);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Downloads everything, decrypts it, and replaces what is in memory.
// Returns how many items could not be decrypted (they are skipped, not deleted).
export async function loadAll() {
  const key = getMasterKey();
  if (!key) throw new Error(strings['data.errLoad']);

  const rows = await fetchRows();

  byType.clear();
  versions.clear();
  let failed = 0;
  for (const row of rows) {
    try {
      const fields = await vault.decryptItem(key, row.type, row.id, row.data);
      itemsOf(row.type).set(row.id, { ...fields, id: row.id });
      versions.set(row.id, row.updated_at);
    } catch {
      failed += 1;
    }
  }
  loaded = true;
  document.dispatchEvent(new Event('folkhold:data')); // everything was (re)loaded
  return { failed };
}

// Quietly brings in what changed on another device (and drops what was deleted there). Open forms are left alone.
// Returns true when something changed.
export async function sync() {
  const key = getMasterKey();
  if (!key || !loaded || writing) return false;
  const rows = await fetchRows();
  if (writing) return false; // a save started meanwhile: the rows may already be out of date
  let changed = false;
  const seen = new Set();
  for (const row of rows) {
    seen.add(row.id);
    if (versions.get(row.id) === row.updated_at && itemsOf(row.type).has(row.id)) continue;
    try {
      const fields = await vault.decryptItem(key, row.type, row.id, row.data);
      itemsOf(row.type).set(row.id, { ...fields, id: row.id });
      versions.set(row.id, row.updated_at);
      changed = true;
    } catch {
      // unreadable: skipped, as when loading
    }
  }
  byType.forEach((items) => {
    [...items.keys()].forEach((id) => {
      if (!seen.has(id)) {
        items.delete(id);
        versions.delete(id);
        changed = true;
      }
    });
  });
  if (changed) saved();
  return changed;
}

// The version of an item (when it was last saved on the server), for ordering.
export function version(id) {
  return versions.get(id) || '';
}

// True once everything has been downloaded and decrypted.
export function isLoaded() {
  return loaded;
}

// One item by id, or null if there is none.
export function get(type, id) {
  return itemsOf(type).get(id) || null;
}

// All items of one type, for example list('contact'). Returns a new array each time.
export function list(type) {
  return [...itemsOf(type).values()];
}

// Saves a new item. "fields" is a plain object. The id is made here because it is part of the encryption.
export async function add(type, fields) {
  const key = getMasterKey();
  if (!key) throw new Error(strings['data.errSave']);
  const id = crypto.randomUUID();
  writing += 1;
  try {
    const data = await vault.encryptItem(key, type, id, fields);
    const { data: made, error } = await supabase.from('items').insert({ id, type, data }).select('updated_at');
    if (error) throw new Error(strings['data.errSave']);
    if (made && made[0]) versions.set(id, made[0].updated_at);
  } finally {
    writing -= 1;
  }
  itemsOf(type).set(id, { ...fields, id });
  saved();
  return id;
}

// Replaces an item's fields with new ones (send the complete set of fields, not only the changed ones).
// If the item was changed on another device since it was loaded, nothing is overwritten: the newest data is
// brought in and an error with "conflict" set is thrown, so the person can look and try again.
export async function update(type, id, fields) {
  const key = getMasterKey();
  if (!key) throw new Error(strings['data.errSave']);
  writing += 1;
  let conflict = false;
  try {
    const data = await vault.encryptItem(key, type, id, fields);
    const known = versions.get(id);
    const send = async (checkVersion) => {
      let query = supabase.from('items').update({ data }).eq('id', id).eq('type', type);
      if (checkVersion && known) query = query.eq('updated_at', known);
      return query.select('id, updated_at');
    };
    let { data: rows, error } = await send(true);
    if (error) throw new Error(strings['data.errSave']);
    if ((!rows || rows.length !== 1) && known) {
      // Nothing matched: either another device saved it, or the version text did not compare. Look at the server.
      const { data: now } = await supabase.from('items').select('updated_at').eq('id', id).maybeSingle();
      if (now && now.updated_at !== known) conflict = true;
      else if (now) ({ data: rows, error } = await send(false)); // same version after all: save without the check
    }
    if (!conflict) {
      if (error || !rows || rows.length !== 1) throw new Error(strings['data.errSave']);
      if (rows[0].updated_at) versions.set(id, rows[0].updated_at);
    }
  } finally {
    writing -= 1;
  }
  if (conflict) {
    await sync().catch(() => {});
    const problem = new Error(strings['data.errConflict']);
    problem.conflict = true;
    throw problem;
  }
  itemsOf(type).set(id, { ...fields, id });
  saved();
}

// Deletes an item for good.
export async function remove(type, id) {
  writing += 1;
  try {
    const { data: rows, error } = await supabase.from('items').delete().eq('id', id).eq('type', type).select('id');
    if (error || !rows || rows.length !== 1) throw new Error(strings['data.errDelete']);
  } finally {
    writing -= 1;
  }
  itemsOf(type).delete(id);
  versions.delete(id);
  saved();
}
