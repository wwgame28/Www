export const meta = {
  name: 'ricochet-shop-rest',
  description: 'Finish the Ricochet shop design: shop UI/UX, then a tech lead turns the drafts into a spec and an implementation plan',
  whenToUse: 'Run from the repo root (/home/user/Www) to continue the shop after the 2026-10-12 drafts',
  phases: [
    { title: 'UI', detail: 'shop screen, try-on, coin reward, Russian copy' },
    { title: 'Lead', detail: 'catalog + economy drafts + UI → spec and plan' },
  ],
}

// How to launch: in a Claude Code session on this repo, ask
//   «Запусти воркфлоу docs/design-review/2026-10-12-shop/workflow-shop-rest.js»
// (the Workflow tool with scriptPath set to this file). It only designs; nothing in the game changes.

const DRAFTS = '/home/user/Www/docs/design-review/2026-10-12-shop'

const CONTEXT = `
GAME: "Рикошет" (Ricochet), a casual 3D arcade web game for iPhone Safari (portrait), hosted on GitHub Pages, played with friends by comparing records (challenge links, daily challenge). Plain ES modules, no build step, three.js r169 + three.quarks (particles) + postprocessing (bloom on the "high" graphics setting). Repo: /home/user/Www (read the CURRENT code).
Core loop: one projectile — throw it (ricochets, weapon-specific paths), then pick it up or catch it in flight (×2 next shot). 7 heroes (src/heroes.js), 7 hand-made locations (src/locations.js). Relevant code: src/render.js (setHero, hand props, tint, projectile, staff gem, trail, showcase camera), src/fx.js (setTrail), src/progress.js (save 'ricochet:v1', migrations), src/main.js (screens, finish()), src/ui.js, index.html (screens + CSS tokens), tests/*.test.mjs.

DECISIONS MADE WITH THE OWNER (do not reopen): cosmetics only (no gameplay effect); exactly 15 items, each works on any hero, default look free: 5 hero skins 600 coins (Золото, Лёд, Тень, Пламя, Призрак), 5 weapon skins 400 (Золото, Лёд, Неон, Кристалл, Лава — the prop in the hand and the projectile; orb mages: orb + staff gem), 5 trails 300 (Огонь, Звёзды, Снежинки, Тьма; Радуга 1000). Coins = score ÷ 10 per run; new record on that location ×2; first daily challenge of the day +20. Full catalog + "Товар дня" (3 items −30 %, change at midnight, same for all friends, seeded by the date). "Магазин" button in the menu; shop screen with the coin balance, the 3D hero in the showcase camera, tabs Товар дня · Герой · Оружие · Следы; tap = try on; "Купить за N" / "Надеть" / "Надето ✓" / greyed "Не хватает N"; trails previewed on the weapon orbiting the hero. Saves in localStorage.
DRAFTS ALREADY MADE (read them first, in ${DRAFTS}): README.md (status and numbers), preview.jpg (5 hero skins + 5 weapon skins prototyped on the Knight — they work and look distinct), cosmetics-prototype.js (CATALOG, SKINS/WEAPONS recipes via one material shader patch, TRAILS presets — trails NOT visually checked yet), economy-bot.mjs + economy-runs.txt (bot runs: median coins per run ~70 / ~170 / ~245 for sloppy / medium / good aim; 2–4.5 min per run; the stone mage scores 3–6× the other heroes — an open balance problem, a per-run coin cap of 1000 before ×2 was considered).
HARD CONSTRAINTS: no real money, payments, ads, accounts, servers or network calls; no new downloaded assets (procedural only); smooth on iPhone Safari; all UI text in Russian.
RULES: the repo is READ-ONLY for you — no edits, commits or pushes. Scratch files go in your session's scratchpad directory. Report unverified things as unverified.`

