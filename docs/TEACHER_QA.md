# CloudDraw — Teacher Q&A Bank

## Phase 0: Foundations & Architecture

1. **Why use a stateless backend instead of storing game rooms in Node.js memory?**
   - If rooms live in server memory, players in the same room must stay pinned to one server (sticky sessions), and if that server crashes or scales in, the game is lost. By storing all state in Redis and using Redis Pub/Sub, any ECS task can serve any player, enabling horizontal auto-scaling and zero-downtime task replacement.

2. **Why deploy across two Availability Zones (AZ-1 and AZ-2)?**
   - A single AZ is a single point of failure (power, cooling, or network outage). Spreading ECS Fargate tasks and ElastiCache Redis (primary + replica) across two AZs ensures the game stays online even if an entire AZ fails.

3. **Why put CloudFront in front of both S3 and the ALB?**
   - Serving the static site (`/`), artwork (`/artwork/*`), REST API (`/api/*`), and WebSockets (`/ws`) under one CloudFront domain eliminates CORS complexity for API/WS calls, caches static assets globally at edge locations, and provides HTTPS termination out of the box.

4. **Why does `/healthz` NOT depend on Redis?**
   - If `/healthz` failed when Redis had a brief blip or failover, the ALB would mark *all* ECS tasks unhealthy at once and tear down the entire fleet, turning a 2-second Redis failover into a total outage.

5. **How do you keep AWS costs low during a student project?**
   - Everything is defined in Terraform so we can `terraform destroy` between work/demo sessions. We use Fargate Spot/on-demand only during testing, 1 NAT Gateway (variable-controlled) instead of 2 during dev, on-demand DynamoDB (pay-per-request, \$0 when idle), and S3 lifecycle rules.

## Phase 1: Frontend & Canvas

6. **Why normalize canvas coordinates to `0..1` instead of sending pixel `(x, y)`?**
   - Different devices have different screen and canvas sizes. Normalized `0..1` coordinates let every client scale strokes cleanly to its own canvas dimensions.

7. **Why batch stroke points every ~40 ms instead of sending every `pointermove` event?**
   - `pointermove` fires at 60–120 Hz. Batching every ~40 ms reduces WebSocket and Redis Pub/Sub message volume by 3–4x while keeping visual motion smooth.

8. **Why draw locally immediately before the server echoes the stroke?**
   - Waiting for a network round-trip before rendering would make the brush feel laggy. Drawing locally first gives instant feedback, while other players receive the batched stroke ~40 ms later.

9. **Why use Pointer Events instead of separate Mouse and Touch events?**
   - Pointer Events (`pointerdown`, `pointermove`, `pointerup`) handle mouse, touch, and stylus through one code path, paired with `touch-action: none` so mobile browsers don't scroll while drawing.

10. **Why use plain HTML/CSS/JS with no build step (no React/Vite)?**
    - Eliminates build pipelines, simplifies S3 static hosting, and keeps the codebase small and transparent for oral exam explanations.

## Phase 2: Real-Time Game Server

11. **Why use WebSockets (`/ws`) instead of HTTP polling or Server-Sent Events (SSE)?**
    - HTTP polling adds latency and header overhead on every poll. SSE is one-way (server-to-client). WebSockets provide full-duplex, low-latency communication over a single persistent TCP connection.

12. **How do you prevent a player from cheating by inspecting network traffic?**
    - The server never sends the secret word to guessers—only to the drawer's socket. Guessers only receive the masked hint (`_ _ _`).

13. **What happens if the drawer accidentally types the secret word in chat?**
    - The server checks every chat message against the active word and blocks/masks it before broadcasting so the word never leaks.

14. **Why validate stroke shapes and rate-limit WebSocket messages?**
    - Without validation and rate limits, a malicious client could send huge JSON payloads or thousands of strokes per second, crashing the server or saturating Redis Pub/Sub.

15. **What is the purpose of `SIGTERM` graceful shutdown in `index.js`?**
    - When ECS replaces or scales in a task, it sends `SIGTERM`. Closing WebSockets with code `1012` (Service Restart) tells clients to reconnect immediately to another healthy task.

## Phase 3: Stateless Multi-Instance & Redis

16. **Why don't we need sticky sessions on the load balancer (nginx / ALB)?**
    - Because all room state, stroke history, and scores live in Redis, not in Node.js memory. Any server can handle any player's WebSocket or REST request.

17. **What happens if the server holding a room's timer lock crashes (`kill -9`)?**
    - The Redis lock has a short TTL and is renewed every second. When the owner dies, the lock expires and another server with players in that room acquires it and continues the round timer.

18. **Why use Redis Lua scripts for phase transitions and scoring?**
    - Lua scripts execute atomically on the Redis server, preventing race conditions (e.g., two servers ending the same round twice or two guesses awarding duplicate points).

19. **Why use `room:{CODE}` hash tags in Redis keys?**
    - Hash tags force all keys for a single room into the same hash slot, which is required for multi-key Lua scripts in clustered Redis.

20. **How does the client recover if a WebSocket drops mid-game?**
    - The client reconnects using exponential backoff with jitter and receives a full `state` snapshot from Redis, including the canvas stroke history for replay.

