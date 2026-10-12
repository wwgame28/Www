# State — 2026-10-12
Goal: «Рикошет» — 3D web game for iPhone (arcade + open-world story «Приключение»), GitHub Pages https://wwgame28.github.io/Www/, branch claude/context-optimizer-plugin-569iyo, owner merges PRs.
Done:
- Story v2: village + 7 kingdoms + caves (src/story/zones/*), queens, gems, blessings, bosses, hazards; scene.js renders zones; HUD (boss bar, cold/heat, ⚡ dash, island map, gift cards, ending). PR #10 merged.
- Portrait lock (src/orient.js) + 16 ⭐ errands, «Летопись» (src/story/chronicle.js, 37 pages, 10 scrolls), timed steps — PR #11 open (commits a5eca90, 9ec3fa1).
- Lore: docs/superpowers/specs/2026-10-12-seven-crowns-lore.md, 2026-10-12-universe-lore.md.
- Workflow wf_e71384de-6ec (research: mechanics, VFX, assets, story, bugs, balance → plan); reports in scratchpad/research/.
Next: review the plan, run the implementation workflow (sequential packages, tests green, local commits), then push + PR.
Checks passed: node --test tests/*.test.mjs → 98/98 on 9ec3fa1; bot: all main lines × 7 weapons, all errands × 7 weapons; Playwright iPhone 14 (portrait + landscape): no page errors.
Gotchas: headless Chromium uses software GL (very slow: click #dialog via DOM, not page.click). Story recall cooldown 4 s; lineOf picks the first open line per zone (side lines after the main one; village errands after the finale in LINES order). Assets: KayKit from GitHub (add_repo first), Kenney kits came as owner uploads; licences CC0. Never use paid TinyFish tools.
