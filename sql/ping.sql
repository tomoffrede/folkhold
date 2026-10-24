create or replace function public.ping()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform 1 from public.user_keys limit 1;
  return 'ok';
end;
$$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
