export const meta = {
  name: 'ricochet-design-review-part2',
  description: 'Remaining five specialists (animation, levels, balance, UI, iPhone perf) review Ricochet, then one agent synthesizes a plan with part-1 reports passed in args.previous',
  phases: [
    { title: 'Research', detail: '5 parallel specialists, read-only' },
    { title: 'Synthesize', detail: 'one prioritized plan' },
  ],
}

const CONTEXT = `
Project: "Рикошет" (Ricochet), a casual 3D arcade web game for iPhone Safari, in the git repo at /home/user/Www (repo root is the site; served by GitHub Pages at https://wwgame28.github.io/Www/).
Tech: plain ES modules, no build step. three.js r169 vendored in vendor/ (also three.quarks 0.16 particles, pmndrs postprocessing 6.39.5, three Water addon). Import map in index.html.
Core mechanic: the hero has ONE projectile; firing throws it; to fire again you must pick it up (or catch it mid-air for x2 next shot). Combo = kills with one shot.
Files:
- src/game.js — pure simulation (hero, enemies, projectile, scoring, waves, perks, shield, magnet). Unit-testable, no three.js.
- src/weapons.js — 7 trajectories (ricochet, boomerang, snake, spiral, lightning, orbit, blackhole) + previewPath for the aim line.
- src/heroes.js — 7 heroes (KayKit Adventurers models) each mapped to one weapon; src/perks.js — upgrades offered after each wave.
- src/waves.js — seeded waves, enemy types (KayKit skeletons + UFO). src/locations.js — 7 locations (forest, city, dungeon, winter, river, cemetery, space) with rules; arena 16x24 m.
- src/render.js — three.js scene, third-person camera (default) and top-down view, skinned characters, animations by name, occluder fading, aim line, bloom/vignette, water, adaptive pixel ratio. src/fx.js — three.quarks effects.
- src/input.js — fixed joystick (left), fire button (right, hold = aim line, release = shoot), drag elsewhere turns camera.
- src/main.js — game loop, menus, heroes screen, daily challenge, share links. src/ui.js — DOM screens. index.html — markup + CSS.
- assets/ — converted KayKit/Kenney GLBs (CC0). Animation clips available on heroes: Idle, Running_A, Running_Strafe_Left, Running_Strafe_Right, Walking_Backwards, 1H_Ranged_Shoot, Throw, Spellcast_Shoot, PickUp, Death_A, Hit_A, Cheer. On skeletons: Idle, Walking_D_Skeletons, Running_A, Death_A, Hit_A, Spawn_Ground_Skeletons. The original KayKit packs (with all 76-95 clips) are cloned under /tmp/claude-0/-home-user-Www/3163078e-82cd-5948-b918-4a6af5557c17/scratchpad/kk/ if you need to know what else exists.
- tests/ — node --test suites (sim, perks, content, syntax).
- docs/superpowers/specs/2026-10-11-ricochet-design.md — the design spec.
Owner: non-technical, plays on an iPhone only, wants the game to be WORKING and FUN, one-handed portrait, competing with friends on scores.
Constraints: keep the one-projectile mechanic; portrait only; iPhone Safari performance matters; assets must be CC0/MIT-compatible; no paid services; no servers.
Rules for you: READ ONLY. Do not edit, create, or delete any files in /home/user/Www, do not commit or push. You may run read-only commands and small throwaway node scripts in a temp directory (the simulation in src/game.js is pure JS and can be imported with node). The container's network blocks most websites; GitHub works through the GitHub MCP tools (load them with ToolSearch, e.g. "select:mcp__github__search_repositories,mcp__github__get_file_contents") and git clone over https into a temp dir.
Be concrete: name files, functions, numbers. Prefer few high-impact recommendations over long lists.
Already done (part 1 of this review, 2026-10-11): the controls/camera and GitHub specialists reported (camera reframe to ~33° pitch, soft-lock aim assist, fire cancel, joystick dead zone/semi-floating origin, one-handed mode, pickup vacuum + beacon, danger arcs, keep our own controller; upper/lower-body animation masks, phase-synced crossfades). Two bugs were already fixed: the T-pose after shooting while running (render.js animate) and hand props not being filtered (handslotl/handslotr names). Do not repeat those; build on them.`

