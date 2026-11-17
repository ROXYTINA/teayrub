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
