-- Execute no SQL Editor do SEU projeto Supabase. Não coloque chaves neste arquivo.
begin;
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  type text not null check (type in ('income','expense')),
  amount bigint not null check (amount > 0 and amount <= 9007199254740991),
  category text not null check (category in ('Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Investimentos','Outros','Supermercado','Restaurantes e delivery','Combustível','Manutenção do veículo','Educação','Assinaturas e serviços','Contas da casa','Compras pessoais','Pets','Viagens','Impostos e taxas','Dívidas e empréstimos','Renda extra','Freelance','Comissões','Vendas','Aluguéis recebidos','Rendimentos','Benefícios','Presentes recebidos')),
  date date not null check (date between date '0001-01-01' and date '9999-12-31'),
  created_at timestamptz not null default now()
);
alter table public.entries drop constraint if exists entries_category_check;
alter table public.entries add constraint entries_category_check
check (category in ('Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Investimentos','Outros','Supermercado','Restaurantes e delivery','Combustível','Manutenção do veículo','Educação','Assinaturas e serviços','Contas da casa','Compras pessoais','Pets','Viagens','Impostos e taxas','Dívidas e empréstimos','Renda extra','Freelance','Comissões','Vendas','Aluguéis recebidos','Rendimentos','Benefícios','Presentes recebidos'));
create index if not exists entries_user_date_idx on public.entries(user_id,date);
alter table public.entries enable row level security;
alter table public.entries force row level security;
revoke all on public.entries from anon;
revoke all on public.entries from authenticated;
grant select, insert, update, delete on public.entries to authenticated;
drop policy if exists entries_read_own on public.entries;
create policy entries_read_own on public.entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists entries_insert_own on public.entries;
create policy entries_insert_own on public.entries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists entries_delete_own on public.entries;
create policy entries_delete_own on public.entries for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists entries_update_own on public.entries;
create policy entries_update_own on public.entries for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
