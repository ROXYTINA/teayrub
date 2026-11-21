<div align="center">
  <img src="web/logo.png" alt="TeayRub" width="300">
  <p><strong>Real-time multiplayer draw-and-guess on AWS</strong></p>
  <p>
    <a href="#how-to-play">How to Play</a> •
    <a href="#architecture">Architecture</a>
  </p>
</div>

---

**TeayRub** is a low-latency, multiplayer draw-and-guess web game. Players join rooms with a 5-character code, take turns sketching a secret word on a shared canvas, and race to guess in real time.

## How to Play

1. Enter your name and click **Create a room** (or enter a 5-character code to **Join**).
2. Share the room code with friends.
3. On your turn, draw the secret word—everyone else guesses in chat for time-based points.
4. Rounds with a correct guess are saved to the **Hall of Fame**.

## Architecture

| Layer | Technology | Purpose |
| :--- | :--- | :--- |n
| **Edge / CDN** | Amazon CloudFront + S3 | Serves static site (`/`) and saved artwork (`/artwork/*`) |
| **Compute** | Node.js 20 (`Express` + `ws`) on ECS Fargate | Stateless REST & WebSocket servers across 2 AZs |
| **State & Sync** | ElastiCache Redis (Multi-AZ) | Room state, Pub/Sub, distributed timer locks, Lua scoring |
| **Database** | Amazon DynamoDB (On-Demand) | Word bank, leaderboard, match history, gallery metadata |
| **IaC** | Terraform | Full VPC, security groups, compute, and data provisioning |
