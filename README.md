# CloudDraw: real-time multiplayer draw & guess

Players join a room with a 5-character code, take turns drawing a secret word on a shared canvas,
and everyone else races to guess it. Built as a cloud-native, stateless, multi-AZ system.

```
Browser ──HTTPS/WSS──► CloudFront ──► S3 (frontend)           /
                          │      └──► S3 (artwork PNGs)       /artwork/*
                          └─ /api/*, /ws ──► ALB (AZ-1 + AZ-2)
                                               │
                              ECS Fargate game-server tasks (stateless, auto-scaled, both AZs)
                                  │                 │                 │
                        ElastiCache Redis       DynamoDB           S3 (presigned PUT
                        game state + Pub/Sub    words, leaderboard  from the browser)
                        primary AZ-1/replica AZ-2  matches, gallery
```

## How it works (the three ideas)

1. **Servers are stateless.** A socket only remembers `{roomCode, playerId}`. All game state lives in Redis,
   so any server can serve any player and a crash or scale-in never kills a match.
2. **Redis Pub/Sub joins the servers.** Each server subscribes to `ch:{ROOM}` only while it has a local player
   in that room. A stroke goes *browser -> server -> Redis -> every server with players in the room -> browsers*.
3. **One owner per room.** A short Redis lock (`ownLock`, renewed every second) decides which server advances a
   room's timers. If that server dies, the lock expires and another server takes over within ~3 s.

Other details worth mentioning in your report: the secret word is sent only to the drawer (private
`to:` envelope); scoring is an atomic Lua script; strokes are batched every 40 ms and stored in a capped Redis list
so late joiners and reconnecting clients get a canvas replay; presence is heartbeat-based so a crashed server
can't leave "ghost" players; `/healthz` deliberately does not touch Redis so a Redis failover cannot make the ALB
kill healthy tasks.

## Project layout

```
clouddraw/
├── web/                 static frontend (index.html, style.css, app.js), no build step
├── server/              Node.js game server (Express + ws + ioredis)
│   ├── src/game.js        game state machine, scoring, room ownership
│   ├── src/ws.js          WebSocket layer + Pub/Sub fan-out
│   ├── src/api.js         REST: rooms, leaderboard, gallery, presigned uploads
│   ├── src/store.js       DynamoDB (cloud) or Redis (local) persistence
│   ├── src/metrics.js     custom CloudWatch metric for auto-scaling
│   ├── data/words.json    word bank (seed into DynamoDB with `npm run seed-words`)
│   └── Dockerfile
├── infra/               Terraform: VPC, 2 AZs, ALB, ECS, Redis, DynamoDB, S3, CloudFront, auto-scaling
├── loadtest/            bots.js (N rooms x M bots, latency stats) and smoke.js (end-to-end test)
├── scripts/             deploy-server.sh, deploy-web.sh, simulate-az-failure.sh
├── docker-compose.yml   local stack: nginx (as the ALB) + 2 servers + Redis
└── nginx.conf
```

## Run it locally

**Option A: Docker (recommended, mirrors the cloud).** Two servers behind a load balancer; open the page in two tabs.
They usually land on different servers, and the footer shows which one you are on.

```bash
docker compose up --build
# open http://localhost:8080 in two tabs (or on your phone: http://<your-LAN-ip>:8080)
```

**Option B: no Docker.**

```bash
redis-server &                      # or: docker run -p 6379:6379 redis:7-alpine
cd server && npm install && npm run dev
# open http://localhost:3000
```

Tip: `DRAW_MS=15000 ROUNDS=1 npm run dev` shortens turns while testing.

### Tests

```bash
cd loadtest && npm install
node smoke.js ws://localhost:3001 ws://localhost:3002     # 2 servers on different ports, shared Redis
node bots.js --url ws://localhost:8080 --rooms 40 --per-room 8 --duration 120   # ~320 players
```

Verified locally while building this: the smoke test (18 checks: cross-server strokes and chat, word privacy, scoring,
full match, leaderboard) passes; 72 bots over two servers show p95 stroke latency under 10 ms; killing one server with
`kill -9` mid-game moves its room locks to the survivor and the games keep running.
**Not verified:** the browser UI was written but not click-tested here, and the Terraform was not applied or
`terraform validate`d (no Terraform in the build sandbox). Expect to fix small things on first run.

