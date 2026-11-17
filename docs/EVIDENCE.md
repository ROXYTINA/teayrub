# CloudDraw Evidence Log

This file records verified test outputs, screenshots, and metrics collected across all phases.

## Phase 0: Foundations
- **Git repository initialized**: `git init` in `d:\year5\cloud\project\teayrub`.
- **Diagrams created**: [architecture.md](file:///d:/year5/cloud/project/teayrub/docs/diagrams/architecture.md) containing full AWS architecture and VPC/subnet/SG chain Mermaid diagrams.
- **Project plan created**: [PROJECT_PLAN.md](file:///d:/year5/cloud/project/teayrub/docs/PROJECT_PLAN.md) with Tier 1/2/3 scope.

## Phase 1: Frontend Design & Local Canvas
- `node --check web/app.js` passed (exit code 0).
- `web/style.css` verified to include `@media (prefers-reduced-motion: reduce)` and `:focus-visible` keyboard focus styles.

## Phase 2: Real-Time Game Server
- `node --check server/src/index.js server/src/ws.js server/src/game.js server/src/api.js` passed (exit code 0).
- *Note*: Live `smoke.js` run is pending `npm install` and a running Redis instance in the local environment.
