# Controle Financeiro

Aplicação web em português com receitas, despesas, categorias, saldo e resumo mensal. Usa Supabase Auth para cadastro/login/recuperação de senha e PostgreSQL com RLS para guardar os registros de cada conta.

## Configurar

Siga [SUPABASE.md](SUPABASE.md) para criar o banco, aplicar as políticas, configurar e-mails e preencher os valores **públicos** em `config.js`. Nunca coloque chaves administrativas no GitHub.

A configuração é obrigatória: o site não salva novos registros sem conexão com o Supabase. Os dados da versão antiga permanecem no navegador e podem ser exportados e importados na conta.

## Executar

Requer Node.js 22 ou superior. Não há dependências externas.

```sh
npm start
```

No Windows PowerShell, use `npm.cmd start` se `npm.ps1` estiver bloqueado. Abra `http://localhost:3000/`. Opcional: `PORT=8080 npm start` em shells compatíveis.

## Validar

```sh
npm test
npm run check
```

Os testes do cliente usam respostas simuladas. A validação de login, envio de e-mails, persistência e isolamento de usuários em ambiente real exige um projeto Supabase configurado; veja o roteiro em SUPABASE.md.

## Publicar

GitHub Pages é compatível: publique a branch `main`, pasta `/ (root)`. Sirva `index.html`, `style.css`, `app.js`, `finance.js`, `cloud.js` e `config.js`. Configure a URL HTTPS também nas URLs de autenticação do Supabase.

Os registros financeiros ficam no banco, separados por usuário através de RLS. A sessão permanece apenas na memória da aba; ao recarregar, entre novamente. Consulte a seção de backups em SUPABASE.md antes de disponibilizar a aplicação para uso público.
