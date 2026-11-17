# CloudDraw — Final Project Report

## 1. Project Overview & Architecture (Phase 0)

**CloudDraw** is a real-time multiplayer draw-and-guess web application built on AWS (`ap-southeast-1`). Players join rooms using a 5-character code, take turns drawing a secret word on a shared HTML5 canvas, and guess in real time to earn points.

### Target Architecture
- **Edge & Content Delivery**: Amazon CloudFront serves a single unified domain:
  - `/` → Amazon S3 (static HTML/CSS/JS)
  - `/artwork/*` → Amazon S3 (saved round PNGs)
  - `/api/*` and `/ws` → Application Load Balancer (ALB, no caching)
- **Compute**: Stateless Node.js 20 containers (`Express` + `ws` + `ioredis`) running on **AWS ECS Fargate** across two Availability Zones (`ap-southeast-1a`, `ap-southeast-1b`).
- **Real-Time State & Messaging**: **Amazon ElastiCache for Redis** (Multi-AZ with automatic failover) stores room state, scores, and stroke history, and powers cross-server Pub/Sub and distributed timer locks.
- **Persistence**: **Amazon DynamoDB** (on-demand) stores the word bank, leaderboard, match history, and artwork metadata. Browser-to-S3 presigned `PUT` URLs offload binary PNG uploads from the compute tier.
- **Infrastructure as Code**: **Terraform** provisions the entire VPC, security groups, compute, and managed data services so environments can be created and destroyed cleanly.

## 2. Frontend Design & Local Canvas (Phase 1)

The frontend is built with plain HTML5, CSS3, and ES modules (`web/index.html`, `web/style.css`, `web/app.js`) with no build step. It uses a notebook-and-marker aesthetic (graph-paper background, `Chewy` display headings, `Nunito` body text, and hard ink shadows).

Key engineering choices:
- **Normalized `0..1` coordinates** ensure strokes render identically on mobile phones and desktop monitors.
- **Immediate local rendering + ~40 ms stroke batching** provides zero-latency feedback for the drawer while reducing WebSocket message frequency.
- **Accessibility & Mobile**: Unified Pointer Events with `touch-action: none`, `:focus-visible` outlines, and `prefers-reduced-motion` support.

## 3. Real-Time Game Server (Phase 2)

The backend is a single Node.js 20 service (`Express` + `ws` + `ioredis`) serving both REST endpoints (`/api/rooms`, `/api/leaderboard`, `/api/gallery`) and WebSocket connections (`/ws`).

- **State Machine**: `LOBBY -> DRAWING -> ROUND_END -> MATCH_END -> LOBBY`.
- **Security & Fair Play**: The server selects the secret word, sends it exclusively to the drawer, reveals progressive hints to guessers, scores based on remaining time, and blocks word leaks in chat.
- **Health Checks**: `/healthz` returns `200 OK` independently of Redis, while `/readyz` checks Redis connectivity.

## 4. Stateless Multi-Instance Design with Redis (Phase 3)

To support horizontal scaling and survive server crashes without sticky sessions, all game state is stored in Redis using hash-tagged keys (`room:{CODE}`).

- **Cross-Server Sync**: Servers subscribe to Redis Pub/Sub channels only for rooms with active local players.
- **Timer Ownership**: A Redis distributed lock renewed every second ensures exactly one server drives a room's countdown.
- **Atomic Operations**: Lua scripts handle compare-and-set phase transitions and race-free scoring.
- **Resilience**: Heartbeat-based presence prevents ghost players, and clients reconnect with exponential backoff + jitter to receive a full state and stroke replay.

## 5. Persistence & Artwork Storage (Phase 4)

Durable data (leaderboard, match history, word bank, and gallery metadata) is abstracted behind `server/src/store.js`, which switches between local Redis and AWS DynamoDB via `USE_DYNAMO=true`.

- **Direct-to-S3 Artwork**: When a round ends with a correct guess, the drawer's browser exports the canvas to PNG and uploads it directly to S3 using a short-lived presigned `PUT` URL, keeping binary traffic off the compute tier.
