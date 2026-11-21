# TeayRub design direction

Study of skribbl.io, and how to turn the useful parts into a TeayRub look of our own.

## What skribbl.io does (structure, not look)

**Home screen**
- One centered card holds everything needed to start: name field, avatar picker, a big primary "Play!" button, and a secondary "Create Private Room" button. No login.
- The avatar picker uses arrow buttons for each part (eyes/hat, mouth, color) and a randomize button. Players customize by clicking, not by typing.
- Below the card, three equal info cards: About, News, How to play. Short sentences, one idea per line.

**Game screen**
- The drawing canvas is the largest element and sits in the middle.
- Players are listed on the left, chat/guesses on the right, and the drawing tools sit under the canvas.
- A top bar shows the round, the word (or hidden underscores) and a timer bar.

**Characters**
- Flat, simple, expressive avatars built from swappable parts (eyes, mouth, hat, color). They are small and reused everywhere a player appears.

**Background and tone**
- A pale, low-contrast wallpaper of hand-drawn doodles, so the cards and canvas stand out.
- Friendly and light. Nothing heavy, nothing that blocks play.

## What we should NOT copy

- Their logo, rainbow letters, doodle wallpaper, character drawings, blue palette, or exact copy and layout. Those belong to skribbl.io, and copying them would make TeayRub look like a clone.
- The untracked `web/bg-doodle2.png` and `web/bg-smiley.png` files. If they came from skribbl.io or look like its doodles, do not commit them. Tell me which, and I will replace them with our own art.

## TeayRub's own identity (keep and build on it)

Already in the project, and different from skribbl:
- Palette: paper `#d9edff`, ink `#23224d`, pink `#ff4f8b`, yellow `#ffd43b`, mint `#2fd6a0`, violet `#6b5bff`.
- Type: **Chewy** for headings, **Nunito** for body.
- Hard offset shadows on cards and buttons (`5px 5px 0 ink`), thick ink borders.
- Our own logo (`web/logo-primary.svg`) and icon set in `brand/`.

## Proposed direction

1. **Background:** replace the plain grid with a subtle pattern drawn from our logo's own shapes, in violet at about 8% opacity. Keep it quiet so the canvas wins.
2. **Characters:** keep our part-based avatar system (`web/app.js`). Draw new original parts in our palette, not skribbl's blob people. Give each avatar a name tag under it.
3. **Home:** keep the single play card. Make the primary button the only yellow element on the screen, so the eye knows where to go.
4. **Game:** make the canvas the hero. Group the tools into one tray (colors, sizes, eraser, undo, clear). Show the word as large Chewy letters in the top bar, and hide letters as underscores while guessing.
5. **Info content:** replace skribbl-style About/News/How-to-play with TeayRub's own short text (`How to Play` in README.md can be the source). Use the existing Leaderboard and Hall of Fame cards instead of news.
6. **Motion:** keep the gentle avatar bob. Add a small press effect on buttons (already present). No autoplay animation behind text.
7. **Phone:** chat moves to a collapsible panel under the canvas. The tool tray scrolls sideways instead of wrapping. Keep 16px side gutters and no horizontal page scroll.
8. **Accessibility:** keep focus rings (`:focus-visible`). Check the ink-on-yellow and ink-on-mint contrast, and keep text at 4.5:1 or higher.

## Checklist before shipping the new look

- [ ] Background and characters are original (no skribbl.io art)
- [ ] Renders at 375px wide with no horizontal scroll
- [ ] Renders at 1280px wide with the canvas as the largest element
- [ ] Contrast checked for every text/background pair
- [ ] Untracked doodle PNGs reviewed before any commit
