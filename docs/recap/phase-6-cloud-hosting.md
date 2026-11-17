# Phase 6 Recap: Cloud Hosting (Frontend, Compute, Data)

1. **Goal in one sentence.**
   Provision the full AWS hosting stack—ECR, ECS Fargate, ALB, ElastiCache Redis Multi-AZ, DynamoDB, S3, CloudFront, and least-privilege IAM—plus deployment scripts.

2. **What was built**
   - [app.tf](file:///d:/year5/cloud/project/teayrub/infra/app.tf): ECR repository, ECS cluster & Fargate service (spread across 2 AZs), ALB + target group (`/healthz`, 120 s idle timeout, 30 s deregistration delay), and least-privilege IAM task role.
   - [data.tf](file:///d:/year5/cloud/project/teayrub/infra/data.tf): ElastiCache Redis (primary + replica in AZ-2 with automatic failover) and 4 on-demand DynamoDB tables (`words`, `leaderboard`, `matches`, `gallery`).
   - [cdn.tf](file:///d:/year5/cloud/project/teayrub/infra/cdn.tf): Two S3 buckets (`site` and `artwork` with CORS for presigned `PUT` and lifecycle rule) + CloudFront distribution routing `/`, `/artwork/*`, `/api/*`, and `/ws`.
   - [deploy-server.sh](file:///d:/year5/cloud/project/teayrub/scripts/deploy-server.sh) & [deploy-web.sh](file:///d:/year5/cloud/project/teayrub/scripts/deploy-web.sh): Build/push `linux/amd64` Docker image to ECR + force ECS deployment; sync `web/` to S3 + invalidate CloudFront.

3. **How it works**
   A player's stroke travels: **Browser → CloudFront (`/ws`, no cache) → ALB (port 80/3000) → ECS Fargate Task (AZ-1) → ElastiCache Redis Pub/Sub → ECS Fargate Task (AZ-2) → ALB → CloudFront → Other Players**. Static files (`/`) and saved PNGs (`/artwork/*`) are served directly from S3 via CloudFront.

4. **Key decisions and WHY**
   - **Single CloudFront domain**: Eliminates CORS for `/api/*` and `/ws` and provides HTTPS termination.
   - **ECS Fargate**: Serverless containers—no EC2 patching or cluster management.
   - **ALB 120 s idle timeout + 30 s deregistration delay**: Keeps idle WebSockets alive while allowing fast rolling deployments.

5. **Commands to run and verify**
   ```powershell
   # Deployment order (when AWS CLI + Terraform are configured):
   cd infra
   terraform apply -target=aws_ecr_repository.app
   ..\scripts\deploy-server.sh
   terraform apply
   ..\scripts\deploy-web.sh
   ```

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md) (Terraform & deploy scripts reviewed; live AWS deployment pending AWS credentials/Terraform CLI).

7. **Likely teacher questions with model answers**
   Added 5 Phase 6 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Live 2-phone CloudFront verification requires running `terraform apply` and the deploy scripts in an AWS-authenticated environment.

9. **Cloud terms introduced**
   Added *ECS Fargate*, *CloudFront*, *ElastiCache Multi-AZ*, and *IAM Task Role* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
