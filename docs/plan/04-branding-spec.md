# IP-Watch Branding Spec (Console Badge)

## Objective
Define a consistent visual identity for the PWA based on the selected `Console Badge` direction.

## Brand Concept
- Friendly network monitor for home devices.
- Rounded badge shape to feel app-native on iPhone.
- Device hints for `PS5`, `PC`, `TV` plus clear status dot.

## Logo System
- Primary mark:
  - Rounded square badge.
  - Three minimal glyph hints inside (controller, monitor, TV frame).
  - One status dot in top-right area.
- Secondary mark:
  - Status dot + simplified badge outline only (small sizes/favicons).
- Wordmark:
  - `ip-watch` lowercase, medium weight, high legibility.

## Color Tokens
- `--color-bg`: `#0B1220` (deep navy)
- `--color-surface`: `#121A2B` (card background)
- `--color-primary`: `#36C2FF` (brand cyan)
- `--color-accent`: `#7BF1A8` (success accent)
- `--color-danger`: `#FF5A5F` (offline/error)
- `--color-warning`: `#FFC857` (unknown/intermediate)
- `--color-text`: `#EAF2FF`
- `--color-muted`: `#8FA3BF`

## Status Semantics
- `PING+HTTP`: green (`--color-accent`)
- `PING` only: cyan (`--color-primary`)
- `HTTP` only: amber (`--color-warning`)
- `UNKNOWN` or offline: red (`--color-danger`)

## Typography
- Headings: `Sora` (600/700)
- Body/UI: `IBM Plex Sans` (400/500)
- Numeric/IP labels: `IBM Plex Mono` (500)

## Iconography
- Style: rounded stroke, 2px visual weight on mobile density.
- Device icons:
  - PS5: simplified controller silhouette.
  - PC: monitor with stand.
  - TV: rectangular frame with short feet.
- Avoid heavy detail; all icons must remain readable at 20-24px.

## Splash Screen Spec (2 Seconds)
- Duration: `2000ms`.
- Sequence:
  1. 0-300ms: background fade in.
  2. 300-1200ms: badge logo scales from `0.92` to `1.0`.
  3. 1200-1700ms: status dot pulse once.
  4. 1700-2000ms: transition to list view.
- Motion style: smooth, not bouncy.

## PWA Icon Set
- Required exports:
  - `192x192`
  - `512x512`
  - `180x180` (apple touch icon)
  - `32x32`, `16x16` (favicon)
- Keep safe padding around badge mark: 12-14%.
- Use flat background color for clarity on iOS home screen.

## UI Tone
- Mobile-first, clean spacing, rounded cards/buttons.
- FAB uses primary cyan fill with high contrast icon.
- Subtle gradients in hero/list header only; avoid noisy backgrounds.

## Accessibility Baseline
- Contrast target: WCAG AA for text and status labels.
- Never use color alone:
  - Pair color with source/status text chip.
- Minimum tap size: 44x44 px.
