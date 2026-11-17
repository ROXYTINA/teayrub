# Phase 1 Recap: Frontend Design and Local Canvas

1. **Goal in one sentence.**
   Build a distinctive, mobile-friendly notebook-and-marker HTML5 frontend with normalized canvas drawing, ~40 ms stroke batching, and zero build step.

2. **What was built**
   - [index.html](file:///d:/year5/cloud/project/teayrub/web/index.html): Home screen (name, create/join room, leaderboard, Hall of Fame) and Game screen (topbar, players list, 800x600 canvas, color/size/eraser/clear tray, chat/guess box, overlays, footer).
   - [style.css](file:///d:/year5/cloud/project/teayrub/web/style.css): Graph-paper background (`#d9edff` + `#bcdcf7` grid), `Chewy` + `Nunito` typography, hard offset shadows (`5px 5px 0 #23224d`), responsive mobile layout, `:focus-visible` outlines, and `@media (prefers-reduced-motion: reduce)`.
   - [app.js](file:///d:/year5/cloud/project/teayrub/web/app.js): Plain ES module client handling pointer events, immediate local rendering, normalized `0..1` coordinates, ~40 ms stroke batching, and WebSocket/REST integration.

3. **How it works**
   When the drawer moves a finger or mouse on `<canvas>`, `pointerdown`/`pointermove`/`pointerup` events capture the position, convert it to normalized `[0..1, 0..1]` coordinates, draw locally right away for zero-latency feedback, and queue points into a buffer flushed every ~40 ms over WebSocket.

4. **Key decisions and WHY**
   - **Plain HTML/CSS/JS (no build step)**: Zero bundler overhead, instant `S3 sync` deployment, and every line is readable in an oral exam.
   - **Normalized `0..1` coordinates**: A phone screen (360px wide) and a desktop monitor (800px canvas) map to the exact same relative positions, preventing clipped or stretched drawings.
   - **~40 ms stroke batching**: Sending every raw `pointermove` event (60–120 Hz) would flood WebSockets and Redis Pub/Sub. Batching every ~40 ms (~25 messages/sec) keeps drawing smooth while cutting network traffic by 3–4x.
   - **Pointer Events (`pointerdown`/`pointermove`/`pointerup`)**: Unified API for mouse, touch, and stylus without duplicating `mouse*` and `touch*` handlers.

5. **Commands to run and verify**
   ```powershell
   node --check web/app.js
   Select-String -Path web/style.css -Pattern "reduced-motion"
   ```
   Expected: `node --check` exits 0; `reduced-motion` media query is present.

6. **Evidence collected**
   Recorded in [EVIDENCE.md](file:///d:/year5/cloud/project/teayrub/docs/EVIDENCE.md).

7. **Likely teacher questions with model answers**
   Added 5 Phase 1 Q&As to [TEACHER_QA.md](file:///d:/year5/cloud/project/teayrub/docs/TEACHER_QA.md).

8. **Known limitations and future work**
   Without the backend running yet, creating/joining rooms and loading boards will show connection errors; Phase 2 connects the Node.js server.

9. **Cloud terms introduced**
   Added *Normalized Coordinates*, *Stroke Batching*, and *Pointer Events* to [GLOSSARY.md](file:///d:/year5/cloud/project/teayrub/docs/GLOSSARY.md).
