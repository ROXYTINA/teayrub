# TeayRub logo kit

**Tagline:** Draw and Guess

## The idea (what to tell your teacher)
The mascot is a friendly pencil with big curious eyes. The pencil is the "draw" part, and its wide-eyed look is the "guess" part. The lines are slightly wobbly and the colours sit a little off the outline, like a sticker drawn by hand, to match a casual game played with friends. The name comes from Khmer: "teay" means guess and "rub" means picture.

## Colours
| Name | Hex | Use |
|---|---|---|
| Ink | #23224d | outlines, "Teay" |
| Pink | #ff4f8b | eraser, "Rub" |
| Yellow | #ffd43b | pencil body, text shadow |
| Wood | #ffe3b0 | pencil tip |
| Violet | #6b5bff | maskable icon background |
| Paper blue | #d9edff | site background |

Font: Chewy (free, SIL Open Font License), converted to outlines, so the SVGs need no fonts installed.

## Files
| File | Use |
|---|---|
| logo-primary.svg / png | header, slides (horizontal) |
| logo-stacked.svg / png | cover page, social, posters |
| icon.svg, png/icon-192.png, icon-512.png | pencil only, square |
| wordmark.svg / png | text only |
| logo-mono-black.svg / png | one-colour print on light backgrounds |
| logo-mono-white.svg / png | on dark or photo backgrounds |
| favicon.svg, favicon.ico, png/favicon-16/32/48/64.png | browser tab (simplified: thicker lines, no cheeks or band) |
| png/apple-touch-icon-180.png | iPhone home screen |
| png/icon-maskable-512.png | Android adaptive icon (pencil kept inside the centre safe zone) |
| png/og-image.png | link preview (1200x630) |

## Add to the website `<head>`
Copy `favicon.svg`, `favicon.ico`, the icons and `og-image.png` into `web/` first.
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#6b5bff">
<meta property="og:title" content="TeayRub: Draw and Guess">
<meta property="og:image" content="/og-image.png">
```
`manifest.webmanifest`:
```json
{ "name": "TeayRub", "short_name": "TeayRub", "start_url": "/", "display": "standalone",
  "background_color": "#d9edff", "theme_color": "#6b5bff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```

## Rules
- Keep clear space around the logo equal to the width of the pencil.
- Minimum size: full logo 120 px wide; below 32 px use favicon.svg.
- Do not stretch or recolour. On pink or yellow backgrounds use the black or white versions.
