# Controle Financeiro

Aplicação web em português para registrar receitas e despesas, organizar categorias e acompanhar o saldo e o resumo mensal.

## Executar

Requer Node.js 22 ou superior. Não há dependências externas.

```sh
npm start
```

Abra `http://localhost:3000` no seu computador. A porta pode ser definida com `PORT=8080 npm start`.

## Funcionalidades

- Cadastro e exclusão de receitas e despesas com data e categoria.
- Saldo, receitas e despesas do mês selecionado.
- Busca por descrição ou categoria e distribuição das despesas por categoria.
- Persistência em localStorage e exportação/importação de backup JSON.
- Layout responsivo e valores em reais, armazenados em centavos.

Os dados ficam apenas no navegador e na origem utilizada (protocolo, domínio e porta). Não há conta, sincronização, servidor de dados ou integração bancária. Exporte backups regularmente; limpar os dados do navegador apaga os registros locais. A importação substitui os registros após confirmação. Use em dispositivo confiável.

## Validar

```sh
npm test
npm run check
```

Verificação manual: adicione uma receita e uma despesa; confira saldo e categorias; mude o mês; pesquise; recarregue a página; exporte e reimporte o backup; exclua um registro. Os testes automatizados cobrem validação, conversão monetária e totais.

## Publicação

Sirva `index.html`, `style.css`, `app.js` e `finance.js` em uma hospedagem estática com HTTPS, ou execute o servidor Node. Nenhuma chave de API é necessária. O servidor de desenvolvimento não fornece autenticação ou armazenamento remoto.