const REC = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '3-6 sentence assessment of the current state in your area' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string', description: 'player-facing reason it matters' },
          how: { type: 'string', description: 'concrete implementation: files, functions, values, assets/clips to use' },
          impact: { type: 'integer', minimum: 1, maximum: 5 },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
        },
        required: ['title', 'why', 'how', 'impact', 'effort'],
      },
    },
    evidence: { type: 'array', items: { type: 'string' }, description: 'what you actually checked: files read, commands run, measurements, repos inspected' },
  },
  required: ['summary', 'recommendations', 'evidence'],
}

const SPECIALISTS = [
  {
    key: 'github', label: 'GitHub controllers',
    prompt: `You are the GitHub scout. Find existing open-source third-person character controllers / camera rigs WITH animation state handling for three.js (ideally plain JS, mobile/touch friendly, permissive license: MIT/Apache/BSD/CC0) that this project could adopt or learn from. Search GitHub (MCP search tools; queries like "three.js third person controller", "threejs character controller animation", "three.js touch joystick third person", "ecctrl", "three-pathfinding", "nipplejs"). For the top 3-5 candidates, inspect the repo (README, license, last activity, three.js version/peer deps, whether it is React-only like react-three-fiber/ecctrl, size, how it handles camera collision, animation blending, touch input). Then compare honestly against what this project already has in src/input.js, src/render.js (placeCamera, animate, fadeOccluders) and src/main.js (moveVector, yaw). Recommend: adopt X / copy specific techniques from X / keep ours — with the exact reason (compatibility with three r169 + no build step + import map, license, mobile). Recommendations should be things to actually do in this repo.`,
  },
  {
    key: 'controls', label: 'Controls & camera',
    prompt: `You are the mobile controls and camera specialist. Review src/input.js, the camera in src/render.js (placeCamera, setView, fadeOccluders), and src/main.js (moveVector, yaw, LOOK_SENS, aheadOfHero, crosshair, fire button flow). Evaluate one-handed/two-thumb portrait play on iPhone: joystick dead zone and size, camera turn sensitivity and smoothing, aiming in third person (currently straight ahead 8 m), aim assist/soft lock options for a one-projectile game, how to pick the dropped projectile up quickly, camera collision with walls/obstacles, what happens near arena edges, left-handed mode. Propose the most impactful concrete changes with numbers.`,
  },
  {
    key: 'animation', label: 'Animation & game feel',
    prompt: `You are the animation and game-feel specialist. Review src/render.js (animate, sync, ONE_SHOT, hero clip selection, enemy views, dying), src/fx.js, and src/audio.js, plus which clips exist in assets (see context; inspect the original KayKit packs in the scratchpad for more clips worth adding, e.g. Hit_B, Dodge_*, Jump_*, 2H_* attacks, Death_B, Death_C_Skeletons, Skeletons_Awaken_*, Cheer). Propose how to make shooting, catching, picking up, hits, kills, combos, wave clears, hero death and enemy spawn feel juicy: blending/timing, upper-body vs full-body (three.js AnimationMixer per-bone masks are not built in — say what is feasible), hit-stop, camera shake, knockback, damage flashes, projectile spin/orientation, catch animation, victory pose. Be specific about clip names, durations and where in the code.`,
  },
  {
    key: 'levels', label: 'Locations & level design',
    prompt: `You are the level designer. Review src/locations.js (7 locations, rules, obstacle/decor lists, layoutFor random-but-seeded placement) and the asset folders under assets/ (list what models exist; the full original KayKit packs are in the scratchpad if useful). For a 16x24 m arena with a third-person camera and a ricochet mechanic, propose how to make each location look and play better: hand-authored layouts vs seeded scatter, bounce-friendly geometry (walls, pillars, corridors), landmarks, lanes, cover, hazards that fit each location's rule, lighting/fog per location, ground textures/tiles from the packs instead of flat colored planes, perimeter dressing so the third-person view (which sees the horizon) doesn't look empty. Keep it feasible with the existing assets.`,
  },
  {
    key: 'balance', label: 'Combat & balance',
    prompt: `You are the combat and balance designer. Review src/game.js, src/weapons.js, src/heroes.js, src/perks.js, src/waves.js. Then MEASURE: write a throwaway node script in a temp dir that imports the simulation from /home/user/Www/src (ES modules) and runs a simple bot per hero (e.g. bot moves away from the nearest enemy, fires at the nearest enemy when holding the projectile, walks to a dropped projectile) for several seeds, recording waves survived, score, kills per shot, time alive. Use the results to identify overpowered/underpowered heroes (suspects: blackhole stone mage, lightning), whether wave 1-3 is too hard for a casual player, unlock thresholds (300..4000) vs realistic scores, perk balance, and whether combos happen. Recommend concrete number changes and any missing enemy/wave variety (e.g. skeleton mage that throws, archer, boss every 5 waves). Include your measured numbers in evidence.`,
  },
  {
    key: 'ui', label: 'UI & menus',
    prompt: `You are the game UI/UX designer. Review index.html (all screens and CSS), src/ui.js and the screen flow in src/main.js (menu, heroes screen, locations, settings, HUD, perk picker, pause, game over, share, rotate prompt, loading). For iPhone portrait (safe areas, 375-430 pt widths, one thumb), evaluate hierarchy, readability over bright/dark scenes, first-time player onboarding (does a new player understand "one projectile, pick it up"?), feedback on unlocks and records, the share/challenge flow with friends, loading feedback while 3D assets download. Propose the highest-impact changes with concrete markup/CSS/flow edits.`,
  },
  {
    key: 'perf', label: 'iPhone performance',
    prompt: `You are the mobile WebGL performance engineer. Review src/render.js (renderer setup, shadows, bloom/vignette composer with multisampling 4, Water reflections, occluder material clones, per-enemy SkeletonUtils clones and AnimationMixers, adaptive pixel ratio), src/fx.js (particle counts, systems), asset sizes (du on assets/), and loading (what is fetched before the first frame). Estimate the cost on an iPhone (A15-A17, Safari) and propose a concrete performance budget: draw calls, triangles, shadow map size, which effects to keep on "high", what to do on "low", asset preloading/caching (e.g. a service worker for repeat visits), texture/geometry sharing between enemy clones, and memory risks (iOS kills tabs over ~1-1.5 GB). Count things where you can (e.g. meshes per model via a node script reading GLB JSON chunks).`,
  },
]

