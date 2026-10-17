-- Folkhold database setup. Paste this whole file into the Supabase SQL Editor and run it once.
-- The server stores only scrambled (encrypted) packages. It never sees names, notes or dates.

-- 1. Items: every contact, note, event, tag and settings record is one row.
create table public.items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       text not null check (type in ('contact', 'note', 'event', 'tag', 'settings')),
  data       text not null check (length(data) <= 200000),  -- the encrypted package
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_type_idx on public.items (user_id, type);

-- 2. User keys: the scrambled master key, locked once by the password and once by the recovery key.
create table public.user_keys (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  salt                  text not null,
  kdf_iterations        integer not null,
  wrapped_key_password  text not null,
  wrapped_key_recovery  text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 3. Keep "updated_at" correct automatically.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create trigger user_keys_set_updated_at
  before update on public.user_keys
  for each row execute function public.set_updated_at();

-- 4. Access rules: a signed-in user can only ever see and change their own rows.
alter table public.items enable row level security;
alter table public.user_keys enable row level security;

create policy "items: own rows only" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_keys: own row only" on public.user_keys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 5. Privileges: signed-in users may use the tables (the access rules above limit them to their own rows).
-- Visitors who are not signed in get no access at all.
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.user_keys to authenticated;
revoke all on public.items from anon;
revoke all on public.user_keys from anon;
