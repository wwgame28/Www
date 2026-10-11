---
name: iphone-performance
description: Performance, memory, loading, touch responsiveness and battery for this game on iPhone Safari (MapLibre GL + Canvas 2D + GPS). Use when optimizing, when adding anything that runs per frame or per GPS update, or when the game feels slow, hot, or drains the battery.
---

# iPhone performance (Safari / WebKit)

## Budgets
- 60 fps target; per-frame JS ≤ 8 ms. First interactive ≤ 3 s on 4G.
- JS heap stays flat during a 10-minute walk (no growing arrays of cells/points without limits).
- Texture and canvas memory: keep canvases at `devicePixelRatio` ≤ 2 for full-screen overlays (the fog canvas), not 3.

## Rendering
- One `requestAnimationFrame` loop; render only when something changed (dirty flag), not every frame.
- Fog canvas: redraw only the changed region (dirty rect); cache static layers on an offscreen canvas.
- MapLibre: limit `maxZoom`, avoid adding a source or layer per cell — use one GeoJSON source and call `setData` in batches (≤ 1 per second while walking).
- Avoid layout thrash: read DOM metrics, then write; never inside loops.

## Loading
- Pin library versions (already `maplibre-gl@4.7.1`); load non-critical scripts with `defer`.
- Lazy-load panels' images and sounds on first open. Preload only the HUD.
- Use WebP/SVG images; use AAC/M4A audio for iOS.

## Touch
- `touch-action: manipulation` on controls (already global) removes the 300 ms delay.
- Use `pointerdown` for game actions and passive listeners for scroll/touch.
- Hit areas ≥ 44 pt; no tiny close buttons.

## Battery
- **GPS**: `watchPosition` with `enableHighAccuracy` only while actively playing; call `clearWatch` on `visibilitychange` → hidden; throttle processing (ignore updates that moved < 3–5 m).
- Pause the rAF loop, timers and audio when `document.hidden` is true.
- No `setInterval` faster than 1 s for UI timers; drive countdowns from timestamps.

## Measure (don't guess)
- Playwright with an iPhone profile plus CPU throttling for a smoke check; `performance.now()` marks around hot paths.
- Real-device profiling uses Safari Web Inspector on a Mac with the iPhone connected; say clearly when a result is from emulation only.
