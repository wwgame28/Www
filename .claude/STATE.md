# State — 2026-10-12
Goal: «Рикошет» — 3D web game for iPhone (arcade + open-world story «Приключение»), GitHub Pages https://wwgame28.github.io/Www/ (serves main), branch claude/context-optimizer-plugin-569iyo, owner merges PRs.
Done:
- Story v2 (PR #10), portrait lock + 16 errands + «Летопись» (PR #11) — merged.
- Studio skills: branch claude/game-studio-skills (73 skills, 49 agents from Claude Code Game Studios 1.1.3, MIT; hotfix and the pack's hooks/scripts/docs not installed), pushed, no PR (owner's call).
- Review: docs/review/2026-10-12-game-review.md (14 problems ranked, 5 phone wins).
- Fixes: save on pause/hide/pagehide; no render while paused, 30 fps on menu/over; rogue trait (speed+magnet), black-hole radii 3.2/2.6; Кузница Грома (src/story/forge.js); Задания дня + chest streak (src/tasks.js); ads layer src/monetize.js (yandex/crazygames/poki/test via ?platform=, none on Pages) with rewarded ×2 coins, revive, tasks ×2, forge +100; auto-throw setting; chapter progress on the map; SE task line; README; docs/monetization.md.
Checks passed: node --test → 111/111; story bot: 10 lines × 7 weapons, errands (blackhole, ricochet) 0 stuck; arcade bot spread 1.8×; Playwright iPhone 14: tasks, forge, revive, over ×2, no-platform mode, paused draws 0 — no page errors.
Next (owner decisions): gentle start for new players (changes records), meshopt model compression (needs on-device visual check), English, Act 2.
Gotchas: headless Chromium uses software GL (click via DOM). data.daily = daily-challenge records; daily tasks live in data.dayTasks. Never use paid TinyFish tools.
