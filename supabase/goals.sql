-- Execute no SQL Editor do Supabase. Não altera nem apaga lançamentos existentes.
begin;
create table if not exists public.goals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check (char_length(btrim(title)) between 1 and 100),
 kind text not null check (kind in ('spending','saving')),
 target_amount bigint not null check (target_amount > 0 and target_amount <= 9007199254740991),
 saved_amount bigint not null default 0 check (saved_amount between 0 and 9007199254740991),
 start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and left(start_month,4) <> '0000'),
 end_month text not null check (end_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' and left(end_month,4) <> '0000'),
 category text not null default '',
 description_filter text not null default '' check (char_length(description_filter) <= 120),
 created_at timestamptz not null default now(),
 check (end_month >= start_month),
 check (kind <> 'spending' or start_month = end_month),
 check (kind <> 'saving' or (category = '' and description_filter = '')),
 check (kind <> 'spending' or saved_amount = 0)
);
create index if not exists goals_user_period_idx on public.goals(user_id,start_month,end_month);
alter table public.goals enable row level security;
alter table public.goals force row level security;
revoke all on public.goals from anon, authenticated;
grant select, insert, delete on public.goals to authenticated;
grant update (title,kind,target_amount,saved_amount,start_month,end_month,category,description_filter) on public.goals to authenticated;
drop policy if exists goals_read_own on public.goals;
create policy goals_read_own on public.goals for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists goals_insert_own on public.goals;
create policy goals_insert_own on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists goals_update_own on public.goals;
create policy goals_update_own on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists goals_delete_own on public.goals;
create policy goals_delete_own on public.goals for delete to authenticated using ((select auth.uid()) = user_id);
commit;
