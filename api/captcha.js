'use strict';
const { createHmac, timingSafeEqual } = require('node:crypto');
const limits = new Map();
const providers = {
  '2captcha': ['TWOCAPTCHA_API_KEY', 'https://api.2captcha.com'],
  'anticaptcha': ['ANTICAPTCHA_API_KEY', 'https://api.anti-captcha.com']
};
function sign(data, key) { return createHmac('sha256', key).update(data).digest('base64url'); }
function ticket(taskId, provider, key) {
  const data = Buffer.from(JSON.stringify({taskId, provider, expires: Date.now() + 240000})).toString('base64url');
  return data + '.' + sign(data, key);
}
function readTicket(value) {
  if (typeof value !== 'string' || value.length > 1000) throw Error('Invalid task');
  const [data, sig] = value.split('.');
  const task = JSON.parse(Buffer.from(data, 'base64url').toString());
  const config = providers[task.provider];
  if (!config || !process.env[config[0]] || !Number.isSafeInteger(task.taskId) || task.expires < Date.now()) throw Error('Expired task');
  const expected = Buffer.from(sign(data, process.env[config[0]]));
  const actual = Buffer.from(sig || '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Invalid task');
  return task;
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error: 'POST required'});
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (!req.headers.origin || new URL(req.headers.origin).host !== host) return res.status(403).json({error: 'Same-origin request required'});
  } catch { return res.status(403).json({error: 'Invalid origin'}); }
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({error: 'Invalid JSON'}); }
  if (!body || !['create', 'poll'].includes(body.action)) return res.status(400).json({error: 'Invalid action'});
  let provider, task;
  if (body.action === 'poll') {
    try { task = readTicket(body.ticket); provider = task.provider; }
    catch { return res.status(400).json({error: 'Invalid or expired task. Reconnect to retry.'}); }
  } else {
    provider = process.env.CAPTCHA_PROVIDER || (process.env.TWOCAPTCHA_API_KEY ? '2captcha' : 'anticaptcha');
  }
  const config = providers[provider];
  const key = config && process.env[config[0]];
  if (!key) return res.status(503).json({error: 'Captcha is not configured on the host. Set TWOCAPTCHA_API_KEY or ANTICAPTCHA_API_KEY.'});
  if (body.action === 'create') {
    const now = Date.now();
    for (const [ip, entry] of limits) if (entry.until < now) limits.delete(ip);
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
    const entry = limits.get(ip) || { count: 0, until: now + 60000 };
    if (entry.count >= 6) return res.status(429).json({error: 'Too many captcha tasks. Wait one minute.'});
    entry.count++; limits.set(ip, entry);
  }
  try {
    const payload = {clientKey: key};
    if (task) payload.taskId = task.taskId;
    else payload.task = {
      type: 'TurnstileTaskProxyless',
      websiteURL: process.env.CAPTCHA_WEBSITE_URL || 'https://senpa.io/',
      websiteKey: process.env.CAPTCHA_SITE_KEY || '0x4AAAAAAACWFDYFT_opGqX8'
    };
    const response = await fetch(config[1] + (task ? '/getTaskResult' : '/createTask'), {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw Error('Provider unavailable');
    const result = await response.json();
    if (result.errorId) return res.status(502).json({error: 'Captcha provider: ' + String(result.errorCode || 'TASK_FAILED').replace(/[^A-Z0-9_]/gi, '').slice(0,80)});
    if (!task) {
      if (!Number.isSafeInteger(result.taskId)) throw Error('Invalid provider result');
      return res.status(200).json({ticket: ticket(result.taskId, provider, key), status: 'processing'});
    }
    if (result.status === 'ready' && typeof result.solution?.token === 'string') return res.status(200).json({status: 'ready', token: result.solution.token});
    return res.status(200).json({status: 'processing'});
  } catch { return res.status(502).json({error: 'Captcha service unavailable. Reconnect to retry.'}); }
};
