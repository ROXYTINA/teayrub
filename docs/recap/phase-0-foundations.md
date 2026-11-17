# Phase 0 Recap: Plan, Repo, and Local Foundations

1. **Goal in one sentence.**
   Establish the CloudDraw repository, tiered project plan, target AWS/VPC Mermaid diagrams, and cost-conscious foundation before writing application or Terraform code.

2. **What was built**
   - [PROJECT_PLAN.md](file:///d:/year5/cloud/project/teayrub/docs/PROJECT_PLAN.md): One-page plan separating Tier 1 (must ship), Tier 2 (should ship), and Tier 3 (report only).
   - [architecture.md](file:///d:/year5/cloud/project/teayrub/docs/diagrams/architecture.md): Mermaid diagrams for the full AWS architecture and the 2-AZ VPC/subnet/security-group chain.
   - [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md), [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md), [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md), [REPORT.md](file:///d:/year5/cloud/project/teayrub/docs/REPORT.md): Growing course deliverables initialized with Phase 0 content.
   - Git repository initialized with `.gitignore` protecting `.env`, `node_modules/`, and Terraform state.

3. **How it works**
   CloudDraw separates **stateless compute** (Node.js on ECS Fargate) from **shared state** (ElastiCache Redis) and **durable storage** (DynamoDB + S3). CloudFront routes static/artwork requests to S3 and dynamic `/api/*` + `/ws` traffic to the ALB, which distributes connections across two Availability Zones.

4. **Key decisions and WHY**
   - **Stateless microservice-style design**: Storing all room state in Redis instead of Node.js memory lets any server handle any player, enabling horizontal auto-scaling and zero-downtime deployments.
   - **Two Availability Zones**: Deploying ECS tasks and ElastiCache Redis across `ap-southeast-1a` and `ap-southeast-1b` eliminates single-AZ outages.
   - **Cost plan**: Using Terraform allows `terraform destroy` between sessions. DynamoDB on-demand (\$0 idle), 1 NAT Gateway during dev, and S3 lifecycle rules keep student cloud costs minimal.

5. **Commands to run and verify**
   ```powershell
   git status
   git log -1 --oneline
   ```
   Expected: Clean working tree on `phase-0: plan, repo, and local foundations`.

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md): git initialization, architecture/VPC diagrams, and project plan.

7. **Likely teacher questions with model answers**
   Added 5 foundational Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md) covering statelessness, 2-AZ HA, CloudFront single-domain routing, `/healthz` independence from Redis, and cost control.

8. **Known limitations and future work**
   Local stack and AWS infrastructure are not yet deployed; they will be built incrementally in Phases 1–7.

9. **Cloud terms introduced**
   Added *Availability Zone (AZ)*, *Stateless Server*, *Redis Pub/Sub*, *VPC*, *Security Group*, and *IaC* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
