# CloudDraw — One-Page Project Plan

**Goal**: Build and deploy **CloudDraw**, a real-time multiplayer draw-and-guess web game on AWS (`ap-southeast-1`) demonstrating low-latency WebSockets, 2-AZ high availability, horizontal auto-scaling, managed storage, and Infrastructure as Code (Terraform).

**Team**: 5 members (1–2 active), scoped for clean execution and oral-exam clarity.

---

## Tier 1 — Must Ship (Core Course Requirements)
1. **Real-time Draw & Guess**: HTML5 canvas with normalized `0..1` coordinates, ~40 ms stroke batching, mobile touch support, and live chat/guessing.
2. **Stateless Backend**: Single Node.js 20 service (`Express` + `ws` + `ioredis`) with `/healthz` independent of Redis. All game state in Redis; Pub/Sub for cross-server sync; distributed lock for room timer ownership.
3. **2-AZ High Availability**: VPC (`10.0.0.0/16`) across `ap-southeast-1a` and `ap-southeast-1b` with Public, Private-App, and Private-Data subnets, ALB, ECS Fargate (min 2 tasks, 1 per AZ), and ElastiCache Redis Multi-AZ with automatic failover.
4. **Managed Storage**: S3 + CloudFront (single domain for `/`, `/api/*`, `/ws`, `/artwork/*`), DynamoDB (on-demand) for word bank, leaderboard, match history, and artwork metadata.
5. **Load Test & Failover Demo**: 300+ simulated bots (`loadtest/bots.js`) proving horizontal scale-out, plus an AZ/Redis failover drill.
6. **Deliverables**: Terraform IaC (destroyable), VPC & Architecture diagrams, `REPORT.md`, `TEACHER_QA.md`, `EVIDENCE.md`, and phase recaps.

## Tier 2 — Should Ship (High-Value Polish)
1. **Hall of Fame Gallery**: Browser-to-S3 direct PNG upload via presigned `PUT` URLs when a round ends with a correct guess.
2. **Custom CloudWatch Metric**: `ConnectionsPerTask` published by each ECS task for WebSocket-aware target-tracking auto-scaling + CloudWatch Dashboard.
3. **Resilient Reconnect**: Exponential backoff + jitter with full state & canvas stroke replay.

## Tier 3 — Mention in Report Only (Out of Scope for Implementation)
1. Multi-region active-active deployment.
2. User authentication (Cognito) or AWS WAF.
3. Custom word-pack editor UI.
