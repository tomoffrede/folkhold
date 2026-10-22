-- Folkhold step 12: password reset with the recovery key, changing the password, and account deletion.
-- Paste this whole file into the Supabase SQL Editor and run it once (after schema.sql).
-- Nothing here can read your data: it is all encrypted. These functions only move keys and the login password.

-- 1. A fingerprint of the recovery key (the key itself is never stored). New accounts fill it in; older test accounts stay empty.
alter table public.user_keys add column if not exists recovery_check text;

-- 2. Delete my own account: removes the login and, through "on delete cascade", every item and key row.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- 3. Change my password: sets the new login value and the re-locked master key in one step.
create or replace function public.change_password(new_login_secret text, new_wrapped_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if length(new_login_secret) < 20 or length(new_wrapped_key) < 20 then
    raise exception 'invalid input';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_login_secret, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = auth.uid();
  update public.user_keys set wrapped_key_password = new_wrapped_key where user_id = auth.uid();
end;
$$;

-- 4. Forgotten password, step 1: hands out the recovery-locked master key, but only to someone who proves they hold the recovery key.
create or replace function public.get_recovery_blob(p_email text, p_verifier text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select k.wrapped_key_recovery
    from auth.users u
    join public.user_keys k on k.user_id = u.id
   where u.email = lower(p_email)
     and k.recovery_check is not null
     and k.recovery_check = encode(extensions.digest(p_verifier, 'sha256'), 'hex');
$$;

-- 5. Forgotten password, step 2: sets a new password, again only for someone who holds the recovery key. Signs out all devices.
create or replace function public.reset_password(p_email text, p_verifier text, new_login_secret text, new_wrapped_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  if length(new_login_secret) < 20 or length(new_wrapped_key) < 20 then
    return false;
  end if;
  select u.id into found_id
    from auth.users u
    join public.user_keys k on k.user_id = u.id
   where u.email = lower(p_email)
     and k.recovery_check is not null
     and k.recovery_check = encode(extensions.digest(p_verifier, 'sha256'), 'hex');
  if found_id is null then
    return false;
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_login_secret, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = found_id;
  update public.user_keys set wrapped_key_password = new_wrapped_key where user_id = found_id;
  begin
    delete from auth.sessions where user_id = found_id;
  exception when others then
    null; -- signing out other devices is a bonus; the reset itself must not fail because of it
  end;
  return true;
end;
$$;

-- 6. Who may call what.
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.change_password(text, text) from public, anon;
revoke all on function public.get_recovery_blob(text, text) from public;
revoke all on function public.reset_password(text, text, text, text) from public;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.change_password(text, text) to authenticated;
grant execute on function public.get_recovery_blob(text, text) to anon, authenticated;
grant execute on function public.reset_password(text, text, text, text) to anon, authenticated;
