# Story mode «Приключение» — design

Owner decisions (2026-10-12): quests + fights in an open world, a hero creator (looks + weapon), an island
for 20–30 minutes in 3 zones joined by gates, the plot «Проклятие кристалла». The current game stays as
the «Аркада» mode; coins and the shop are shared.

## Player experience
- **Menu:** «Аркада» (today's game) and «Приключение». The first time «Приключение» opens the creator.
- **Creator:** base (Barbarian, Knight, Mage, Rogue, Rogue_Hooded), outfit colors (6 palettes: the
  KayKit atlas is recolored, skin-like texels kept), skin tone (3), name, weapon (one of the 7 arcade
  throws). Previewed on the turning hero. Shown again from the adventure menu to change looks.
- **Island:** 3 zones, about 60 × 60 m each, entered through gates with a 1–2 s load:
  village (elder, villagers, campfire, later the merchant), forest (skeleton camps, hunter), ruins with
  the dungeon (crystal switches, the king's lair). Zone edges are hills, mountains and tree belts.
- **Play:** the arcade controls (stick, throw, ↩) plus «Говорить» near a villager; the current task is
  shown on top with an arrow to it. 5 hearts; a hit costs one heart with a short knock-back and
  invulnerability; hearts refill at a campfire; at 0 the hero wakes at the last campfire (no game over).
- **Chapters:** 1 Пробуждение (elder, 3 training targets, a raid on the village, shard 1) ·
  2 Лес шёпотов (3 camps, an armored camp chief, shard 2) · 3 Пропавший караван (defend the merchant's
  cart from waves, the shop opens, shard 3) · 4 Руины (hit 3 crystal switches with ricochets, the gate
  opens, shard 4) · 5 Король скелетов (a boss with a front shield: only hits from behind or the side
  count; phases summon minions; shard 5, ending).
- **Rewards:** coins per task (the same wallet as the shop); finishing the story unlocks the
  «Хранитель кристалла» look.

## How it is built
- `src/story/data.js` — zones (look, size, roads, props with colliders, villagers, campfire, gates,
  spawn), chapters and their steps, dialogue lines. Pure data, asset ids checked by tests.
- `src/story/quests.js` — the chapter/step machine: objectives `talk`, `targets`, `defend` (waves),
  `camps`, `collect`, `switches`, `boss`, `reach`; advanced by world events. Pure, tested.
- `src/story/world.js` — the open-world simulation. Its state has the arcade's shape (hero, projectile,
  enemies, solids, arena, loc, time, events…) so `render.js` draws hero, enemies and projectile as it
  does now; extra fields: hearts, villagers, targets, shards, camps, gates. Projectile flight, bounces,
  pick-up, catch and recall reuse `weapons.js` / `solid.js` and helpers shared with the arcade.
  Enemies idle at their camp, chase inside an aggro radius and return when the hero runs away.
- `render.js` gains `setZone()` (ground with painted roads, props, villagers with idle animations and
  a «!» marker, targets, shards, campfire flames) and draws the story extras in `sync()`.
- UI (index.html, `src/story/ui.js`): mode buttons, creator screen, hearts, task tracker, «Говорить»
  button, dialogue panel, chapter title card; the off-screen arrow points at the current task.
- Save: `progress.js` gets `story` (hero look, chapter, step, flags), repaired on load like the shop.
- Performance: one zone in memory at a time; props cloned from cached GLBs; fog hides the far edges;
  third-person camera only.
- Tests: quest steps, world rules (damage, respawn, aggro/leash, targets, gates), save repair, data
  (assets exist, spawn and paths free of solids). Headless iPhone Chromium: creator → village →
  chapter 1 end to end, no console errors.

## Delivery
- Part A (done): mode select, creator, village, chapter 1, hearts/respawn, dialogue and task UI.
  The creator offers outfit and skin colors; hair is not recolored (3 of 5 bases hide it under a
  helmet, hat or hood, and the atlas has no separate hair swatch).
- Part B: forest, chapters 2–3 (camps, chief, caravan defence, merchant).
- Part C: ruins and dungeon, chapters 4–5 (switches, boss), ending and the reward look.
Each part is playable on its own; later chapters show «продолжение скоро».
