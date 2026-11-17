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
