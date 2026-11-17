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

## 6. AWS Network & Security (Phase 5)

The network layer is defined in `infra/network.tf` using a 3-tier, 2-AZ VPC (`10.0.0.0/16` in `ap-southeast-1`):
- **Public Subnets** (`10.0.1.0/24`, `10.0.2.0/24`): Host the ALB and NAT Gateway.
- **Private-App Subnets** (`10.0.11.0/24`, `10.0.12.0/24`): Host ECS Fargate tasks with outbound-only internet via NAT and private S3/DynamoDB access via Gateway Endpoints.
- **Private-Data Subnets** (`10.0.21.0/24`, `10.0.22.0/24`): Host ElastiCache Redis with zero internet route.
- **Security Group Chain**: `Internet -> sg-alb (80/443) -> sg-app (3000) -> sg-redis (6379)`.

## 7. Cloud Hosting (Phase 6)

The full AWS stack is provisioned via Terraform (`infra/app.tf`, `infra/data.tf`, `infra/cdn.tf`):
- **Compute**: ECS Fargate tasks (`linux/amd64`) behind an ALB with `/healthz` health checks, 120 s idle timeout, and 30 s deregistration delay.
- **Data**: ElastiCache Redis Multi-AZ with automatic failover, 4 on-demand DynamoDB tables, and 2 S3 buckets (`site` and `artwork` with CORS + lifecycle rules).
- **Edge**: CloudFront unifies `/`, `/artwork/*`, `/api/*`, and `/ws` under one HTTPS domain.

## 8. Auto-Scaling, Load Testing & Failover (Phase 7)

- **Auto-Scaling**: ECS Application Auto Scaling uses target-tracking policies on custom CloudWatch metric `ConnectionsPerTask` and CPU (min 2 tasks across 2 AZs, max 10) with fast scale-out and slow scale-in.
- **Load Testing**: `loadtest/bots.js` simulates 40 rooms × 8 bots (~320 players) to measure p50/p95/p99 stroke latency and error rates.
- **Failover Drill**: `scripts/simulate-az-failure.sh` stops all tasks in one AZ and promotes the ElastiCache Redis replica to verify automatic recovery.

## 9. Security, Hardening & Cost Estimate (Phase 8)

### Security Review
- **Secrets**: Zero hard-coded secrets or account IDs; `.env` and `*.tfstate*` are gitignored.
- **Network**: Redis is in `Private-Data` subnets with no internet route; `sg-redis` accepts `6379` only from `sg-app`; `sg-app` accepts `3000` only from `sg-alb`.
- **IAM**: ECS Task Role is scoped to the 4 DynamoDB tables, `artwork` S3 bucket, and CloudWatch `PutMetricData`.
- **Remaining Risks**: No AWS WAF or Cognito user login (Tier 3); single NAT Gateway in dev (`nat_gateway_count = 1`).

### Cost Estimate (`ap-southeast-1`) & Teardown
| Resource | Est. Hourly | Est. Demo Day (8 hrs) |
| :--- | :--- | :--- |
| NAT Gateway (1x) | ~\$0.045/hr | ~\$0.36 |
| ALB | ~\$0.025/hr | ~\$0.20 |
| ECS Fargate (2 tasks, 0.25 vCPU / 0.5 GB) | ~\$0.025/hr | ~\$0.20 |
| ElastiCache Redis (`cache.t4g.micro` Multi-AZ) | ~\$0.036/hr | ~\$0.29 |
| DynamoDB (On-Demand) + S3 + CloudFront | < \$0.01/hr | < \$0.08 |
| **Total** | **~\$0.14/hr** | **~\$1.13/day** |

**Teardown**: Run `cd infra && terraform destroy` (after confirming) to return ongoing cost to **\$0**.

## 10. Presentation Outline (10 Slides) & 5-Minute Demo Script

### 10-Slide Outline
1. **Title & Problem**: CloudDraw — low-latency multiplayer draw-and-guess.
2. **Requirements**: Real-time, 2-AZ HA, 300-bot auto-scaling, managed storage.
3. **Architecture**: CloudFront -> S3 / ALB -> ECS Fargate -> ElastiCache + DynamoDB.
4. **VPC & Security (Activity 4)**: 2-AZ 3-tier subnets, Gateway Endpoints, SG chain.
5. **Frontend**: Notebook-and-marker UI, normalized `0..1` canvas, ~40 ms batching.
6. **Stateless Backend**: Redis state, Pub/Sub, distributed timer lock, Lua scripts.
7. **Persistence**: `store.js` dual backend, DynamoDB, direct-to-S3 presigned URLs.
8. **Auto-Scaling**: `ConnectionsPerTask` custom metric, fast scale-out / slow scale-in.
9. **Load Test & Failover**: 320-bot latency results & AZ/Redis failover demo.
10. **Cost & Conclusion**: ~\$1.13/demo day, `terraform destroy`, Q&A.

### 5-Minute Demo Script
1. **0:00–1:00**: Open CloudFront URL on two phones/browsers; show footer displaying two different ECS tasks/AZs.
2. **1:00–2:30**: Create room, draw on Phone 1, guess on Phone 2; show Hall of Fame artwork saved via presigned S3 URL.
3. **2:30–3:45**: Run `loadtest/bots.js` (40 rooms × 8 bots) and show CloudWatch `ConnectionsPerTask` + ECS scale-out.
4. **3:45–4:45**: Run `scripts/simulate-az-failure.sh`; show `"Reconnecting…"` -> automatic recovery.
5. **4:45–5:00**: Show `terraform destroy` cost control & wrap up.
