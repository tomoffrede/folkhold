// Your data: loads, decrypts, keeps in memory, and saves (encrypted) to Supabase.
// Every contact, note, event, tag and setting is one "item". Other files use list(), add() and loadAll().

import { supabase } from './db.js';
import { getMasterKey } from './auth.js';
import * as vault from './crypto.js';
import { strings } from './strings.js';

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request, so we ask page by page
const byType = new Map(); // type -> Map of id -> item (decrypted)

function itemsOf(type) {
  if (!byType.has(type)) byType.set(type, new Map());
  return byType.get(type);
}

// Downloads everything, decrypts it, and replaces what is in memory.
// Returns how many items could not be decrypted (they are skipped, not deleted).
export async function loadAll() {
  const key = getMasterKey();
  if (!key) throw new Error(strings['data.errLoad']);

  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('items')
      .select('id, type, data')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(strings['data.errLoad']);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  byType.clear();
  let failed = 0;
  for (const row of rows) {
    try {
      const fields = await vault.decryptItem(key, row.type, row.id, row.data);
      itemsOf(row.type).set(row.id, { ...fields, id: row.id });
    } catch {
      failed += 1;
    }
  }
  return { failed };
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
  const data = await vault.encryptItem(key, type, id, fields);
  const { error } = await supabase.from('items').insert({ id, type, data });
  if (error) throw new Error(strings['data.errSave']);
  itemsOf(type).set(id, { ...fields, id });
  return id;
}
