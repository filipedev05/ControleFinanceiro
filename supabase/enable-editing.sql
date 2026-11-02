-- Execute uma vez no SQL Editor do Supabase para habilitar a edição.
begin;
grant update (description, type, amount, category, date) on public.entries to authenticated;
drop policy if exists entries_update_own on public.entries;
create policy entries_update_own on public.entries for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