## Phase 4: Persistence & Artwork Storage

21. **Why upload artwork PNGs directly from browser to S3 using a presigned URL instead of `POST`ing to Node.js?**
    - Uploading directly to S3 offloads binary bandwidth, memory, and CPU from the ECS Fargate tasks, and avoids ALB payload limits.

22. **How do you prevent anyone from abusing a presigned URL to upload huge or unauthorized files?**
    - The server only issues a presigned `PUT` URL after verifying the turn ended with a correct guess, and scopes the URL to a specific object key, `Content-Type: image/png`, and short expiration.

23. **Why choose DynamoDB over RDS (PostgreSQL/MySQL) for leaderboard, matches, and gallery?**
    - DynamoDB on-demand scales automatically, costs \$0 when idle, requires no VPC-bound database server management, and fits simple key-value/document access patterns.

24. **How is the DynamoDB partition key designed for `leaderboard` and `matches`?**
    - `leaderboard` uses `name` as the partition key for atomic `ADD` score/win counters; `matches` uses `matchId` (`timestamp-roomCode`) for unique match records.

25. **Why keep local dev on Redis/disk behind the same `store.js` interface?**
    - Developers can test the full game, leaderboard, and artwork flow locally without needing an AWS account or internet access.

## Phase 5: AWS Network & Security

26. **What is the difference between a Public Subnet and a Private Subnet in AWS?**
    - A Public Subnet has a route (`0.0.0.0/0`) to an Internet Gateway (IGW). A Private Subnet has no direct route to the IGW (it uses a NAT Gateway for outbound-only internet, or has no internet route at all).

27. **Why does the Private-Data subnet (Redis) have NO route to the internet?**
    - Redis never needs to initiate outbound internet connections. Removing the internet route completely eliminates internet-based exfiltration or inbound exposure.

28. **Why use S3 and DynamoDB Gateway Endpoints?**
    - Gateway Endpoints are free (\$0) and route S3/DynamoDB traffic over the private AWS backbone instead of through the NAT Gateway, improving security and reducing NAT data-processing charges.

29. **What is the difference between a Security Group (SG) and a Network ACL (NACL)?**
    - Security Groups are stateful (return traffic is automatically allowed) and attach to resources/ENIs. NACLs are stateless (require explicit inbound and outbound rules) and attach to subnets.

30. **How does the Security Group chain enforce least privilege?**
    - `sg-alb` allows `80/443` from `0.0.0.0/0`; `sg-app` allows `3000` **only** from `sg-alb`; `sg-redis` allows `6379` **only** from `sg-app`.

## Phase 6: Cloud Hosting

31. **Why use AWS ECS Fargate instead of EC2 instances?**
    - Fargate is serverless compute for containers: we don't patch OSes, manage AMIs, or right-size EC2 instances. We pay only for the vCPU/memory each task uses.

32. **Why set the ALB idle timeout to 120 seconds and deregistration delay to 30 seconds?**
    - WebSockets can sit idle between strokes; a 120 s timeout prevents premature disconnects. A 30 s deregistration delay lets draining tasks finish cleanly during deploys without stalling scale-in.

33. **Why does CloudFront disable caching for `/api/*` and `/ws` while caching `/`?**
    - Static HTML/CSS/JS rarely changes and benefits from edge caching, whereas `/api/*` and `/ws` are dynamic real-time endpoints that must always reach the ALB.

34. **Why must `terraform apply -target=aws_ecr_repository.app` run before the full `terraform apply`?**
    - ECS Fargate tasks need a Docker image in ECR to start. Creating ECR first lets us push the initial image so the ECS service reaches steady state on the first full apply.

35. **How does the IAM Task Role enforce least privilege?**
    - The task role grants access *only* to the specific DynamoDB tables, the `artwork` S3 bucket (`PutObject`/`GetObject`), and CloudWatch `PutMetricData`—nothing else in the AWS account.

## Phase 7: Auto-Scaling, Load Testing & Failover

36. **Why is `ConnectionsPerTask` a better scaling metric than CPU for a WebSocket game?**
    - WebSocket servers can hold hundreds of concurrent connections with low CPU usage; connection/memory limits or event-loop lag become bottlenecks before CPU hits 70%.

37. **Why use fast scale-out and slow scale-in cooldowns?**
    - Fast scale-out absorbs sudden player surges without dropping connections; slow scale-in prevents thrashing (repeatedly adding and removing tasks) and minimizes WebSocket reconnects.

38. **What happens to players when an entire AZ goes down?**
    - Players connected to tasks in the failed AZ see `"Reconnecting…"` for a few seconds, reconnect with exponential backoff + jitter to tasks in the surviving AZ, and receive a full state + canvas replay from Redis.

39. **What is the expected RTO (Recovery Time Objective) for ECS tasks vs ElastiCache Redis?**
    - ECS WebSocket reconnect takes ~2–5 seconds (client backoff + ALB routing to surviving AZ). ElastiCache Multi-AZ automatic failover typically completes in ~15–30 seconds.

40. **Why measure p95 and p99 stroke latency instead of just average latency?**
    - Averages hide tail spikes. p95 and p99 show what the slowest 5% and 1% of players experience, which directly reflects real-time responsiveness under load.
