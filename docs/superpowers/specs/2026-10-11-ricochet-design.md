# Ricochet — design spec

Date: 2026-10-11 · Status: approved in chat ("делай как считаешь нужным")

## Intent
- **Who/why:** a game for the owner and friends to play on iPhone and compete on high scores.
- **Not a goal:** App Store release, monetization, accounts, servers.
- **Success:** opens from a link in iPhone Safari, playable one-handed, 1–3 min runs, a friend can open a shared link and play the exact same daily run to beat a score.

## Platform
- Web game at the repository root (Walk Wars was removed on the owner's request; it remains in git history).
- three.js r169 vendored in `vendor/` (no CDN, no build step), ES modules + import map.
- Portrait first; landscape works. Honors iPhone safe areas.
- Hosting (e.g. GitHub Pages) only after the owner confirms — it is a publication.

## Core mechanic
Top-down 3D arena (camera tilted ~55°). The hero has **one projectile**. Firing throws it; to fire again the hero must get it back.

- **Move:** floating joystick — touch anywhere and drag; direction and distance from the touch origin set direction and speed.
- **Fire:** quick tap (< 220 ms, < 14 px movement) aims at the tapped ground point. A second finger can tap while the first one steers.
- **Pick up:** walk over a dropped projectile. **Catch in flight** (after 0.25 s) → next shot scores ×2.
- **Death:** any enemy touching the hero. One life.

## Scoring
- k-th kill within the same shot scores `10·k` (combo), times 2 if the shot followed an in-flight catch.
- Wave cleared: `+50·wave`.
- Tracked: score, best combo (kills in one shot), wave reached. Best score per location stored in `localStorage`.

## Weapons (trajectory = identity)
| id | Name | Trajectory | Ends |
|---|---|---|---|
| ricochet | Рикошет | Straight, 3 bounces off walls/obstacles | Drops after last bounce |
| boomerang | Бумеранг | Constant-curvature arc, then homes back to hero | Returns to hand (no ×2) |
| snake | Змей | Forward + sine sway (amplitude 1.2 m), 2 bounces | Drops |
| spiral | Спираль | Flies to target, then spirals outward 1.4 s | Drops |
| lightning | Молния | Straight until a hit, then chains to nearest un-hit enemy ≤ 5 m, up to 6 jumps | Drops at last hit |
| orbit | Орбита | Circles the hero, radius 1→6 m over 3 s | Drops |
| blackhole | Чёрная дыра | Curved (side-bulging) path to target, pulls enemies 1.2 s, explodes r = 3 m | Drops at center |

Unlocks by best score on any location: ricochet 0, boomerang 300, snake 800, spiral 1500, lightning 2500, orbit 4000, blackhole 6000.

## Enemies
| type | Model | Speed m/s | HP | Notes |
|---|---|---|---|---|
| grunt | blocky character | 1.6 | 1 | from wave 1 |
| runner | blocky character | 3.0 | 1 | from wave 3 |
| tank | blocky character (scaled 1.3) | 1.1 | 2 | from wave 5 |
| splitter | blocky character | 1.8 | 1 | spawns 2 runners on death, from wave 7 |
| ufo | `enemy-ufo` | 2.2 | 1 | flies over obstacles, from wave 9 |

Waves come from a seeded RNG: count `4 + 2·wave`, spawns from arena edges with decreasing interval, type mix grows with wave. Speed ×(1 + 0.04·wave), capped at ×1.6.

## Locations (each has one rule)
| id | Name | Kit | Rule | Unlock (best wave anywhere) |
|---|---|---|---|---|
| forest | Лес | nature-kit | Trees/rocks are bounce obstacles | 0 |
| cave | Пещера | modular-cave-kit | Dark, lit by hero light; more wall obstacles | 5 |
| winter | Зимняя деревня | holiday-kit + snow tiles | Ice: hero slides (low friction); dropped projectile keeps sliding | 10 |
| river | Река у крепости | tower-defense-kit | Horizontal river slows anyone inside to 50 % | 15 |

Obstacle layout is fixed per location (seeded by location id) so runs are comparable.

## Daily challenge and sharing
- Daily seed = `YYYY-MM-DD`; it picks location and weapon (ignoring locks) and drives waves.
- Share link: `…/#c=<base64url JSON {d,l,w,s,b,v}>` (date, location, weapon, score, best combo, wave). Opening it shows "<score> — побей!" and offers that exact run.
- Uses the iOS share sheet (`navigator.share`), falls back to copying to the clipboard.

## Screens
Menu (3D scene behind, Play / Daily / Arsenal / Locations, settings icon) · Arsenal (rotating blaster, animated trajectory preview, lock + condition) · Locations (cards with best score, lock) · HUD (score, wave, combo pop-ups, projectile indicator + off-screen arrow, pause) · Pause · Game over (score, best combo, wave, "Новый рекорд!", Share, Again, Menu) · Settings (sound, music, quality low/high, left-handed).

## Assets
All Kenney, CC0 (verified in each `License.txt`). Copied into `assets/<kit>/` — only the models used, plus their `Textures/`. Skybox downscaled to 2048×1024 for the menu. Sounds are synthesized with Web Audio (no audio pack uploaded yet). Sources listed in `CREDITS.md`.

## Architecture
Simulation is plain JS with no three.js dependency, so it is unit-testable:
- `src/rng.js` — seeded PRNG (mulberry32) and string → seed.
- `src/weapons.js` — weapon table plus `step(projectile, dt, world)` per trajectory.
- `src/waves.js` — `planWave(seed, wave)` → spawn list.
- `src/game.js` — world state, step, collisions, scoring, events.
- `src/locations.js` — per-location config (rule params, obstacle layout, models).
- `src/share.js` — encode/decode the challenge link.
- `src/progress.js` — records and unlocks in `localStorage` (guarded with try/catch).

Presentation:
- `src/render.js` — three.js scene, GLTF loading/caching, syncs meshes to state, animations.
- `src/input.js` — pointer handling (joystick and tap).
- `src/audio.js` — synthesized SFX.
- `src/ui.js` — DOM screens.
- `src/main.js` — wiring and a fixed-timestep loop (1/60 s).

## iPhone performance
- `devicePixelRatio` capped at 2 (1.5 on "low").
- One directional light with a 1024 shadow map (shadows off on "low").
- Models loaded per location; GLB templates cached and cloned.
- Loop and audio paused on `visibilitychange`; no per-frame allocations in hot paths.

## Testing
- `node --test tests/*.test.mjs`: RNG determinism, wave determinism, each weapon's trajectory invariants, kill/combo/catch scoring, pickup, share round-trip.
- Playwright (Chromium, iPhone 14 profile, served locally): menu renders, a run starts, taps fire, no console errors, screenshots in portrait.
- Real-device check is the owner's (Safari on iPhone); emulation results are reported as emulation.

## Out of scope (v1)
Online leaderboards, accounts, music tracks, haptics (iOS Safari has no Vibration API), tower turrets in the river location.
