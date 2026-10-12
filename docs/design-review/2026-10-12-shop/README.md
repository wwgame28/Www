# Shop (cosmetics) — design drafts, stopped early

**Коротко (для владельца):** магазин только с внешним видом, 15 предметов: 5 обликов героя (600 🪙), 5 обликов оружия (400 🪙), 5 следов полёта (300 🪙, Радуга — 1000 🪙). Монеты = очки ÷ 10 за забег, новый рекорд ×2, первый вызов дня +20. Витрина + «Товар дня» (3 вещи −30 %). Облики героя и оружия уже опробованы на прототипе (см. `preview.jpg`), следы и экран магазина ещё не проверены.

The 4-agent design workflow (catalog, economy, UI, tech lead) was stopped by the owner after ~30 minutes. Only the catalog and economy agents had been working; neither returned a final report, the UI and lead agents never started. What is here is their scratch work, kept so the next run starts from it.

## Decided with the owner (2026-10-11)
- Cosmetics only — nothing changes gameplay, so friends' records stay comparable.
- 15 items, each works on any hero; the default look in each category is free.
- Coins = score ÷ 10 per run; a new record on that location doubles the run's coins; the first daily challenge of the day +20.
- Full catalog + "Товар дня": 3 items at −30 %, change at midnight, same for every friend (seeded by the date).
- "Магазин" button in the menu; shop screen with the coin balance, the 3D hero in the showcase camera, tabs Товар дня · Герой · Оружие · Следы; tap = try on before buying.
- No real money, ads, accounts or servers; saves stay in localStorage.

## Files
- `preview.jpg` — the prototype on the Knight, "high" graphics: default + 5 hero skins (Золото, Лёд, Тень, Пламя, Призрак), 5 weapon skins (Золото, Лёд, Неон, Кристалл, Лава). Rendered by the catalog agent in headless iPhone Chromium (emulation, not a real phone).
- `cosmetics-prototype.js` — the catalog agent's prototype (it ran in a scratch copy of `src/`, not wired into the game): `CATALOG` (15 items), `SKINS`/`WEAPONS` recipes (cloned KayKit materials through one shader patch: desaturated atlas, fresnel rim, glow, rim alpha for Призрак; a small studio env map for metallic looks), `TRAILS` particle presets (fire, stars, snow, dark, rainbow; canvas-drawn textures). Trails were **not** screenshot-checked.
- `economy-bot.mjs` + `economy-runs.txt` — the economy agent's bot: it plays the real simulation at three aim levels (k = 0 sloppy, 0.5, 1 good) over many seeds, heroes and locations. Medians from its runs:
  - coins per run (score ÷ 10): ~70 (k 0), ~170 (k 0.5), ~245 (k 1); 2–4.5 minutes per run;
  - so with the proposed prices (7 200 coins in total) the first item comes after ~2–4 runs and the whole catalog after ~30–90 runs.
  - **Balance outlier:** Маг камней (stone mage) scores 3–6× the other heroes (median 3 800–15 000 vs 700–2 900). The agent was weighing a per-run cap of 1 000 coins before the ×2; the balance review should look at the hero itself.

## Next
Run `workflow-shop-rest.js` (here): the shop UI/UX agent, then the tech lead (spec + plan) reading these drafts. In a Claude Code session on this repo say «Запусти воркфлоу docs/design-review/2026-10-12-shop/workflow-shop-rest.js». Then implement after the owner approves.
