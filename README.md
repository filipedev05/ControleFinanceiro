# Controle Financeiro

Aplicação web para organizar receitas e despesas, acompanhar o saldo mensal e visualizar como o dinheiro é distribuído por categoria. O projeto tem interface em português, contas individuais e armazenamento online.

[Acessar a aplicação](https://filipedev05.github.io/ControleFinanceiro/)

## Introdução

O acompanhamento das movimentações financeiras ajuda a entender hábitos de consumo e a planejar os próximos meses. O Controle Financeiro reúne o registro de entradas e saídas, os indicadores mensais e os gráficos em uma interface acessível pelo navegador, tanto no computador quanto no celular.

Cada pessoa utiliza sua própria conta. Os lançamentos ficam no banco de dados online e podem ser consultados em outros dispositivos após o login.

## Objetivo

Facilitar o controle das finanças pessoais por meio de registros organizados e informações visuais que apoiem o planejamento financeiro.

Os objetivos específicos são:

- Registrar, editar e excluir receitas e despesas.
- Organizar movimentações por categoria e período.
- Apresentar o saldo, as receitas e as despesas do mês selecionado.
- Comparar a evolução financeira ao longo dos meses.
- Permitir acesso individual aos registros por meio de autenticação e políticas de acesso no banco.
- Oferecer importação e exportação de backups dos lançamentos.

## Funcionalidades

### Contas e autenticação

- Telas separadas para cadastro e entrada.
- Confirmação de conta por e-mail, com retorno à tela de login.
- Tela de recuperação de senha e redefinição pelo link enviado por e-mail.
- Pausa do login por 15 minutos após três erros de credenciais no mesmo navegador.
- Encerramento da sessão pelo botão **Sair**.

O limite de tentativas é local ao navegador e pode ser contornado ao limpar os dados ou utilizar outro navegador. Ele não representa um bloqueio global da conta.

### Movimentações

- Cadastro de tipo, descrição, valor, data e categoria.
- Categorias de despesas e receitas exibidas conforme o tipo selecionado.
- Edição de lançamentos existentes, com opção de cancelar.
- Exclusão mediante confirmação.
- Filtro por mês e busca por descrição ou categoria.

Entre as categorias disponíveis estão Alimentação, Moradia, Combustível, Educação, Pets, Salário, Renda extra, Freelance e Rendimentos. As categorias dos registros antigos são preservadas.

### Indicadores e gráficos

- Resumo do mês com saldo, receitas e despesas.
- Gráfico de pizza por categoria, alternando entre receitas e despesas.
- Valores e percentuais na legenda do gráfico de pizza.
- Evolução das receitas e despesas nos últimos 12 meses até o mês selecionado.
- Tabela de valores mensais para complementar a visualização do gráfico.

### Metas financeiras

- Limite mensal de gastos, com categoria e filtro de descrição opcionais (por exemplo, iFood).
- Progresso automático conforme as despesas cadastradas, com avisos ao chegar a 80%, atingir ou ultrapassar o teto.
- Avisos no painel para os tetos do mês atual, atualizados ao carregar e alterar os registros. São avisos dentro da aplicação, sem envio de notificações com o site fechado.
- Metas para juntar dinheiro em um mês ou ao longo de vários meses.
- Total reservado informado pelo usuário, com cálculo do valor restante e sugestão mensal.
- Edição, exclusão e exportação das metas, sem alterar os lançamentos.

Metas de economia registram quanto a pessoa informa ter reservado; não movimentam dinheiro nem usam automaticamente o saldo da conta. O total reservado pode ser atualizado na edição da meta. As metas ficam disponíveis após a criação da tabela com [supabase/goals.sql](supabase/goals.sql).

### Backups

- Exportação dos registros da conta em JSON.
- Importação de backups, mantendo os registros existentes e ignorando identificadores já carregados na conta.
- Exportação dos dados antigos armazenados no navegador para migração à conta online.

A exportação pelo usuário é complementar à rotina de backup e recuperação do banco, que precisa ser configurada pelo responsável pelo projeto.

## Tecnologias utilizadas

| Tecnologia | Aplicação no projeto |
| --- | --- |
| HTML5 | Estrutura das páginas e formulários |
| CSS3 | Estilos e adaptação a diferentes tamanhos de tela |
| JavaScript com módulos ES | Interface, validação e regras financeiras |
| SVG | Gráficos de categorias e evolução mensal |
| [Supabase](SUPABASE.md) | Autenticação e armazenamento online |
| PostgreSQL e Row Level Security (RLS) | Persistência e controle de acesso aos registros |
| Node.js | Servidor local e execução dos testes |
| GitHub Pages | Hospedagem estática da aplicação |

O projeto não utiliza framework de interface nem exige instalação de pacotes externos para executar os scripts disponíveis.

## Estrutura do projeto

```text
ControleFinanceiro/
├── index.html                   # Interface da aplicação
├── style.css                    # Estilos e responsividade
├── app.js                       # Eventos, formulários e gráficos
├── goals.js                     # Validação e acompanhamento das metas
├── finance.js                   # Categorias, validações e cálculos
├── cloud.js                     # Cliente REST de autenticação e registros
├── config.js                    # Configuração pública dos serviços
├── login-limit.js               # Contador local de tentativas de login
├── server.js                    # Servidor HTTP para desenvolvimento
├── package.json                 # Comandos do projeto
├── SUPABASE.md                  # Visão geral do Supabase no projeto
├── supabase/
│   ├── schema.sql               # Estrutura e políticas do banco
│   ├── enable-editing.sql       # Habilita edição em projetos existentes
│   ├── goals.sql                # Metas e políticas de acesso por usuário
│   └── expand-categories.sql    # Libera novas categorias no banco
└── test/                        # Testes das regras e integração simulada
```

## Instalação e configuração

### Pré-requisitos

- Node.js 22 ou superior, com npm.
- Serviços de autenticação e banco de dados previamente configurados.
- Navegador atualizado.
- Git, caso queira clonar o repositório; também é possível baixar o ZIP pelo GitHub.

### Obter o código

```sh
git clone https://github.com/filipedev05/ControleFinanceiro.git
cd ControleFinanceiro
```

### Executar localmente

```sh
npm start
```

Acesse `http://localhost:3000/` e mantenha o terminal aberto durante o uso local.

Se o PowerShell bloquear o arquivo `npm.ps1`, utilize:

```powershell
npm.cmd start
```

A aplicação depende dos serviços online configurados em `config.js` para autenticar e salvar novos registros. O servidor Node.js serve os arquivos locais; ele não substitui o banco ou o serviço de autenticação.

## Como utilizar

1. Crie uma conta e confirme seu e-mail pelo link recebido.
2. Entre com e-mail e senha.
3. Cadastre suas movimentações, escolhendo o tipo e a categoria.
4. Selecione o mês para acompanhar os indicadores e gráficos.
5. Use **Editar** ou **Excluir** para corrigir os lançamentos.
6. Exporte backups periodicamente e encerre a sessão em dispositivos compartilhados.

## Testes e validação

```sh
npm run check
npm test
```

A verificação de sintaxe analisa os arquivos JavaScript. Os testes automatizados cobrem cálculos financeiros, categorias, evolução mensal, limite local de login e chamadas aos serviços online com respostas simuladas.

O envio real de e-mails, as regras de acesso e a persistência entre contas e dispositivos também precisam ser validados no ambiente utilizado.

## Publicação

A aplicação é compatível com hospedagem estática. Para usar GitHub Pages, configure **Settings → Pages → Deploy from a branch**, selecionando a branch `main` e a pasta `/ (root)`.

Publique os arquivos da interface e todos os módulos JavaScript importados, incluindo `login-limit.js`. Ajuste a URL de retorno em `config.js` e os endereços do serviço de autenticação quando mudar de domínio.

## Armazenamento e limitações

- Os registros financeiros ficam no banco de dados online e são vinculados ao usuário autenticado. A separação depende das políticas RLS corretamente aplicadas.
- A sessão permanece na memória da aba. Recarregar a página ou abrir outra aba exige novo login.
- O contador de tentativas utiliza armazenamento local do navegador; ele não armazena senhas.
- Não há sincronização em tempo real. O botão **Atualizar registros** busca as alterações feitas em outros dispositivos.
- A aplicação precisa de internet para acessar e salvar os dados online.
- Backups automáticos, retenção e restauração dependem da configuração e do plano do serviço.
- A exclusão de conta ainda depende do administrador; não há autoatendimento para essa operação.

## Contribuição

Sugestões de melhoria e relatos de problemas podem ser registrados nas [issues do repositório](https://github.com/filipedev05/ControleFinanceiro/issues). Para propor uma alteração, descreva o comportamento esperado, implemente a mudança em uma branch e envie um pull request com as verificações realizadas.
