# Configurar o Supabase

A aplicação precisa de um projeto Supabase seu. A integração de código sozinha não cria o banco, contas ou backups. Não compartilhe senhas, chaves `service_role` ou `sb_secret_`.

## 1. Criar o projeto e a tabela

1. Crie uma conta em https://supabase.com e um projeto. Guarde a senha do banco em um gerenciador de senhas.
2. Aguarde o projeto ficar disponível.
3. Abra **SQL Editor**, crie uma consulta, cole todo o conteúdo de [supabase/schema.sql](supabase/schema.sql) e clique em **Run**. Esse SQL pode ser executado novamente sem apagar registros.
4. Em **Authentication → Providers / Sign In**, habilite e-mail e senha e mantenha a confirmação de e-mail ativa. Configure senha mínima de 8 caracteres (ou mais).

A tabela `entries` usa Row Level Security (RLS). Usuários autenticados podem ler, inserir e excluir apenas linhas do próprio usuário. O navegador não recebe a chave administrativa. Não desabilite RLS nem crie políticas que liberem todos os usuários. O script é destinado a um projeto novo; se já existir uma tabela com esse nome, revise sua estrutura e políticas antes de usar.

## 2. Configurar os endereços de autenticação

Em **Authentication → URL Configuration**:

- **Site URL**: `https://filipedev05.github.io/ControleFinanceiro/`
- **Redirect URLs**: adicione exatamente `https://filipedev05.github.io/ControleFinanceiro/` e `http://localhost:3000/`.

Se usar outra porta ou domínio, adicione a URL correspondente. Os links de confirmação e recuperação retornam ao site. Configure um provedor SMTP para uso público: o envio padrão do Supabase tem restrições e limites e pode não entregar a destinatários externos. Consulte **Authentication → Email / SMTP Settings** e a documentação do seu plano. Nunca coloque a senha SMTP no código do site.

## 3. Conectar o código

No painel do projeto, procure **Connect** ou **Settings → API / API Keys**. Copie a **Project URL** e a chave **Publishable** (`sb_publishable_...`). A chave `anon` legada também é aceita.

Edite `config.js`:

```js
export const supabaseConfig = {
  url: 'https://SEU-PROJETO.supabase.co',
  publishableKey: 'SUA_CHAVE_PUBLICA',
};
```

Esses dois valores são públicos e podem ficar no GitHub. A privacidade dos registros é garantida pelas políticas RLS, não por esconder a chave pública. **Nunca use `service_role`, `sb_secret_` ou a senha do banco.**

Salve esse arquivo no GitHub para atualizar o GitHub Pages. A aplicação mostra uma orientação e bloqueia o acesso enquanto a configuração estiver vazia. Para rodar no Windows PowerShell: `npm.cmd start`.

## 4. Validar antes de convidar outras pessoas

1. Crie duas contas com e-mails diferentes e confirme os e-mails. Use navegadores ou perfis separados.
2. Entre com a conta A e crie receita/despesa; confira totais e recarregue. Entre novamente: os dados devem voltar do banco.
3. Entre com B: não deve aparecer nenhum registro de A. Crie um registro de B e confira que A não o vê.
4. Valide também as políticas diretamente: com o token de B, uma consulta REST filtrando `user_id` de A deve retornar `[]`; um INSERT com `user_id` de A deve ser negado; DELETE de uma linha de A deve retornar `[]` e a linha deve continuar existindo. Faça isso somente com contas de teste suas. A ausência de dados na interface, sozinha, não comprova isolamento no banco.
5. Teste sair, entrar com senha incorreta, recuperar senha e voltar pelo link recebido.
6. Teste importação, exportação e desconexão da internet: operações sem confirmação do banco não devem mostrar sucesso. Se uma conexão cair depois de o servidor aceitar uma operação, atualize os registros antes de repetir para evitar duplicação.

As sessões ficam somente na memória da aba. Recarregar ou abrir outra aba exige novo login; nenhum dado financeiro online é gravado em localStorage. Use **Atualizar registros** para buscar alterações feitas em outro dispositivo; não há atualização em tempo real.

## 5. Migrar os dados antigos

Os dados antigos não são apagados automaticamente. No mesmo navegador e endereço em que usava o site, entre na conta, clique em **Exportar dados antigos deste navegador** e depois **Importar backup**. Se usava `localhost`, exporte ali primeiro e importe no site HTTPS. A importação adiciona registros e mantém os existentes, ignorando IDs já presentes na conta carregada. Importe somente backups confiáveis. Um lote é inserido atomicamente; uma falha não deve ser resolvida apagando os registros atuais. Exportações contêm informações financeiras: guarde os arquivos em local privado.

## 6. Backups e operação

Supabase não é uma garantia de perda zero. Antes de oferecer a aplicação para uso real:

- Confira no seu plano a disponibilidade de backups automáticos, retenção e recuperação pontual (PITR). Não presuma que o plano gratuito inclui esses recursos.
- Configure uma rotina de backup do banco em armazenamento protegido e separado e teste a restauração em projeto de teste. Restrinja o acesso aos backups.
- Oriente usuários a exportar backups periodicamente. Eles são complementares ao backup do banco.
- Monitore limites, disponibilidade, cobrança, envio de e-mails e eventual pausa de projetos gratuitos. Defina suporte, aviso de privacidade e política de retenção/exclusão antes de uma oferta pública.

O código inclui cadastro e recuperação de senha, mas não implementa exclusão de conta por autoatendimento. Para solicitações de exclusão, o administrador pode excluir o usuário pelo painel Supabase; os registros vinculados serão apagados por `ON DELETE CASCADE`. Nunca exponha uma chave administrativa para realizar essa operação no navegador.

## Verificações automatizadas

`npm test` testa cálculos e o cliente REST com respostas simuladas (autenticação, renovação de token, paginação, dono das linhas, erros e logout). `npm run check` verifica a sintaxe. Esses testes não substituem a execução do SQL nem os testes de duas contas no seu Supabase real.

## Habilitar edição em um projeto existente

Execute `supabase/enable-editing.sql` no SQL Editor do seu projeto. A política limita a atualização aos registros da própria conta. O gráfico usa os lançamentos existentes e não precisa de alterações no banco.