## Deploy to AWS

Prereqs: AWS CLI configured, Terraform >= 1.5, Docker. **Set a budget alert first** (Billing -> Budgets).

```bash
cd infra
terraform init
terraform apply -target=aws_ecr_repository.app      # 1) create the image repo first
cd .. && ./scripts/deploy-server.sh                  # 2) build + push the image
cd infra && terraform apply                          # 3) everything else (ALB, ECS, Redis, ...)
cd .. && ./scripts/deploy-web.sh                     # 4) upload the frontend + invalidate CloudFront
cd server && USE_DYNAMO=true TABLE_PREFIX=clouddraw AWS_REGION=ap-southeast-1 npm run seed-words   # 5) word bank
terraform -chdir=../infra output site_url            # open this URL
```

The ECS service in step 3 may start before the image is ready on a first apply; re-run `./scripts/deploy-server.sh` if so.

**Tear down when you are not demoing** (Multi-AZ Redis and the NAT gateway cost money every hour): `terraform destroy`.
Cost levers: `nat_gateway_count = 1` (default), `cache.t4g.micro`, DynamoDB on-demand, 0.5 vCPU tasks.

## Demo script

1. Open the CloudFront URL on two phones, create a room, play a round. Footer shows each phone's task and AZ.
2. Show the CloudWatch dashboard `clouddraw` and the two ECS tasks in different AZs.
3. Scale-out: set `conn_target = 20` in `infra/variables.tf`, run `terraform apply`, then load the site with bots:
   `node bots.js --url wss://<your-cloudfront-domain> --rooms 20 --per-room 8`.
   Watch ConnectionsPerTask rise on the dashboard and ECS add tasks (allow 3-5 minutes: the metric period is 1 min
   and the scale-out cooldown is 60 s).
4. Failover: `./scripts/simulate-az-failure.sh ap-southeast-1a` (add `FAIL_REDIS=1` to also promote the Redis replica).
   Players see "Reconnecting…" and continue. Note ECS will relaunch the tasks (the AZ is not truly down); for a
   harsher drill, remove that AZ's subnet from the service in the console.
5. Show the Hall of Fame (drawings in S3) and the leaderboard (DynamoDB).

## Mapping to your project sheet

| Phase | Where it lives |
|---|---|
| 1 Network | `infra/network.tf` (VPC, public/app/data subnets in 2 AZs, SG chain, NAT, endpoints) |
| 2 Frontend + CDN | `web/`, `infra/cdn.tf`, `scripts/deploy-web.sh` |
| 3 Backend + ALB | `server/`, `infra/app.tf` (ALB, ECS Fargate) |
| 4 Redis sync | `server/src/bus.js`, `redis.js`, `game.js`, `infra/data.tf` (Multi-AZ ElastiCache) |
| 5 DB + storage | `server/src/store.js`, `api.js` (presigned S3 uploads), DynamoDB tables |
| 6 Scale + failover | `infra/app.tf` (auto-scaling), `loadtest/`, `scripts/simulate-az-failure.sh` |

## Known limitations (good "future work" for the report)

- **Identity is a client-generated id**: fine for a party game, but anyone who learns a playerId could impersonate it.
  Next step: server-issued signed session tokens.
- **Pub/Sub is at-most-once.** After a Redis failover a few messages may be lost; clients get a fresh state snapshot
  on reconnect (and servers resync after resubscribing), so it self-heals.
- **No `canvas undo`, spectators or custom word packs.** Easy additions: store stroke groups and add an `undo` message.
- **CloudFront -> ALB is plain HTTP.** Add a custom domain + ACM certificate to encrypt that hop.
- **Leaderboard uses a DynamoDB Scan** (fine for hundreds of players; add a GSI to scale) and is keyed by display name.
- **Scaling beyond one Redis node:** switch to Redis Cluster + sharded Pub/Sub (keys already use `{ROOM}` hash tags).
- No WAF or per-IP rate limit on room creation; there is a per-socket message limit.
