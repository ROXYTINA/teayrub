# Phase 4 Recap: Persistence and Artwork Storage (Local First)

1. **Goal in one sentence.**
   Add durable storage for the leaderboard, match history, word bank, and Hall of Fame artwork behind one `store` module that switches cleanly between local Redis/disk and AWS DynamoDB/S3.

2. **What was built**
   - [store.js](file:///d:/year5/cloud/project/teayrub/server/src/store.js): Dual-backend persistence (`USE_DYNAMO=false` uses Redis sorted sets/lists; `USE_DYNAMO=true` uses AWS DynamoDB).
   - [words.js](file:///d:/year5/cloud/project/teayrub/server/src/words.js) & [seed-words.js](file:///d:/year5/cloud/project/teayrub/server/scripts/seed-words.js): Word bank loader and DynamoDB seeder.
   - Artwork flow in [api.js](file:///d:/year5/cloud/project/teayrub/server/src/api.js): Checks turn eligibility, issues a presigned S3 `PUT` URL (or local disk upload endpoint in dev), and records gallery metadata.

3. **How it works**
   When a turn ends with at least one correct guess, the drawer's browser exports `<canvas>` to PNG (`toBlob`), requests a presigned `PUT` URL from `/api/artwork/presign`, uploads the PNG **directly** to S3 (never passing binary image bytes through the Node.js server), and confirms metadata so it appears in the Hall of Fame.

4. **Key decisions and WHY**
   - **Presigned S3 URLs**: Keeps binary image uploads off the ECS tasks, saving CPU, memory, and bandwidth.
   - **DynamoDB (on-demand)**: Serverless, single-digit millisecond reads/writes, \$0 when idle, and no schema migrations for JSON match/gallery items.
   - **Single `store.js` abstraction**: Switching `USE_DYNAMO=true` moves from local Redis to DynamoDB without changing any game logic.

5. **Commands to run and verify**
   ```powershell
   node --check server/src/store.js server/src/words.js server/scripts/seed-words.js
   ```
   Expected: exits 0.

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md).

7. **Likely teacher questions with model answers**
   Added 5 Phase 4 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Local end-to-end match + gallery upload test requires running the local stack; Phase 5–6 provisions the real S3 buckets and DynamoDB tables in AWS.

9. **Cloud terms introduced**
   Added *Presigned URL*, *DynamoDB On-Demand*, and *Partition Key* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
