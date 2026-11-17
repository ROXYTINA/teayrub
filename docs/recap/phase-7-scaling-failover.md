# Phase 7 Recap: Auto-Scaling, Load Testing, and Failover

1. **Goal in one sentence.**
   Configure WebSocket-aware ECS auto-scaling (`ConnectionsPerTask` + CPU), run a 320-bot load test, and demonstrate AZ + Redis failover recovery.

2. **What was built**
   - [metrics.js](file:///d:/year5/cloud/project/teayrub/server/src/metrics.js): Publishes the custom CloudWatch metric `ConnectionsPerTask` from each ECS task.
   - Auto-scaling & CloudWatch dashboard in [app.tf](file:///d:/year5/cloud/project/teayrub/infra/app.tf): Target-tracking policies on `ConnectionsPerTask` and CPU (min 2 tasks across 2 AZs, max 10; fast scale-out, slow scale-in).
   - [bots.js](file:///d:/year5/cloud/project/teayrub/loadtest/bots.js): Simulates 40 rooms × 8 bots (~320 concurrent players) measuring p50/p95/p99 stroke latency and error rate.
   - [simulate-az-failure.sh](file:///d:/year5/cloud/project/teayrub/scripts/simulate-az-failure.sh): Stops all ECS tasks in one AZ and triggers ElastiCache Redis failover.

3. **How it works**
   Each task reports active WebSocket count to CloudWatch. When `ConnectionsPerTask` exceeds the target (e.g., lowered `conn_target` during demo), ECS Application Auto Scaling launches new tasks across both AZs. During an AZ/Redis failover, clients see `"Reconnecting…"` briefly, then reconnect to surviving tasks and resume from Redis state.

4. **Key decisions and WHY**
   - **`ConnectionsPerTask` over CPU-only**: WebSocket servers hold many idle/low-CPU sockets; memory/socket limits hit before CPU spikes.
   - **Fast scale-out, slow scale-in**: Protects players during sudden traffic spikes while avoiding flapping when rooms empty.
   - **Min 2 tasks**: Guarantees at least one task per AZ at all times.

5. **Commands to run and verify**
   ```powershell
   node --check server/src/metrics.js loadtest/bots.js
   # Against deployed CloudFront URL:
   # node loadtest/bots.js https://<cloudfront-domain> 40 8
   # ./scripts/simulate-az-failure.sh
   ```

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md) (syntax checks passed; live 320-bot load test and failover drill pending AWS deployment).

7. **Likely teacher questions with model answers**
   Added 5 Phase 7 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Live p50/p95/p99 latency numbers, CloudWatch screenshots, and RTO measurements will be captured in `docs/EVIDENCE.md` once deployed to AWS.

9. **Cloud terms introduced**
   Added *Target Tracking Scaling*, *Scale-Out / Scale-In Cooldown*, and *RTO (Recovery Time Objective)* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
