/* JAX V5 <-> ONYX connection bridge
 * Uses the game/chat transport observed in the provided working ONYX build.
 * No login token is bundled here. Paste your own token once through the AUTH button.
 */
(function () {
  'use strict';

  var GAME_URL = 'wss://eu.senpa.io:2001';
  var STORAGE_KEY = 'jax_senpa_auth_token';
  var LEGACY_KEY = 'senpa_auth_token';

  function clean(v) {
    return String(v || '').trim().replace(/^["']|["']$/g, '');
  }

  function getToken() {
    try {
      return clean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY));
    } catch (_) { return ''; }
  }

  function setToken(value) {
    var token = clean(value);
    if (!token) throw new Error('Empty token');
    try {
      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(LEGACY_KEY, token);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('jax:auth-changed'));
    return token;
  }

  function clearToken() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('jax:auth-changed'));
  }

  window.JaxAuth = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    gameUrl: GAME_URL
  };

  // The ONYX transport requests the `main` WebSocket subprotocol. Jax's WASM
  // creates the socket through JS emval; wrapping WebSocket here lets us keep
  // Jax's renderer/engine while matching the working ONYX connection shape.
  var NativeWebSocket = window.WebSocket;
  if (NativeWebSocket) {
    function isGameSocket(url) {
      var s = String(url || '');
      return /^(wss?:\/\/)?(?:eu\.mi\.com|eu\.senpa\.io)(?::2001)?\/?$/i.test(s);
    }
    var WrappedWebSocket = new Proxy(NativeWebSocket, {
      construct: function (Target, args) {
        var url = args[0];
        var protocols = args.length > 1 ? args[1] : undefined;
        if (isGameSocket(url)) {
          url = GAME_URL;
          if (protocols == null || protocols === '') protocols = 'main';
          console.info('[JAX/ONYX] Game WebSocket ->', url, 'protocol=', protocols);
        }
        return Reflect.construct(Target, protocols === undefined ? [url] : [url, protocols]);
      }
    });
    window.WebSocket = WrappedWebSocket;
    try { globalThis.WebSocket = WrappedWebSocket; } catch (_) {}
  }

  function ensureAuthUI() {
    if (document.getElementById('jax-auth-fab')) return;
    var style = document.createElement('style');
    style.textContent = [
      '#jax-auth-fab{position:fixed;top:12px;right:12px;z-index:2147483000;border:1px solid rgba(45,212,191,.35);border-radius:8px;background:#10161b;color:#d9fffb;padding:7px 10px;font:700 11px/1 Segoe UI,sans-serif;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.3)}',
      '#jax-auth-fab.ok{border-color:rgba(45,212,191,.75);color:#2dd4bf}',
      '#jax-auth-panel{display:none;position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.68);align-items:center;justify-content:center;padding:20px}',
      '#jax-auth-panel.open{display:flex}',
      '#jax-auth-panel .card{width:min(560px,95vw);background:#0d1318;color:#e8eeee;border:1px solid #24343c;border-radius:12px;padding:16px;font:13px/1.45 Segoe UI,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}',
      '#jax-auth-panel textarea{box-sizing:border-box;width:100%;min-height:105px;background:#080d11;color:#e8eeee;border:1px solid #263942;border-radius:8px;padding:10px;font:12px/1.4 Consolas,monospace;resize:vertical}',
      '#jax-auth-panel .row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '#jax-auth-panel button{border:0;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700}',
      '#jax-auth-panel .save{background:#2dd4bf;color:#05201d}',
      '#jax-auth-panel .muted{background:#1a242b;color:#d8e1e5}',
      '#jax-auth-panel .status{margin-top:8px;color:#9db0b8;font-size:11px}'
    ].join('');
    document.head.appendChild(style);

    var fab = document.createElement('button');
    fab.id = 'jax-auth-fab';
    fab.type = 'button';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'jax-auth-panel';
    panel.innerHTML = '<div class="card"><b>GAME AUTH</b><div style="margin:4px 0 10px;color:#9db0b8">Paste your own Senpa/ONYX game JWT. It is stored only in this browser localStorage.</div><textarea spellcheck="false" placeholder="Paste JWT here"></textarea><div class="row"><button class="save" type="button">SAVE & RECONNECT</button><button class="muted clear" type="button">CLEAR</button><button class="muted close" type="button">CLOSE</button></div><div class="status"></div></div>';
    document.body.appendChild(panel);

    var input = panel.querySelector('textarea');
    var status = panel.querySelector('.status');
    function refresh() {
      var ok = !!getToken();
      fab.textContent = ok ? 'AUTH ✓' : 'AUTH';
      fab.classList.toggle('ok', ok);
      if (ok && !input.value) input.value = getToken();
    }
    function open() { refresh(); panel.classList.add('open'); input.focus(); }
    function close() { panel.classList.remove('open'); }
    fab.addEventListener('click', open);
    panel.querySelector('.close').addEventListener('click', close);
    panel.querySelector('.clear').addEventListener('click', function () { clearToken(); input.value=''; status.textContent='Token cleared.'; refresh(); });
    panel.querySelector('.save').addEventListener('click', function () {
      try {
        setToken(input.value);
        status.textContent = 'Saved. Reconnecting game client...';
        refresh();
        close();
        setTimeout(function () {
          try {
            if (window.app && window.app.lobby && window.app.player) window.app.lobby.connect(window.app.player.serverUrl);
            else location.reload();
          } catch (_) { location.reload(); }
        }, 80);
      } catch (e) { status.textContent = e.message || String(e); }
    });
    panel.addEventListener('click', function(e){ if(e.target===panel) close(); });
    window.addEventListener('jax:auth-required', function(){ if(!getToken()) open(); });
    window.addEventListener('jax:auth-changed', refresh);
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureAuthUI);
  else ensureAuthUI();
})();
