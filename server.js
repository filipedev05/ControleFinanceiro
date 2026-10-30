import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/finance.js':'finance.js','/style.css':'style.css','/cloud.js':'cloud.js','/config.js':'config.js'};
const types = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
const server = http.createServer(async (req,res) => {
  const file = files[new URL(req.url,'http://localhost').pathname];
  if (!file || !['GET','HEAD'].includes(req.method)) {res.writeHead(404); res.end('Não encontrado'); return;}
  try {
    const data = await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self' https://*.supabase.co; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(500);res.end('Erro ao carregar arquivo');}
});
server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log(`Controle Financeiro iniciado na porta ${server.address().port}`));
