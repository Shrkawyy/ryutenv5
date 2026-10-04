# Validation — 2026-10-04

PASS: all shipped JavaScript files and inline HTML scripts pass Node syntax checks.
PASS: all local HTML and CSS asset references resolve.
PASS: replay recorder SHA-256 matches the original supplied Jax archive.
PASS: bundle.wasm and wasmLoader.js match the original supplied Jax archive.

`npm test`: 7 test cases passed.

1. Instantiate actual bundled Player/Lobby code; old saved server cannot override Delta target.
2. Local extension activation resolves without keys or network licensing calls.
3. Actual bundled Settings persists migrated renderer controls.
4. Actual bundled drawCell executes with missing chat, applies configured opacity/name size and draws the active arrow (mock canvas context).
5. Original recording file hash is unchanged.
6. Captcha server rejects cross-origin/unconfigured requests; signed task polling, tamper rejection, both provider routes and provider errors tested with mocked provider responses. No real tokens or credit used.
7. Spawn the shipped Node HTTP server and request page, WASM, captcha and image proxy routes; verify environment and server-source routes are inaccessible.

NOT VERIFIED: browser layout, live recording, paid captcha solving, WebSocket/handshake/spawn, gameplay, multibox, bots and live chat.
Live target DNS attempt failed with EAI_AGAIN. Browser attempt could not start because Chromium was absent. These are environment limitations, not proof that the target server is down or that gameplay works.
