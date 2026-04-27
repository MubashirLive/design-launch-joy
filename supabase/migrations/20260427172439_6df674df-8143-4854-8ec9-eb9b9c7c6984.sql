
alter table public.counters enable row level security;
-- counters have no policies => only callable via SECURITY DEFINER functions

revoke all on function public.next_counter(text) from public, anon;
revoke all on function public.next_admin_id(text) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.increment_forms_count() from public, anon;

grant execute on function public.next_counter(text) to authenticated;
grant execute on function public.next_admin_id(text) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
