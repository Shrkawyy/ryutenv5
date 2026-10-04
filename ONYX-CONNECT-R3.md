# ONYX Connect R3

The working ONYX client does not open the game socket as a bare `wss://eu.senpa.io:2001/`. Its primary connection appends the empty password query: `wss://eu.senpa.io:2001?password=` and requests subprotocol `main`.

R2 omitted that query on the proxy upstream. Runtime evidence showed the browser-to-Vercel upgrade succeeded (HTTP 101), but the upstream then died with code 1006 before sending any game frame.

R3 changes only the upstream connection shape and diagnostics:
- upstream: `wss://eu.senpa.io:2001?password=`
- subprotocol: `main` (unchanged)
- Origin header: `http://localhost:8888` (unchanged)
- extra log for unexpected HTTP handshake responses
- recording/replay code unchanged

After deployment, expected logs if this was the blocker:
`[JAX-PROXY] upstream OPEN ...?password= ... protocol= main`
then at least one `S->C opcode=...` line.
