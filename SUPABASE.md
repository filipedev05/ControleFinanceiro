# Supabase no Controle Financeiro

## O que é o Supabase?

O [Supabase](https://supabase.com/) é uma plataforma que oferece serviços para aplicações, como banco de dados PostgreSQL, autenticação de usuários e APIs para acessar os dados.

## Por que ele é utilizado no projeto?

O Controle Financeiro utiliza o Supabase para manter os lançamentos vinculados à conta de cada pessoa, permitindo consultá-los em diferentes dispositivos. Dessa forma, os registros não dependem apenas do armazenamento do navegador utilizado para cadastrá-los.

No projeto, ele é responsável por:

- **Autenticação:** cadastro, login, confirmação de e-mail e recuperação de senha.
- **Persistência:** armazenamento de receitas e despesas em um banco PostgreSQL.
- **Controle de acesso:** políticas de Row Level Security (RLS) que, quando corretamente configuradas, restringem cada usuário aos próprios registros.
- **Integração:** comunicação entre a interface e os serviços por meio de APIs.

A interface pode continuar hospedada no GitHub Pages, enquanto o Supabase fornece a autenticação e o banco de dados. Backups e recuperação dependem da configuração e dos recursos disponíveis no plano utilizado.
