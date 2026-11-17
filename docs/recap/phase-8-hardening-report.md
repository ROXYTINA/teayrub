# Phase 8 Recap: Hardening, Cost, Report, and Presentation

1. **Goal in one sentence.**
   Complete the security & cost review, `terraform destroy` procedure, 10-slide presentation outline, 5-minute demo script, and 10 "what if..." oral-exam scenarios.

2. **What was built**
   - [REPORT.md](file:///d:/year5/cloud/project/teayrub/docs/REPORT.md): Completed with Security & Hardening, Cost Estimate (hourly & per demo day), `terraform destroy` teardown procedure, Limitations & Future Work, 10-slide outline, and 5-minute demo script.
   - [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md): Completed with 40 topic-grouped Q&As + 10 "what if..." failure/scaling scenarios.

3. **How it works**
   All infrastructure is declarative in Terraform (`infra/`), enabling repeatable `terraform apply` before a demo and `terraform destroy` afterward so ongoing cloud costs drop to \$0.

4. **Key decisions and WHY**
   - **Explicit `terraform destroy` workflow**: Prevents idle NAT Gateway, ALB, ECS, and ElastiCache charges between study sessions.
   - **Honest risk register**: Clearly documents remaining gaps (e.g., no Cognito/WAF in Tier 1, single NAT Gateway in dev).

5. **Commands to run and verify**
   ```powershell
   # Teardown (when finished with AWS demo):
   cd infra
   terraform destroy
   ```

6. **Evidence collected**
   All phase recaps (`phase-0` through `phase-8`), [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md), [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md), [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md), and [REPORT.md](file:///d:/year5/cloud/project/teayrub/docs/REPORT.md) are complete and committed.

7. **Likely teacher questions with model answers**
   10 "What if..." scenarios added to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Live AWS deployment, 320-bot load test, and `terraform destroy` execution require an AWS-authenticated environment with Terraform & Docker installed.

9. **Cloud terms introduced**
   All core cloud terms are recorded in [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