const UI_SCHEMA = {
  type: 'object',
  properties: {
    screens: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, layout: { type: 'string', description: 'portrait layout top→bottom, sizes in px, safe areas, what the 3D hero shows' }, states: { type: 'string' } }, required: ['name', 'layout', 'states'] } },
    flows: { type: 'array', items: { type: 'string' }, description: 'menu→shop→try-on→buy→equip→back; end-of-run coin reward; what happens to a try-on you did not buy when leaving' },
    copy: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, text: { type: 'string' } }, required: ['key', 'text'] }, description: 'every Russian string the shop needs' },
    htmlSketch: { type: 'string', description: 'markup + CSS for the shop screen and the coin chip/end-of-run reward, matching index.html conventions and CSS tokens' },
    feedback: { type: 'string', description: 'purchase celebration, coin count-up, sounds (existing audio.js events), reduced-motion behaviour' },
    a11y: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: ['screens', 'flows', 'copy', 'htmlSketch', 'feedback', 'a11y', 'evidence'],
}

const LEAD_SCHEMA = {
  type: 'object',
  properties: {
    summaryRu: { type: 'string', description: 'for the non-technical owner, in Russian, 8-15 short lines: what the shop is, the 15 items with prices, how coins work, what changes on screen' },
    specMarkdown: { type: 'string', description: 'the full design spec in English markdown, ready to save as docs/superpowers/specs/2026-10-11-shop-design.md: goals, decisions, catalog table (id, name, category, price, recipe), economy rules, daily deals algorithm, save model + migration, UI screens + flows + copy, render/fx hooks, performance, testing, out of scope' },
    plan: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, files: { type: 'string' }, tests: { type: 'string' } }, required: ['step', 'files', 'tests'] }, description: 'ordered implementation steps, each small and testable' },
    conflicts: { type: 'array', items: { type: 'string' }, description: 'where the three specialists disagreed and what you decided' },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['summaryRu', 'specMarkdown', 'plan', 'conflicts', 'risks'],
}


phase('UI')
const ui = await agent(`${CONTEXT}

YOUR AREA: the SHOP UI/UX. Read index.html (screens, CSS tokens, .btn/.card/.toggle styles, safe-area variables), src/ui.js and src/main.js (how screens switch with show(), how the heroes screen uses the showcase camera and prev/next buttons). Design: the "Магазин" entry and the coin chip in the menu; the shop screen (portrait iPhone 14 and SE: the 3D hero visible above a bottom sheet with tabs and item cards); card states (free default, owned, equipped, affordable, not enough coins, daily deal with old/new price); try-on (tap = preview; leaving restores the equipped look); buy confirmation or why none is needed; the end-of-run reward on the game-over screen (count-up «+48 🪙», badges for record ×2 and daily +20); feedback (existing src/audio.js sounds, a small celebration, reduced motion); accessibility (tap targets ≥ 44 px, contrast, labels). Give every Russian string and an HTML+CSS sketch following the existing markup. Return per the schema.`, { label: 'shop UI/UX', phase: 'UI', schema: UI_SCHEMA })

phase('Lead')
const lead = await agent(`${CONTEXT}

YOU ARE THE TECH LEAD. Merge the drafts in ${DRAFTS} (catalog prototype + economy numbers) and the UI design below into ONE consistent design and implementation plan. Read the relevant code in /home/user/Www to make sure the plan fits it. Decide the open points and say why: the stone-mage outlier vs the coin rules, the trail recipes (they were never checked on screen — say how the plan verifies them), how the prototype's shader patch is moved into the game without a new shader per frame. Keep exactly 15 items (5/5/5). Keep the shop logic in a small pure module (src/shop.js: catalog, prices, deals for a date, coins for a run, buy/equip) unit-tested with node --test, separate from rendering. The plan must be ordered, each step small, with the tests that prove it (unit tests + a headless iPhone Chromium check of the shop screen and of a run with a skin, weapon skin and trail equipped).

SHOP UI/UX DESIGN:
${JSON.stringify(ui, null, 1)}

Return per the schema. specMarkdown must be complete (no TBDs).`, { label: 'tech lead', phase: 'Lead', schema: LEAD_SCHEMA })

return { lead, ui }
