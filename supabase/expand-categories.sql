-- Execute no SQL Editor do Supabase para aceitar as novas categorias.
-- Preserva todas as categorias antigas e os registros existentes.
begin;
alter table public.entries drop constraint if exists entries_category_check;
alter table public.entries add constraint entries_category_check
check (category in ('Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Investimentos','Outros','Supermercado','Restaurantes e delivery','Combustível','Manutenção do veículo','Educação','Assinaturas e serviços','Contas da casa','Compras pessoais','Pets','Viagens','Impostos e taxas','Dívidas e empréstimos','Renda extra','Freelance','Comissões','Vendas','Aluguéis recebidos','Rendimentos','Benefícios','Presentes recebidos'));
commit;
