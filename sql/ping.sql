-- Keep-alive: a tiny function that a scheduled job calls once a day, so the free Supabase project never looks inactive.
-- It reads one row from a table (it returns nothing private; the access rules still apply) and answers "ok".
create or replace function public.ping()
returns text
language plpgsql
stable
as $$
begin
  perform 1 from public.user_keys limit 1;
  return 'ok';
end;
$$;

grant execute on function public.ping() to anon, authenticated;
