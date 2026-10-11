---
name: game-ui-ux
description: Build or review game UI for this iPhone web game — menus, HUD, inventory, settings, dialogs, level-up and progress screens. Use whenever adding or changing a screen, panel, button, or overlay in Index.html.
---

# Game UI/UX (web, iPhone)

## Reuse the existing system
Read the `:root` CSS variables and existing classes (`.btn-gold`, `.panel-hdr`, fonts `--display`/`--body`) in Index.html first and extend them. Don't introduce a second palette, font or button style.

## Screens
- **HUD**: at most 3–4 always-visible values (points, distance, combo); secondary stats behind a toggle. Never cover the map center.
- **Menus and panels**: bottom sheets or full panels with a clear title, one primary action, and a close/back control in a consistent place.
- **Inventory / shop**: grid of equal slots, empty-slot state, selected state, and a detail sheet.
- **Settings**: sound, haptics/vibration, reduced motion, GPS accuracy mode, logout. Persist in `localStorage`.
- **Dialogs and toasts**: dialogs only for decisions; use toasts or banners for info, and auto-dismiss them.
- **Progress / level-up**: big number, short animation, a single "Continue".

## Visual hierarchy
One primary action per screen (gold), secondary actions muted. Size, then weight, then color. Contrast ≥ 4.5:1 for text.

## Interaction states
Every button has default, `:active` (scale .96 + darker), disabled and loading states. Keep `touch-action: manipulation` and no tap highlight (already global).

## Layout and safe areas (required)
- Viewport meta must include `viewport-fit=cover`.
- Pad edge-anchored UI with `env(safe-area-inset-top|bottom|left|right)`, e.g. `top: calc(12px + env(safe-area-inset-top))`.
- Use `100dvh` rather than `100vh`. Test 375×667 (SE), 390×844, 430×932, and landscape.

## Transitions
150–300 ms, `transform`/`opacity` only; honor `prefers-reduced-motion`. See `animation-and-game-feel`.

## Verify
Screenshot with Playwright (Chromium at `/opt/pw-browsers`) using an iPhone device profile, in portrait and landscape; check nothing sits under the notch or home indicator.
