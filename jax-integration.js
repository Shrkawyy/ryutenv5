(function () {
  'use strict';
  function init() {
    const app = window.app;
    if (!app) return;
    const originalRenderTab = app.settingsMenu.renderTab;
    app.settingsMenu.renderTab = function (tab) {
      originalRenderTab.call(this, tab);
      if (tab === 'ryuten' && window.RyutenTheme) window.RyutenTheme.renderSettings();
    };
    const label = document.getElementById('serverPlayerInfo');
    function status() {
      const clients = app.dualConnectionHandler.clients || [];
      const ready = clients.filter(c => c.clientReady).length;
      if (label) label.textContent = ready ? 'Connected · ' + ready + ' tab(s)' : app.player.pendingConnections.length ? 'Connecting…' : 'Disconnected';
    }
    status(); setInterval(status, 1000);
    // Keep the original game's settings available: many copied Ryuten controls
    // expect a different engine and cannot safely replace these live controls.
    const button = document.createElement('button');
    button.id = 'jax-live-settings';
    button.textContent = 'GAME SETTINGS';
    button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;padding:9px 14px;border:1px solid #22d3ee55;border-radius:6px;background:#101722;color:#dff;font:12px sans-serif;cursor:pointer';
    button.onclick = () => app.settingsMenu.show();
    document.body.appendChild(button);
    setInterval(() => { button.hidden = !app.lobby.isVisible; }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
