// Accounts: sign up, sign in, unlock, sign out.
// The master key lives in memory, and on this device in a form the page cannot read out (see keystore.js).

import { supabase } from './db.js';
import { USERNAME_EMAIL_DOMAIN } from './config.js';
import { strings } from './strings.js';
import * as vault from './crypto.js';
import { saveKey, loadKey, clearKeys } from './keystore.js';

let masterKey = null;
let userId = null;
let username = null;
let pending = null; // keys made during sign-up that are not saved on the server yet

// Supabase wants an email-shaped login name. We never send mail to it.
function usernameToEmail(name) {
  return `${vault.normalizeUsername(name)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function validateUsername(raw) {
  return /^[a-z0-9._-]{3,32}$/.test(vault.normalizeUsername(raw)) ? null : strings['auth.errUsername'];
}

export function validatePassword(password) {
  return String(password).length >= 10 ? null : strings['auth.errPasswordShort'];
}

// Turns a Supabase error into a message for the user.
function friendly(error) {
  if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
    return new Error(strings['auth.errNetwork']);
  }
  switch (error.code) {
    case 'user_already_exists':
      return new Error(strings['auth.errTaken']);
    case 'signup_disabled':
      return new Error(strings['auth.errSignupOff']);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new Error(strings['auth.errRate']);
    case 'email_address_invalid':
      return new Error(strings['auth.errRejected']);
    case 'invalid_credentials':
      return new Error(strings['auth.errWrong']);
  }
  if (/already registered/i.test(error.message || '')) return new Error(strings['auth.errTaken']);
  return new Error(error.message || strings['auth.errNetwork']);
}

// Called when the page opens. Returns 'signedOut', 'locked' (signed in, but the key is not on this device) or 'ready'.
export async function startup() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return 'signedOut';

  const { data: userData, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
      throw new Error(strings['auth.errNetwork']);
    }
    // The account no longer exists or the session is not valid any more.
    await supabase.auth.signOut({ scope: 'local' });
    await clearKeys().catch(() => {});
    return 'signedOut';
  }

  userId = userData.user.id;
  username = userData.user.email.split('@')[0];
  masterKey = await loadKey(userId).catch(() => null);
  return masterKey ? 'ready' : 'locked';
}

// Creates the account. The keys stay in memory until the user confirms the recovery key (see confirmSetup).
export async function signUp(rawUsername, password) {
  const problem = validateUsername(rawUsername) || validatePassword(password);
  if (problem) throw new Error(problem);

  const name = vault.normalizeUsername(rawUsername);
  const derived = await vault.deriveFromPassword(name, password);
  const keys = await vault.createAccountKeys(derived);

  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(name),
    password: derived.loginSecret,
  });
  if (error) throw friendly(error);
  if (!data.session) throw new Error(strings['auth.errConfirmOn']);

  userId = data.user.id;
  username = name;
  masterKey = keys.masterKey;
  pending = { keys };
  return 'settingUp';
}

// Signs in and unlocks the data. If an earlier sign-up was never finished, it starts the key setup again.
export async function signIn(rawUsername, password) {
  const name = vault.normalizeUsername(rawUsername);
  if (!name || !password) throw new Error(strings['auth.errWrong']);

  const derived = await vault.deriveFromPassword(name, password);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(name),
    password: derived.loginSecret,
  });
  if (error) throw friendly(error);

  userId = data.user.id;
  username = name;

  const { data: row, error: rowError } = await supabase
    .from('user_keys')
    .select('wrapped_key_password')
    .maybeSingle();
  if (rowError) throw new Error(strings['auth.errNetwork']);

  if (!row) {
    const keys = await vault.createAccountKeys(derived);
    masterKey = keys.masterKey;
    pending = { keys };
    return 'settingUp';
  }

  masterKey = await vault.unlockWithPassword(derived, row.wrapped_key_password);
  await saveKey(userId, masterKey).catch(() => {});
  return 'ready';
}

// The user has saved the recovery key: now the locked keys are stored on the server.
export async function confirmSetup() {
  if (!pending) throw new Error(strings['auth.errSetup']);
  const { keys } = pending;
  const { error } = await supabase.from('user_keys').insert({
    kdf_iterations: vault.PBKDF2_ITERATIONS,
    wrapped_key_password: keys.wrappedKeyPassword,
    wrapped_key_recovery: keys.wrappedKeyRecovery,
    recovery_check: keys.recoveryCheck,
  });
  if (error) throw new Error(strings['auth.errSetup']);
  await saveKey(userId, masterKey).catch(() => {});
  pending = null;
}

// Changes the password while signed in. The data is not touched: only the locked copy of the master key is replaced.
export async function changePassword(currentPassword, newPassword) {
  const problem = validatePassword(newPassword);
  if (problem) throw new Error(problem);
  if (!username) throw new Error(strings['auth.errNetwork']);

  const current = await vault.deriveFromPassword(username, currentPassword);
  const { data: row, error } = await supabase.from('user_keys').select('wrapped_key_password').maybeSingle();
  if (error || !row) throw new Error(strings['auth.errNetwork']);
  let master;
  try {
    master = await vault.unlockWithPassword(current, row.wrapped_key_password);
  } catch {
    throw new Error(strings['settings.errCurrentWrong']);
  }
  const next = await vault.deriveFromPassword(username, newPassword);
  const wrapped = await vault.rewrapForNewPassword(next, master);
  const { error: saveError } = await supabase.rpc('change_password', { new_login_secret: next.loginSecret, new_wrapped_key: wrapped });
  if (saveError) throw new Error(strings['auth.errSetup']);
}

// Forgotten password: proves the recovery key to the server, sets a new password, and signs in.
export async function resetPassword(rawUsername, recoveryKeyText, newPassword) {
  const problem = validateUsername(rawUsername) || validatePassword(newPassword);
  if (problem) throw new Error(problem);
  const name = vault.normalizeUsername(rawUsername);
  const email = usernameToEmail(name);

  let verifier;
  try {
    verifier = await vault.recoveryVerifier(recoveryKeyText);
  } catch {
    throw new Error(strings['auth.errResetWrong']);
  }
  const { data: blob, error } = await supabase.rpc('get_recovery_blob', { p_email: email, p_verifier: verifier });
  if (error) throw new Error(strings['auth.errNetwork']);
  if (!blob) throw new Error(strings['auth.errResetWrong']);

  let master;
  try {
    master = await vault.unlockWithRecoveryKey(recoveryKeyText, blob);
  } catch {
    throw new Error(strings['auth.errResetWrong']);
  }
  const next = await vault.deriveFromPassword(name, newPassword);
  const wrapped = await vault.rewrapForNewPassword(next, master);
  const { data: ok, error: saveError } = await supabase.rpc('reset_password', {
    p_email: email,
    p_verifier: verifier,
    new_login_secret: next.loginSecret,
    new_wrapped_key: wrapped,
  });
  if (saveError) throw new Error(strings['auth.errNetwork']);
  if (!ok) throw new Error(strings['auth.errResetWrong']);
  return signIn(name, newPassword);
}

// Deletes the account and everything stored for it on the server, after checking the password once more.
export async function deleteAccount(password) {
  if (!username) throw new Error(strings['auth.errNetwork']);
  const derived = await vault.deriveFromPassword(username, password);
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: derived.loginSecret });
  if (error) throw friendly(error);
  const { error: deleteError } = await supabase.rpc('delete_my_account');
  if (deleteError) throw new Error(strings['settings.errDelete']);
  await signOut();
}

export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
  await clearKeys().catch(() => {});
  masterKey = null;
  userId = null;
  username = null;
  pending = null;
}

export function getPendingRecoveryKey() {
  return pending ? pending.keys.recoveryKey : null;
}

export function getUsername() {
  return username;
}

export function getMasterKey() {
  return masterKey;
}
