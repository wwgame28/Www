---
name: unreal-game-builder
description: Plan and drive building a complete Unreal Engine 5 Blueprint game from idea to packaged .exe — design doc, class structure, stage-by-stage tasks with checks, playtest, optimization, packaging and release. Use when the user wants to make their own Unreal game (the "Кристальная арена" capstone in docs/unreal-engine/11-proekt-igry-po-shagam.md or a new idea), asks "what next" on their project, or wants a plan, task list or scope cut.
---

# Unreal game builder

Guide the user through making a finished Blueprint-only game in Unreal Engine 5. Reference project and stage template: `docs/unreal-engine/11-proekt-igry-po-shagam.md`. Answer in Russian unless the user writes otherwise.

## Order of work

1. **One-page design doc first** — genre, goal, core loop in one line, controls, enemies/obstacles, progression, lose condition, saving, scope (number of levels, minutes of play). Help them cut scope: first game = 3 short levels max. Offer to keep it as a Claude Doc or `GAME_DESIGN.md` in their project.
2. **Class map** — list every Blueprint by folder with prefixes (Core, Player, Components, Interfaces, Pickups, World, Combat, AI, UI, Data, Maps), the way chapter 11 does. Put shared logic in Actor Components, balance numbers in Data Tables/Structs.
3. **Stages that are playable after each step** — use chapter 11's stages 0–15 as the template, adapted to their genre. Each stage gets: tasks as checkboxes, the course chapter to re-read, and a concrete «Проверка» (what to do in Play mode to confirm it works).
4. **Greybox before art** — mechanics on blockout geometry first; Fab/Megascans art, materials and lighting only after the game is fun.
5. **Playtest** — at least 3 people, watch silently, write down where they get stuck; fix the top issues before adding features.
6. **Optimize and package** — `stat unit` per level, chapter 10.3 checklist, Development build test, then Shipping with all maps listed, test on another PC.
7. **Release** — itch.io first; Steam only when they have a trailer, screenshots and a store page ready.

## Rules

- Keep a running status: which stage is done, what's next, open bugs. If the project has a git repo, suggest committing (with Git LFS) after every working stage.
- When a stage is blocked by a bug, switch to the `unreal-blueprint-mentor` approach (debug method, chapter 12).
- If the Epic "Unreal Engine Skills" plugin is connected, use its editor tools for setup chores (creating folders, placing pickups, making material instances) and for checking the project against the stage checklist; leave the core gameplay graphs for the user to build unless they ask you to.
- Don't add features beyond the design doc without asking; propose them as a "после релиза" list instead.
