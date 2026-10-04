(function () {
  'use strict';
  const active = new WeakMap();
  async function request(body, signal) {
    const response = await fetch('api/captcha', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body), signal
    });
    let result;
    try { result = await response.json(); } catch { throw Error('Captcha endpoint unavailable. Run on the supplied Node server or Vercel.'); }
    if (!response.ok || result.error) throw Error(result.error || 'Captcha request failed');
    return result;
  }
  window.JaxCaptcha = {
    solve(client, app) {
      if (active.has(client)) return active.get(client);
      const work = (async () => {
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 180000);
        const watch = setInterval(() => { if (!client.isConnected) controller.abort(); }, 250);
        let toast;
        try {
          if (!client.isConnected) return;
          toast = app.toasts.show(client.type + ': Solving captcha…', 'info', 0);
          const task = await request({action: 'create'}, controller.signal);
          while (!controller.signal.aborted && client.isConnected) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            if (!client.isConnected || controller.signal.aborted) break;
            const result = await request({action: 'poll', ticket: task.ticket}, controller.signal);
            if (result.status === 'ready') {
              if (client.isConnected) client.sendCaptcha(1, result.token);
              return;
            }
          }
        } catch (error) {
          if (client.isConnected) app.toasts.show(error.name === 'AbortError' ? 'Captcha timed out. Reconnect to retry.' : error.message, 'error', 10000);
        } finally {
          clearTimeout(deadline); clearInterval(watch);
          if (toast) app.toasts.remove(toast);
        }
      })();
      active.set(client, work);
      work.finally(() => active.delete(client));
      return work;
    }
  };
})();
