# CloudDraw Evidence Log

This file records verified test outputs, screenshots, and metrics collected across all phases.

## Phase 0: Foundations
- **Git repository initialized**: `git init` in `d:\year5\cloud\project\teayrub`.
- **Diagrams created**: [architecture.md](file:///d:/year5/cloud/project/teayrub/docs/diagrams/architecture.md) containing full AWS architecture and VPC/subnet/SG chain Mermaid diagrams.
- **Project plan created**: [PROJECT_PLAN.md](file:///d:/year5/cloud/project/teayrub/docs/PROJECT_PLAN.md) with Tier 1/2/3 scope.

## Phase 1: Frontend Design & Local Canvas
- `node --check web/app.js` passed (exit code 0).
- `web/style.css` verified to include `@media (prefers-reduced-motion: reduce)` and `:focus-visible` keyboard focus styles.

## Phase 2: Real-Time Game Server
- `node --check server/src/index.js server/src/ws.js server/src/game.js server/src/api.js` passed (exit code 0).
- *Note*: Live `smoke.js` run is pending `npm install` and a running Redis instance in the local environment.

## Phase 3: Stateless Multi-Instance with Redis
- `node --check server/src/redis.js server/src/bus.js` passed (exit code 0).
- Verified [docker-compose.yml](file:///d:/year5/cloud/project/teayrub/docker-compose.yml) (2 servers + Redis + nginx) and [nginx.conf](file:///d:/year5/cloud/project/teayrub/nginx.conf) (round-robin, WebSocket upgrade, 120s timeout).
- *Note*: Live `docker compose up` and `kill -9` failover test pending Docker availability.

## Phase 4: Persistence & Artwork Storage
- `node --check server/src/store.js server/src/words.js server/scripts/seed-words.js` passed (exit code 0).
- Verified dual-backend `store.js` (`USE_DYNAMO` toggle) and presigned URL artwork flow.

## Phase 5: AWS Network & Security (Terraform)
- Reviewed [network.tf](file:///d:/year5/cloud/project/teayrub/infra/network.tf) (VPC `10.0.0.0/16`, 6 subnets across 2 AZs, IGW, NAT Gateway, S3/DynamoDB Gateway Endpoints, SG chain).
- *Note*: `terraform` CLI is not installed in this local environment, so `terraform fmt`/`validate`/`plan` were not executed here.

## Phase 6: Cloud Hosting
- Reviewed [app.tf](file:///d:/year5/cloud/project/teayrub/infra/app.tf), [data.tf](file:///d:/year5/cloud/project/teayrub/infra/data.tf), [cdn.tf](file:///d:/year5/cloud/project/teayrub/infra/cdn.tf), [deploy-server.sh](file:///d:/year5/cloud/project/teayrub/scripts/deploy-server.sh), and [deploy-web.sh](file:///d:/year5/cloud/project/teayrub/scripts/deploy-web.sh).
- *Note*: Live AWS deployment and 2-phone CloudFront test pending `terraform` + AWS CLI credentials.

## Phase 7: Auto-Scaling, Load Testing & Failover
- `node --check server/src/metrics.js loadtest/bots.js` passed (exit code 0).
- Reviewed [simulate-az-failure.sh](file:///d:/year5/cloud/project/teayrub/scripts/simulate-az-failure.sh).
- *Note*: Live 320-bot load test (p50/p95/p99), CloudWatch scale-out screenshots, and AZ/Redis failover RTO measurements are pending live AWS deployment.
