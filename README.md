<div align="center">
  <img src="web/logo.jpg" alt="TeayRub" width="260">
  <p><strong>Real-time multiplayer draw-and-guess on AWS</strong></p>
  <p>
    <a href="#run-locally">Run Locally</a> •
    <a href="#how-to-play">How to Play</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#deploy-to-aws">Deploy to AWS</a>
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
| :--- | :--- | :--- |
| **Edge / CDN** | Amazon CloudFront + S3 | Serves static site (`/`) and saved artwork (`/artwork/*`) |
| **Compute** | Node.js 20 (`Express` + `ws`) on ECS Fargate | Stateless REST & WebSocket servers across 2 AZs |
| **State & Sync** | ElastiCache Redis (Multi-AZ) | Room state, Pub/Sub, distributed timer locks, Lua scoring |
| **Database** | Amazon DynamoDB (On-Demand) | Word bank, leaderboard, match history, gallery metadata |
| **IaC** | Terraform | Full VPC, security groups, compute, and data provisioning |

## Run Locally

Start the local multi-instance stack (`nginx` + 2 stateless servers + Redis):

```powershell
docker compose up --build
```

Open **two browser tabs** at `http://localhost:8080`, create a room in Tab 1, and join with the code in Tab 2. The footer shows which server (`server1` or `server2`) each tab is connected to.

**Run the automated smoke test:**

```powershell
cd loadtest
npm install
node smoke.js http://localhost:8080 http://localhost:8080
```

## Deploy to AWS

> **Cost**: ~\$0.14/hr (~\$1.13 per 8-hour demo day) in `ap-southeast-1`. Run `terraform destroy` when finished.

```powershell
# 1. Create ECR repository
cd infra
terraform init
terraform apply -target=aws_ecr_repository.app

# 2. Build & push server image
..\scripts\deploy-server.sh

# 3. Provision full stack
terraform apply

# 4. Deploy frontend & seed words
..\scripts\deploy-web.sh
cd ..\server && npm run seed-words
```

**Load test (320 simulated players) & failover drill:**

```powershell
node loadtest/bots.js https://<your-cloudfront-domain> 40 8
./scripts/simulate-az-failure.sh
```

**Teardown:**

```powershell
cd infra
terraform destroy
```
