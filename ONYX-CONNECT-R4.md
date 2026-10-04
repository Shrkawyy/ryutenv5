Jax V5 + ONYX Connect R4

What changed
============
1. Game WebSocket no longer goes through /api/ws.
   It connects directly from the browser, exactly like the working ONYX frontend:
   wss://eu.senpa.io:2001?password=
   subprotocol: main

2. Corrected the authentication packet format.
   Working ONYX sends:
     opcode 13
     uint8 token character count
     UTF-16 token characters

   Jax R1-R3 incorrectly used uint16 for the token length.
   R4 now uses Jax's writeUTF16StringLength(), which is the exact ONYX shape.

3. The same auth-packet correction is applied to the primary client and bot client.

4. Jax recording/replay files were not replaced.

Expected console line
=====================
[JAX/ONYX] Direct Game WebSocket -> wss://eu.senpa.io:2001?password= protocol= main

Patched auth occurrences: 2

Deployment
==========
Upload the CONTENTS of this folder to the GitHub repository and redeploy on Vercel.
No game WebSocket proxy is required for R4.
