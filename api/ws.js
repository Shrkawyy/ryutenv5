'use strict';

const http = require('http');
const WebSocket = require('ws');

const UPSTREAM_URL = process.env.ONYX_UPSTREAM_WS || 'wss://eu.senpa.io:2001/';
const UPSTREAM_ORIGIN = process.env.ONYX_UPSTREAM_ORIGIN || 'http://localhost:8888';

function safeCloseCode(code, fallback = 1011) {
  const n = Number(code);
  if (!Number.isInteger(n) || n < 1000 || n > 4999) return fallback;
  if ([1004, 1005, 1006, 1015].includes(n)) return fallback;
  return n;
}

function opcodeOf(data) {
  try {
    const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return b.length ? b[0] : null;
  } catch (_) {
    return null;
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ ok: true, service: 'jax-game-ws-proxy', upstream: 'eu.senpa.io:2001' }));
});

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (client, req) => {
  console.log('[JAX-PROXY] browser connected', req.headers.origin || '(no origin)');

  const upstream = new WebSocket(UPSTREAM_URL, 'main', {
    headers: {
      Origin: UPSTREAM_ORIGIN,
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0'
    },
    perMessageDeflate: false,
    handshakeTimeout: 15000
  });

  let ended = false;
  const pendingToUpstream = [];

  const closeOne = (socket, code, reason) => {
    if (!socket) return;
    if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) return;
    try { socket.close(safeCloseCode(code), String(reason || '').slice(0, 120)); } catch (_) {
      try { socket.terminate(); } catch (_) {}
    }
  };

  const endBoth = (code, reason) => {
    if (ended) return;
    ended = true;
    closeOne(client, code, reason || 'proxy closed');
    closeOne(upstream, code, reason || 'proxy closed');
  };

  upstream.on('open', () => {
    console.log('[JAX-PROXY] upstream OPEN', UPSTREAM_URL, 'origin=', UPSTREAM_ORIGIN, 'protocol=', upstream.protocol || '(none)');
    while (pendingToUpstream.length && upstream.readyState === WebSocket.OPEN) {
      const item = pendingToUpstream.shift();
      upstream.send(item.data, { binary: item.binary });
    }
  });

  client.on('message', (data, isBinary) => {
    const op = opcodeOf(data);
    if (op !== null) console.log('[JAX-PROXY] C->S opcode=' + op + ' len=' + Buffer.from(data).length);
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary !== false });
    } else if (upstream.readyState === WebSocket.CONNECTING) {
      pendingToUpstream.push({ data, binary: isBinary !== false });
    }
  });

  upstream.on('message', (data, isBinary) => {
    const op = opcodeOf(data);
    if (op !== null) console.log('[JAX-PROXY] S->C opcode=' + op + ' len=' + Buffer.from(data).length);
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary !== false });
    }
  });

  client.on('close', (code, reason) => {
    console.log('[JAX-PROXY] browser close code=' + code + ' reason=' + (reason?.toString() || ''));
    endBoth(code, reason?.toString() || 'browser closed');
  });
  upstream.on('close', (code, reason) => {
    console.log('[JAX-PROXY] upstream close code=' + code + ' reason=' + (reason?.toString() || ''));
    endBoth(code, reason?.toString() || 'upstream closed');
  });
  client.on('error', (err) => {
    console.log('[JAX-PROXY] browser error', err?.message || err);
    endBoth(1011, 'browser error');
  });
  upstream.on('error', (err) => {
    console.log('[JAX-PROXY] upstream error', err?.message || err);
    endBoth(1011, 'upstream error');
  });
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req));
});

module.exports = server;
