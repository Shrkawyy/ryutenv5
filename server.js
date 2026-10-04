'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.woff':'font/woff','.cur':'image/x-icon'};
const server = http.createServer(async (req,res) => {
  res.status = code => { res.statusCode=code; return res; };
  res.json = data => { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)); };
  res.send = data => res.end(data);
  try {
    const url = new URL(req.url,'http://localhost');
    if (['/api/captcha','/api/proxy'].includes(url.pathname)) {
      req.query=Object.fromEntries(url.searchParams);
      let body='';
      for await (const chunk of req) { body+=chunk; if (body.length>8192) return res.status(413).json({error:'Request too large'}); }
      req.body=body || '{}';
      return await require('.'+url.pathname+'.js')(req,res);
    }
    if (!['GET','HEAD'].includes(req.method)) return res.status(405).end();
    const pathname=decodeURIComponent(url.pathname);
    if (pathname.split('/').some(p => p.startsWith('.')) || /\/(?:api|tests)(?:\/|$)/.test(pathname) || /\/(?:server\.js|package.*\.json|vercel\.json)$/.test(pathname)) return res.status(404).end();
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!file.startsWith(root+path.sep)) return res.status(403).end();
    const stat=await fs.promises.stat(file);
    if (!stat.isFile()) return res.status(404).end();
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Content-Length',stat.size);
    if (req.method==='HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  } catch { if (!res.headersSent) res.status(404); res.end(); }
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Jax V5: http://127.0.0.1:'+(Number(process.env.PORT)||3000)));
