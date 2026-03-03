# UI/UX and PWA Plan

## Objective
Deliver a clean, modern, mobile-first interface optimized for iPhone 13-16 with installable PWA behavior.

## Implementation Baseline
- Angular standalone components with signals for UI state.
- Tailwind CSS utility-first styling with custom theme tokens.

## Core Screens
- Splash Screen (2 seconds)
  - New IP-Watch logo
  - Brand color intro animation
- Device List View
  - Device cards/rows with:
    - Type icon (PS5/PC/TV)
    - Name + IP
    - Reachability badge (green/red/optional unknown)
    - Status source chip (`PING`, `HTTP`, `PING+HTTP`, `UNKNOWN`)
- Add Device View/Sheet
  - Name input
  - Type icon selector
  - IP input with auto-dot formatting
- Optional Edit/Delete actions per device

## Interaction Details
- FAB fixed bottom-right for quick add.
- Input mask/formatter for IPv4 (`xxx.xxx.xxx.xxx` behavior).
- Inline validation errors.
- Status refresh indicator and last checked timestamp.
- Optional per-device probe settings (`protocol` + `port`) in add/edit form.
- Source-aware status display:
  - `PING` = LAN host reachable
  - `HTTP` = web endpoint reachable
  - `PING+HTTP` = both checks passed
  - `UNKNOWN` = no valid result

## Visual Direction
- Fresh look with strong readability and touch-first spacing.
- iPhone-safe-area support (notch/home indicator).
- Large tap targets and scrolling stability.
- Lightweight animation only where meaningful.

## PWA Requirements
- `manifest.json` with app name/icons/theme.
- Service worker for app shell caching.
- Apple touch icon + iOS meta tags.
- Start URL and standalone display mode.

## Steps
1. Design tokens and component primitives.
2. Implement splash, list, FAB, add-device flow.
3. Integrate IndexedDB persistence, probe API status data, and source labels.
4. Add PWA assets + service worker.
5. Test install flow on iPhone Safari.

## Acceptance Criteria
- Splash auto-exits after ~2 seconds.
- Device creation works fully on mobile.
- Reachability color coding updates correctly from Pi probe results.
- Status source chip is visible and correct for each device.
- PWA can be added to iPhone home screen.
- UI behaves correctly on iPhone 13, 14, 15, 16 viewport sizes.

## Risks and Mitigations
- iOS PWA caching quirks:
  - Keep service worker cache strategy simple and versioned.
- Input mask usability:
  - Provide fallback to plain text with strict validation.