phase('Research')
const PREVIOUS = (args && args.previous) || []
const TODO = SPECIALISTS.filter((s) => !['github', 'controls'].includes(s.key))
const results = await parallel(TODO.map((s) => () =>
  agent(`${CONTEXT}\n\n${s.prompt}`, { label: s.label, phase: 'Research', schema: REC })
    .then((r) => r && { area: s.label, ...r })))
const got = results.filter(Boolean)
const missing = TODO.filter((s, i) => !results[i]).map((s) => s.label)
if (missing.length) log(`No result from: ${missing.join(', ')}`)

phase('Synthesize')
const plan = await agent(`${CONTEXT}

You are the lead game designer. Seven specialists reviewed the game (JSON below; the first entries come from part 1). Produce ONE prioritized design plan the team can execute, written in RUSSIAN for a non-technical owner, but with technical details kept precise (file names, clip names, numbers) for the implementer.
Structure:
1. "Главное" — 3-5 sentences: what most improves fun and reliability right now.
2. "Готовое с GitHub" — the verdict on adopting an existing third-person controller (adopt / borrow techniques / keep ours) and why.
3. "План по этапам" — 3 stages (Этап 1: быстрые победы, Этап 2: основное, Этап 3: позже). Each item: what, why for the player, how (files/numbers), size S/M/L. Merge duplicates across specialists, resolve conflicts explicitly (say which side you took and why), drop low-impact noise. At most ~18 items total.
4. "Баланс" — the measured numbers from the balance specialist and the concrete number changes.
5. "Риски" — what could break on iPhone and how to guard it.
Do not invent measurements; only use what the specialists report. Specialist reports:
${JSON.stringify([...PREVIOUS, ...got], null, 1)}`, { label: 'Lead designer', phase: 'Synthesize' })

return { plan, reports: got, missing }
