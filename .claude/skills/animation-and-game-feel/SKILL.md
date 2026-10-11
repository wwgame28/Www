---
name: animation-and-game-feel
description: Animations, transitions and "juice" for this web game — capture effects, score pops, combo feedback, level-up, screen transitions, haptics. Use when adding feedback or motion to UI or canvas effects.
---

# Animation and game feel

## Rules
- Animate only `transform` and `opacity` (GPU-composited). Never animate `width`, `height`, `top`, `left`, `box-shadow` or `filter` on large elements.
- Durations: press 80–120 ms, UI transition 150–300 ms, reward moment 400–800 ms. Easing: `cubic-bezier(.2,.8,.2,1)` for entering, `ease-in` for exiting.
- Every player action gets feedback in under 100 ms: visual, plus optional sound and haptic.
- Wrap decorative motion in `@media (prefers-reduced-motion: no-preference)` and add a "reduced motion" setting.

## Patterns
- **Score pop**: floating `+N` that translates up and fades out; reuse pooled DOM nodes, don't create one per event.
- **Combo**: scale pulse on the combo pill, with intensity growing with the combo.
- **Capture**: cell flash on the fog canvas plus a short radial burst; batch draws inside one `requestAnimationFrame`.
- **Level-up**: dim backdrop → card scales from 0.8 → number counts up → confetti (canvas, ≤ 80 particles, ≤ 1.2 s).
- **Screen change**: slide + fade; don't animate the map itself.
- **Haptics**: `navigator.vibrate` is not supported in iOS Safari — feature-detect it and treat it as optional.

## Implementation
- One shared `requestAnimationFrame` loop; stop it when `document.hidden` is true.
- Prefer the Web Animations API (`el.animate`) or CSS classes over JS-driven per-frame style changes.
- For general state-machine and blend patterns, the `animation-systems` plugin skill applies.
