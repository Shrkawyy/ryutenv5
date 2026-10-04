# JAX V5 — ONYX connection integration R1

Changes applied:
- Game target: `wss://eu.senpa.io:2001` (from the provided working ONYX build).
- WebSocket game subprotocol: `main` when the engine does not provide one.
- Game auth packet now uses the browser-stored token instead of the literal `null`.
- Both the main client and bot client use the same token packet format.
- Chat target changed from the dead Railway endpoint to `wss://chat.delt.io/delta7?protocol=v1`.
- Added `jax-onyx-bridge.js` before the WASM/game bundle.
- Kept Jax UI and replay/recording files unchanged.
- Kept captcha provider secrets out of client code; configure them only in Vercel Environment Variables.

First launch:
1. Deploy this folder to Vercel.
2. Open the page.
3. If `AUTH` appears, click it and paste your own current game JWT from your legitimate logged-in session.
4. Save & reconnect.

If the next console error is an HTTP 403 / WebSocket close immediately after DNS succeeds, that indicates an Origin/edge restriction rather than a Jax packet-format problem. In that case a persistent WebSocket relay on a host that supports upgrades is required; do not put a login token in that relay's public source.
