# Phase 3 Recap: Make It Stateless with Redis (Local, Multi-Instance)

1. **Goal in one sentence.**
   Move all game state, cross-server messaging, and timer ownership into Redis so multiple stateless Node.js servers behind a load balancer act as one seamless game cluster.

2. **What was built**
   - [redis.js](file:///d:/year5/cloud/project/teayrub/server/src/redis.js): Redis client setup, hash-tagged keys (`room:{CODE}`), and atomic Lua scripts for compare-and-set phase transitions and scoring.
   - [bus.js](file:///d:/year5/cloud/project/teayrub/server/src/bus.js): Redis Pub/Sub manager that subscribes to a room's channel only while at least one local player is in that room.
   - [docker-compose.yml](file:///d:/year5/cloud/project/teayrub/docker-compose.yml): Local multi-instance stack with `redis`, `server1` (`local-az-1`), `server2` (`local-az-2`), and `lb` (`nginx` on `:8080`).
   - [nginx.conf](file:///d:/year5/cloud/project/teayrub/nginx.conf): Round-robin reverse proxy with WebSocket upgrade headers and `proxy_read_timeout 120s` (no sticky sessions).

3. **How it works**
   ```mermaid
   flowchart LR
     P1["Player 1"] -->|WS| LB["nginx (:8080)\nRound-Robin"]
     P2["Player 2"] -->|WS| LB
     LB --> S1["server1 (local-az-1)"]
     LB --> S2["server2 (local-az-2)"]
     S1 <-->|"Pub/Sub + State + Lock"| R["Redis (:6379)"]
     S2 <-->|"Pub/Sub + State + Lock"| R
   ```
   When Player 1 draws on `server1`, `server1` appends the stroke to Redis and publishes it to `room:{CODE}`. `server2` receives it via Pub/Sub and forwards it to Player 2. One server per room holds a Redis timer lock (renewed every second); if that server crashes, the lock expires and the surviving server takes over.

4. **Key decisions and WHY**
   - **Stateless vs stateful**: Storing state in Redis means no sticky sessions are needed and any server can die without losing the room.
   - **Hash-tagged keys (`room:{CODE}`)**: Ensures all keys for one room hash to the same slot, required for multi-key atomic Lua scripts in Redis Cluster.
   - **Heartbeat presence**: Players are expired by heartbeat TTL rather than socket close, so a crashed server leaves no ghost players.
   - **At-most-once Pub/Sub + reconnect snapshot**: Redis Pub/Sub is fire-and-forget; if a client briefly disconnects, exponential backoff + jitter reconnects and fetches a full state + stroke replay snapshot from Redis.

5. **Commands to run and verify**
   ```powershell
   node --check server/src/redis.js server/src/bus.js
   # With Docker Compose running:
   # docker compose up --build
   # node loadtest/smoke.js http://localhost:8080 http://localhost:8080
   ```
   Expected: `node --check` exits 0; `smoke.js` passes with players on different servers (`server1` / `server2`).

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md).

7. **Likely teacher questions with model answers**
   Added 5 Phase 3 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Local `docker compose up` and `kill -9` failover drill should be run in a Docker-enabled environment; Phase 4 adds durable persistence for leaderboards and artwork.

9. **Cloud terms introduced**
   Added *Distributed Lock*, *Lua Script (Redis)*, *Sticky Sessions*, and *Exponential Backoff with Jitter* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
