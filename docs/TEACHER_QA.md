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
