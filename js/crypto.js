// Encryption layer. Uses only the browser's built-in Web Crypto, so no outside code is needed.
// Nothing in this file talks to the server.
//
// How the keys fit together:
//   password --(slow scramble)--> seed --> login value   (sent to Supabase as the "password")
//                                      \-> password key  (stays in the browser)
//   master key: random, encrypts all data. Stored on the server only in locked form:
//     once locked by the password key, once locked by the recovery key.
//   Changing the password only re-locks the master key. The data is not re-encrypted.

const enc = new TextEncoder();
const dec = new TextDecoder();

const FORMAT = 'v1';
export const PBKDF2_ITERATIONS = 600000;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base 32 without easily confused letters
const RECOVERY_KEY_LENGTH = 52; // characters (256 bits)

// ---------- small helpers ----------

function toBase64Url(bytes) {
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function base32ToBytes(text) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of text) {
    const index = CROCKFORD.indexOf(ch);
    if (index < 0) throw new Error('The recovery key contains an invalid character.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return new Uint8Array(out);
}

async function importAesKey(bytes, extractable = false) {
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', extractable, ['encrypt', 'decrypt']);
}

// Turns one secret into several independent keys ("info" names the purpose).
async function hkdfBytes(secretBytes, info) {
  const key = await crypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) },
    key,
    256,
  );
  return new Uint8Array(bits);
}

// Locks bytes with a key. The result is text: "v1." + random starting value + scrambled data.
async function seal(key, plainBytes, contextText) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: enc.encode(contextText) },
      key,
      plainBytes,
    ),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return `${FORMAT}.${toBase64Url(out)}`;
}

// Unlocks text made by seal(). Fails if the key, the data or the context text is not exactly right.
async function open(key, packageText, contextText) {
  const [format, body] = String(packageText).split('.');
  if (format !== FORMAT || !body) throw new Error('Unknown data format.');
  const bytes = fromBase64Url(body);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(contextText) },
    key,
    bytes.slice(12),
  );
  return new Uint8Array(plain);
}

// ---------- accounts ----------

// Usernames are compared in a standard form: same letters, no capitals, no spaces around.
export function normalizeUsername(name) {
  return String(name).normalize('NFKC').trim().toLowerCase();
}

// Slow on purpose (a fraction of a second): makes guessing passwords expensive.
// Returns the login value to send to Supabase and the password key that stays in the browser.
export async function deriveFromPassword(username, password) {
  const salt = new Uint8Array(
    await crypto.subtle.digest('SHA-256', enc.encode(`folkhold-v1|${normalizeUsername(username)}`)),
  );
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password).normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const seed = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      passwordKey,
      256,
    ),
  );
  return {
    loginSecret: toBase64Url(await hkdfBytes(seed, 'folkhold-v1 login')),
    kek: await importAesKey(await hkdfBytes(seed, 'folkhold-v1 password key')),
  };
}

// At signup: makes the master key and the recovery key, and locks the master key twice.
// "derived" is the result of deriveFromPassword().
export async function createAccountKeys(derived) {
  const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const masterBytes = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));

  const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
  const recoveryWrapKey = await importAesKey(await hkdfBytes(recoveryBytes, 'folkhold-v1 recovery wrap'));

  const base32 = bytesToBase32(recoveryBytes);
  const recoveryKey = base32.match(/.{1,4}/g).join('-'); // e.g. ABCD-EFGH-...

  return {
    masterKey,
    recoveryKey,
    wrappedKeyPassword: await seal(derived.kek, masterBytes, 'folkhold-v1 master-key'),
    wrappedKeyRecovery: await seal(recoveryWrapKey, masterBytes, 'folkhold-v1 master-key'),
  };
}

// At login: unlocks the master key with the password key.
export async function unlockWithPassword(derived, wrappedKeyPassword) {
  try {
    const bytes = await open(derived.kek, wrappedKeyPassword, 'folkhold-v1 master-key');
    return await importAesKey(bytes, true);
  } catch {
    throw new Error('Could not unlock: wrong password.');
  }
}

// When the password is forgotten: unlocks the master key with the recovery key (as typed by the user).
export async function unlockWithRecoveryKey(recoveryKeyText, wrappedKeyRecovery) {
  const clean = String(recoveryKeyText)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (clean.length !== RECOVERY_KEY_LENGTH) {
    throw new Error('A recovery key has 52 characters (13 groups of 4).');
  }
  try {
    const recoveryBytes = base32ToBytes(clean);
    const wrapKey = await importAesKey(await hkdfBytes(recoveryBytes, 'folkhold-v1 recovery wrap'));
    const bytes = await open(wrapKey, wrappedKeyRecovery, 'folkhold-v1 master-key');
    return await importAesKey(bytes, true);
  } catch {
    throw new Error('Could not unlock: wrong recovery key.');
  }
}

// When the password changes: locks the same master key again with the new password key.
export async function rewrapForNewPassword(newDerived, masterKey) {
  const masterBytes = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));
  return seal(newDerived.kek, masterBytes, 'folkhold-v1 master-key');
}

// ---------- data items (contacts, notes, events, tags, settings) ----------

// The item's type and id are part of the lock, so a stored package cannot be moved to another row unnoticed.
function itemContext(type, id) {
  return `folkhold-v1|item|${type}|${id}`;
}

export async function encryptItem(masterKey, type, id, object) {
  return seal(masterKey, enc.encode(JSON.stringify(object)), itemContext(type, id));
}

export async function decryptItem(masterKey, type, id, packageText) {
  try {
    const bytes = await open(masterKey, packageText, itemContext(type, id));
    return JSON.parse(dec.decode(bytes));
  } catch {
    throw new Error('Could not decrypt this item.');
  }
}
