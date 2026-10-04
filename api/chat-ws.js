'use strict';

const http = require('http');
const WebSocket = require('ws');

const UPSTREAM_URL = process.env.DELTA_CHAT_WS || 'wss://chat.delt.io/delta7?protocol=v1';
const UPSTREAM_ORIGIN = process.env.DELTA_CHAT_ORIGIN || 'https://delt.io';

function safeCloseCode(code, fallback = 1011) {
  const n = Number(code);
  if (!Number.isInteger(n) || n < 1000 || n > 4999) return fallback;
  if ([1004, 1005, 1006, 1015].includes(n)) return fallback;
  return n;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ ok: true, service: 'jax-chat-ws-proxy' }));
});

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (browser, req) => {
  const requested = String(req.headers['sec-websocket-protocol'] || '').split(',')[0].trim() || undefined;
  const opts = {
    headers: {
      Origin: UPSTREAM_ORIGIN,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
    },
    perMessageDeflate: false,
    handshakeTimeout: 15000
  };
  const upstream = requested ? new WebSocket(UPSTREAM_URL, requested, opts) : new WebSocket(UPSTREAM_URL, opts);
  const queue = [];
  let ended = false;

  const closeOne = (socket, code, reason) => {
    if (!socket || (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING)) return;
    try { socket.close(safeCloseCode(code), String(reason || '').slice(0, 120)); } catch (_) { try { socket.terminate(); } catch (_) {} }
  };
  const endBoth = (code, reason) => {
    if (ended) return;
    ended = true;
    closeOne(browser, code, reason || 'chat proxy closed');
    closeOne(upstream, code, reason || 'chat proxy closed');
  };

  upstream.on('open', () => {
    console.log('[JAX-CHAT-PROXY] upstream OPEN protocol=' + (upstream.protocol || '(none)'));
    while (queue.length && upstream.readyState === WebSocket.OPEN) upstream.send(queue.shift());
  });
  browser.on('message', (data) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    else if (upstream.readyState === WebSocket.CONNECTING) queue.push(data);
  });
  upstream.on('message', (data, isBinary) => {
    if (browser.readyState === WebSocket.OPEN) browser.send(data, { binary: isBinary !== false });
  });
  browser.on('close', (c, r) => endBoth(c, r?.toString() || 'browser closed'));
  upstream.on('close', (c, r) => {
    console.log('[JAX-CHAT-PROXY] upstream close code=' + c + ' reason=' + (r?.toString() || ''));
    endBoth(c, r?.toString() || 'upstream closed');
  });
  browser.on('error', (e) => { console.log('[JAX-CHAT-PROXY] browser error', e?.message || e); endBoth(1011, 'browser error'); });
  upstream.on('error', (e) => { console.log('[JAX-CHAT-PROXY] upstream error', e?.message || e); endBoth(1011, 'upstream error'); });
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req));
});

module.exports = server;
