# Phase 2 Recap: Real-Time Game Server (Local, Single Instance)

1. **Goal in one sentence.**
   Build a server-authoritative Node.js 20 backend (`Express` + `ws`) that manages the `LOBBY -> DRAWING -> ROUND_END -> MATCH_END` state machine, validates all inputs, and prevents the secret word from leaking.

2. **What was built**
   - [index.js](file:///d:/year5/cloud/project/teayrub/server/src/index.js): HTTP + WebSocket server, `/healthz` (independent of Redis), `/readyz` (checks Redis), static file serving for local dev, and graceful `SIGTERM` shutdown.
   - [api.js](file:///d:/year5/cloud/project/teayrub/server/src/api.js): REST endpoints (`POST /api/rooms`, leaderboard, gallery).
   - [ws.js](file:///d:/year5/cloud/project/teayrub/server/src/ws.js): WebSocket connection handler, message validation, and rate/flood limiting.
   - [game.js](file:///d:/year5/cloud/project/teayrub/server/src/game.js): Server-authoritative game state machine, word selection, masked hints, time-based scoring, and chat leak prevention.
   - [smoke.js](file:///d:/year5/cloud/project/teayrub/loadtest/smoke.js): End-to-end 2-bot smoke test verifying room creation, turn start, secret word isolation, drawing, and guessing.

3. **How it works**
   Clients create/join rooms via REST + WebSocket (`/ws`). The server picks a secret word and sends it **only** to the drawer's socket; guessers receive a masked hint (e.g., `_ _ _ _ _`) with letters revealed over time. Every incoming stroke and chat message is validated for shape/size and checked against the secret word before broadcasting.

4. **Key decisions and WHY**
   - **WebSocket (`/ws`) vs HTTP polling**: Drawing and guessing require sub-100 ms bidirectional updates; WebSockets keep a persistent TCP connection open without repeated HTTP header overhead.
   - **Server-authoritative rules**: Clients never decide scores, timers, or whether a guess is correct—preventing client-side cheating.
   - **Input validation & rate limiting**: Bounding stroke point arrays and message sizes protects the server and Redis from memory exhaustion or flood attacks.

5. **Commands to run and verify**
   ```powershell
   node --check server/src/index.js server/src/ws.js server/src/game.js server/src/api.js
   # With Redis + server running:
   # node loadtest/smoke.js ws://localhost:3000 ws://localhost:3000
   ```
   Expected: `node --check` exits 0; `smoke.js` prints `PASS` for every check.

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md) (syntax checks passed; live `smoke.js` execution requires `npm install` + running Redis).

7. **Likely teacher questions with model answers**
   Added 5 Phase 2 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Phase 2 focuses on the single-server game loop; Phase 3 scales this across multiple servers using Redis Pub/Sub and distributed locks.

9. **Cloud terms introduced**
   Added *WebSocket*, *Server-Authoritative*, and *Rate Limiting* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
