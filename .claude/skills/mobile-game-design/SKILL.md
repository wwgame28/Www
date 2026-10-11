---
name: mobile-game-design
description: Game design for this iPhone web game (Walk Wars, a GPS walk-and-capture game in Index.html). Use before building a new game, mode, or feature — to define controls, the core loop, progression, UI and file structure first.
---

# Mobile game design

Work in this order and write the decisions down (short list in the task or `.claude/STATE.md`) before coding:

1. **Controls** — one-thumb play, portrait first. Tap targets ≥ 44×44 pt, primary actions in the bottom third. No hover-only actions, no multi-finger gestures for core actions. For Walk Wars the main "input" is the player's walk (GPS); taps are secondary.
2. **Core loop** — state it in one line (e.g. *walk → capture cells → earn points/coins → level up → unlock*). Each loop step needs visible feedback within 100 ms.
3. **Session shape** — playable in 1–5 min bursts; safe to pause any time (background tab, lock screen, lost GPS). Persist progress immediately.
4. **Progression and economy** — XP curve, currencies, rewards. Keep numbers in one config object, not scattered literals. No paid actions or real-money prompts without the owner's confirmation.
5. **UI map** — list the screens (login, map/HUD, panels, level-up, check-in, settings) and the transitions between them before building any of them.
6. **Structure** — the project is a single `Index.html`. Before adding a large system, propose a split (e.g. `css/`, `js/state.js`, `js/map.js`, `js/ui.js`) and ask; don't restructure unasked.

Engine: plain HTML/CSS/JS + MapLibre GL + Canvas 2D. Never switch engine or framework without permission.

Related skills: `game-ui-ux` (screens), `animation-and-game-feel` (feedback), `iphone-performance` (budget), and the `ui-game-design` / `animation-systems` plugins for general patterns.
