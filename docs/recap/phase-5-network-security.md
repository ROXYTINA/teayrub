# Phase 5 Recap: AWS Network and Security (Terraform)

1. **Goal in one sentence.**
   Define a 2-AZ VPC (`10.0.0.0/16`) in Terraform with Public, Private-App, and Private-Data subnets, Gateway Endpoints for S3/DynamoDB, and a strict Security Group chain.

2. **What was built**
   - [network.tf](file:///d:/year5/cloud/project/teayrub/infra/network.tf): VPC, IGW, 6 subnets (public, app, data across 2 AZs), NAT Gateway (`var.nat_gateway_count`, default 1), route tables, S3 & DynamoDB Gateway Endpoints, and Security Groups (`sg-alb -> sg-app -> sg-redis`).
   - [architecture.md](file:///d:/year5/cloud/project/teayrub/docs/diagrams/architecture.md): Activity 4 deliverable — VPC/subnet/SG chain Mermaid diagram with exact CIDRs.

3. **How it works**
   Traffic enters through the Internet Gateway (IGW) to the **Public** subnets (`10.0.1.0/24`, `10.0.2.0/24`) where the ALB and NAT Gateway live. The ALB forwards port `3000` to ECS Fargate tasks in the **Private-App** subnets (`10.0.11.0/24`, `10.0.12.0/24`). Tasks reach ElastiCache Redis on port `6379` in the **Private-Data** subnets (`10.0.21.0/24`, `10.0.22.0/24`), which have **no internet route at all**. S3 and DynamoDB traffic stays on the private AWS backbone via Gateway Endpoints.

4. **Key decisions and WHY**
   - **3-tier subnets (Public / Private-App / Private-Data)**: Isolates compute and data from direct internet access.
   - **S3 & DynamoDB Gateway Endpoints**: Free (\$0) and keep AWS API traffic off the NAT Gateway, saving data-processing fees.
   - **Security Group chain (`sg-alb -> sg-app -> sg-redis`)**: Least-privilege firewalling by security group ID rather than broad CIDR ranges.
   - **`nat_gateway_count` variable (default 1)**: Saves ~\$0.045/hr (~\$32/mo) during dev compared to 2 NAT Gateways.

5. **Commands to run and verify**
   ```powershell
   cd infra
   terraform fmt -check
   terraform init
   terraform validate
   terraform plan
   ```
   **Cost implications of `terraform apply` for networking**:
   - VPC, Subnets, IGW, Route Tables, Security Groups, S3/DynamoDB Gateway Endpoints: **\$0.00/hr**
   - 1 NAT Gateway: **~\$0.045/hr** (~\$1.08/day) + \$0.045/GB processed

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md) (`terraform` CLI not installed in this local environment; `network.tf` reviewed).

7. **Likely teacher questions with model answers**
   Added 5 Phase 5 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   `terraform fmt`, `validate`, and `plan` need to be run in an environment with Terraform + AWS credentials configured before `apply`.

9. **Cloud terms introduced**
   Added *NAT Gateway*, *Gateway Endpoint*, *Security Group vs NACL*, and *Least Privilege* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
