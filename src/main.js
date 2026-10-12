import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame, step, result, choosePerk } from './game.js';
import { getPerk, PERKS } from './perks.js';
import { LOCATIONS, getLocation, layoutFor } from './locations.js';
import { previewPath } from './weapons.js';
import { pickTarget } from './aim.js';
import { HEROES, getHero } from './heroes.js';
import { createRng, todayKey } from './rng.js';
import { challengeFromHash, challengeUrl } from './share.js';
import * as progress from './progress.js';
import * as shop from './shop.js';
import { $, show, toast, renderHero, renderLocations, popup, banner, aimAt } from './ui.js';

const STEP = 1 / 60;
const data = progress.load();
const audio = createAudio();
const canvas = $('game');
const centerOf = (id) => () => {
  const r = $(id).getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};
const viewMode = () => (data.settings.view === 'top' ? 'top' : 'tps'); // third person by default
const input = createInput(canvas, { stickCenter: centerOf('stick'), fireCenter: centerOf('fireBtn'), recallCenter: centerOf('recallBtn'), mode: viewMode });
document.body.classList.toggle('stick-right', !!data.settings.stickRight);
document.body.classList.toggle('tps', viewMode() === 'tps');
const view = createRenderer(canvas, { quality: data.settings.quality });
view.presetGear(data.look); // cosmetics bought in the shop
view.setView(viewMode());
let yaw = 0; // third-person camera heading (0 looks toward −z, where most enemies come from)
const AIM_DIST = 8;
const EDGE_TURN = 2.5;    // rad/s while a turning finger rests at the screen edge
const FIRE_BUFFER = 0.2;  // a press up to 0.2 s before the projectile is back still fires
const forward = () => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
const aheadOfHero = () => { const f = forward(); return { x: game.hero.x + f.x * AIM_DIST, z: game.hero.z + f.z * AIM_DIST }; };
// Stick (screen right/down) → world direction: relative to the camera in third person.
function moveVector() {
  const m = input.move();
  if (viewMode() !== 'tps') return m;
  const f = forward(), r = { x: -f.z, z: f.x };
  return { x: r.x * m.x - f.x * m.z, z: r.z * m.x - f.z * m.z };
}
audio.setMuted(!data.settings.sound);

let mode = 'menu';           // menu | playing | choosing | paused | over
let game = null;
let run = null;              // { kind: 'free'|'daily'|'challenge', seed, date, locationId, heroId }
let challenge = challengeFromHash(location.hash);
let sceneKey = '';           // which location is currently built
let heroKey = '';            // which hero model is currently loaded
let browse = 0;              // hero index shown on the heroes screen
let overTimer = 0;
let hintShown = false;
let queued = null;         // fire press waiting for the projectile to come back: { tap, t }
let lock = null;           // enemy the third-person crosshair has locked (setting «Автоприцел»)
let cross = null;          // smoothed crosshair position on screen
let shot = { kills: 0, points: 0 }; // this shot's kills, for the combo total when it ends
let killSound = 0;         // several kills in one step play one sound, at the highest combo
let lastKill = 0;

// Hit-stop and slow motion in real seconds: segments { k: time factor, t: duration } played in order.
const timeFx = [];
function warp(dt) {
  while (timeFx.length && timeFx[0].t <= 0) timeFx.shift();
  if (!timeFx.length) return 1;
  timeFx[0].t -= dt;
  return timeFx[0].k;
}
const freeze = (t) => { if (timeFx[0]?.k === 0) timeFx[0].t += t; else timeFx.unshift({ k: 0, t }); };
const slowMo = (k, t) => timeFx.push({ k, t });

// Third person: the locked enemy, else straight ahead.
const shotTarget = () => (lock ? { x: lock.x, z: lock.z } : aheadOfHero());
function updateLock() {
  lock = viewMode() === 'tps' && data.settings.aimAssist !== false && !game.over
    ? pickTarget(game.hero, forward(), game.enemies, game.solids, lock?.id, (e) => view.worldToScreen(e.x, 0.8, e.z).inside)
    : null;
}

const daily = (date) => {
  const rng = createRng(`daily:${date}`);
  return { locationId: rng.pick(LOCATIONS).id, heroId: rng.pick(HEROES).id };
};

async function buildScene(locationId, heroId) {
  if (locationId !== sceneKey) {
    $('loadingText').textContent = `Загрузка: ${getLocation(locationId).name}…`;
    show('loading');
    const loc = getLocation(locationId);
    await view.setLocation(loc, layoutFor(loc));
    sceneKey = locationId;
  }
  await showHero(heroId);
}

async function showHero(heroId) {
  if (heroId === heroKey) return;
  heroKey = heroId;
  await view.setHero(getHero(heroId));
}

// ---------- menu ----------
function refreshMenu() {
  const h = getHero(data.hero), l = getLocation(data.location);
  $('menuHero').textContent = h.name;
  $('menuLocation').textContent = l.name;
  $('menuBest').textContent = data.best[l.id] || 0;
  $('menuCoins').textContent = data.coins;
  const today = todayKey();
  const d = daily(today);
  $('dailySub').textContent = `${getLocation(d.locationId).name} · ${getHero(d.heroId).name}${data.daily[today] ? ` · 🏆 ${data.daily[today]}` : ''}`;
  const box = $('challenge');
  if (challenge) {
    $('challengeText').innerHTML = `Друг набрал <b>${challenge.score}</b> (комбо ×${challenge.combo}, волна ${challenge.wave}) — ${getLocation(challenge.location).name}, ${getHero(challenge.weapon).name}. Побьёшь?`;
    box.classList.add('on');
  } else box.classList.remove('on');
}

async function toMenu() {
  mode = 'menu';
  input.setEnabled(false);
  await buildScene(data.location, data.hero);
  await view.setGear(data.look, false); // back from the shop: take off whatever was only tried on
  view.clearRun();
  view.setMenu('menu');
  refreshMenu();
  show('menu');
}

// ---------- run ----------
async function start(kind) {
  audio.unlock();
  screen.orientation?.lock?.('portrait').catch(() => {}); // Android / installed apps; iOS rejects it
  if (kind === 'free') {
    run = { kind, seed: `free:${Date.now()}`, locationId: data.location, heroId: data.hero };
  } else if (kind === 'daily') {
    const date = todayKey();
    run = { kind, date, seed: `daily:${date}`, ...daily(date) };
  } else {
    run = { kind, date: challenge.date, seed: `daily:${challenge.date}`, locationId: challenge.location, heroId: getHero(challenge.weapon).id };
  }
  await buildScene(run.locationId, run.heroId);
  game = createGame({ seed: run.seed, locationId: run.locationId, weaponId: getHero(run.heroId).weapon, heroId: run.heroId });
  view.clearRun();
  view.setMenu(false);
  view.resize();
  audio.setVoice(getHero(run.heroId).proj.orb ? 'zap' : 'whoosh');
  timeFx.length = 0; queued = null; lock = null; cross = null; shot = { kills: 0, points: 0 };
  $('score').textContent = '0';
  $('wave').textContent = 'Волна 1';
  yaw = 0;
  updateHint();
  $('hint').style.opacity = hintShown ? 0 : 1;
  $('pops').innerHTML = '';
  renderPerkRow();
  show('hud');
  input.setEnabled(true);
  mode = 'playing';
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  input.setEnabled(false);
  show('pause');
}

function resume() {
  mode = 'playing';
  input.setEnabled(true);
  show('hud');
}

function finish() {
  mode = 'over';
  input.setEnabled(false);
  const r = result(game);
  const dailyKey = run.kind === 'free' ? null : run.date;
  const rec = progress.record(data, r, dailyKey);
  const firstDaily = run.kind === 'daily' && data.dailyBonus !== run.date;
  if (firstDaily) data.dailyBonus = run.date;
  const coins = shop.coinsFor(r.score, { record: rec.newBest, daily: firstDaily });
  data.coins += coins.total;
  progress.save(data);
  showCoins(coins);
  $('overScore').textContent = r.score;
  $('overCombo').textContent = `×${r.combo}`;
  $('overWave').textContent = r.wave;
  $('overRecord').classList.toggle('on', rec.newBest || rec.newDaily);
  $('overTitle').textContent = run.kind === 'free' ? 'Забег окончен' : `Вызов ${run.date}`;
  const vs = $('vs');
  if (run.kind === 'challenge') {
    const diff = r.score - challenge.score;
    vs.textContent = diff > 0 ? `Ты победил друга на ${diff}! 🎉` : diff === 0 ? 'Ничья!' : `Не хватило ${-diff} очков`;
    vs.classList.add('on');
  } else vs.classList.remove('on');
  show('over');
}

// End of a run: the coins count up, with badges for the bonuses.
function showCoins(c) {
  const el = $('overCoins');
  if (!c.total) { el.innerHTML = ''; return; }
  const badges = `${c.record ? '<span class="badge">рекорд ×2</span>' : ''}${c.daily ? `<span class="badge">вызов дня +${shop.DAILY_BONUS}</span>` : ''}`;
  const paint = (n) => { el.innerHTML = `+${n} 🪙${badges}`; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(c.total); return; }
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / 700); paint(Math.round(c.total * k * (2 - k))); if (k < 1) requestAnimationFrame(tick); };
  paint(0);
  requestAnimationFrame(tick);
}

async function share() {
  const r = result(game);
  const url = challengeUrl(location.href, { date: run.date || todayKey(), location: r.location, weapon: r.hero, score: r.score, combo: r.combo, wave: r.wave });
  const text = `Рикошет: ${r.score} очков, комбо ×${r.combo}, волна ${r.wave}. Побей мой рекорд!`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Рикошет', text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Ссылка скопирована');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Не удалось поделиться');
  }
}

// ---------- events from the simulation ----------
function handle(ev) {
  if (ev.type !== 'kill') audio.play(ev);
  view.effect(ev);
  if (ev.type === 'kill') {
    const s = view.worldToScreen(ev.x, 1.2, ev.z);
    const cls = ev.combo >= 5 ? 'combo c5' : ev.combo >= 3 ? 'combo c3' : ev.combo > 1 ? 'combo' : '';
    popup(s.x, s.y, ev.combo > 1 ? `+${ev.points} ×${ev.combo}` : `+${ev.points}`, cls);
    if (ev.tricks?.length) popup(s.x, s.y - 34, ev.tricks.join(' · '), 'trick');
    killSound = Math.max(killSound, ev.combo);
    shot.kills++; shot.points += ev.points;
    const now = performance.now();
    freeze(now - lastKill < 250 ? 0.025 : 0.045); // hit-stop; shorter inside a fast chain
    lastKill = now;
    if (ev.combo === 4) slowMo(0.5, 0.3);
  } else if (ev.type === 'explode') {
    freeze(0.08);
  } else if (ev.type === 'wave') {
    $('wave').textContent = `Волна ${ev.wave}`;
    banner(`Волна ${ev.wave}`);
    hintOnce('zone', 'Убивай в золотом круге — очки ×3');
  } else if (ev.type === 'waveClear') {
    banner(`+${ev.bonus}`);
    slowMo(0.3, 0.45); // the last kill of a wave plays in slow motion
  } else if (ev.type === 'catch') {
    const s = view.worldToScreen(ev.x, 1.4, ev.z);
    popup(s.x, s.y, 'Поймал! ×2', 'combo');
  } else if (ev.type === 'shoot') {
    shot = { kills: 0, points: 0 };
    if (!hintShown) { hintShown = true; $('hint').style.opacity = 0; }
  } else if (ev.type === 'death') {
    overTimer = 1.4; // real seconds: a short freeze, then the fall in slow motion
    timeFx.length = 0;
    timeFx.push({ k: 0, t: 0.15 }, { k: 0.35, t: 0.6 });
  } else if (ev.type === 'perkChoice') {
    mode = 'choosing';
    input.setEnabled(false, { keepStick: true });
    view.setAim(null);
    setTimeout(() => showPerks(ev.options), 900); // let the slow-motion last kill and the banner play first
  } else if (ev.type === 'shield') {
    const s = view.worldToScreen(ev.x, 1.2, ev.z);
    popup(s.x, s.y, 'Щит!', 'combo');
    renderPerkRow();
    freeze(0.09);
  }
}

// When a shot ends with 2+ kills, show its total over the hero.
function endShot() {
  if (shot.kills >= 2) {
    const s = view.worldToScreen(game.hero.x, 2.2, game.hero.z);
    popup(s.x, s.y, `Комбо ×${shot.kills} · +${shot.points}`, 'total');
  }
  shot = { kills: 0, points: 0 };
}

function updateHud() {
  $('score').textContent = game.score;
  $('mult').classList.toggle('on', game.pendingMult > 1);
  const p = game.projectile, ammo = $('ammo');
  const held = p.state === 'held';
  ammo.textContent = held ? '● В руке' : p.state === 'dropped' ? '○ Подбери пулю!' : '➶ В полёте';
  ammo.classList.toggle('empty', p.state === 'dropped');
  // Off-screen pointer to the dropped projectile.
  const arrow = $('arrow');
  const s = view.worldToScreen(p.x, 0.3, p.z);
  if (p.state === 'dropped' && !s.inside) {
    const w = innerWidth, h = innerHeight, cx = w / 2, cy = h / 2;
    const a = Math.atan2(s.y - cy, s.x - cx);
    const m = 36;
    const k = Math.min((w / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (h / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
    arrow.style.display = 'block';
    arrow.style.left = `${cx + Math.cos(a) * k - 12}px`;
    arrow.style.top = `${Math.min(innerHeight - 260, cy + Math.sin(a) * k) - 11}px`; // above the stick and fire button
    arrow.style.transform = `rotate(${a + Math.PI / 2}rad)`;
  } else arrow.style.display = 'none';
  // Fixed joystick: only the knob moves, clamped to the ring.
  const st = input.stick(), el = $('stick');
  let kx = 0, ky = 0;
  if (st) {
    kx = st.x - st.x0; ky = st.y - st.y0;
    const l = Math.hypot(kx, ky);
    if (l > 60) { kx *= 60 / l; ky *= 60 / l; }
  }
  el.classList.toggle('active', !!st);
  $('fireBtn').classList.toggle('active', input.firing());
  $('fireBtn').classList.toggle('cancel', input.cancelling());
  // ↩: the fire button in third person, its own button in the top-down view.
  const ready = recallReady(), tps = viewMode() === 'tps';
  $('fireBtn').classList.toggle('recall', ready && tps);
  $('recallBtn').classList.toggle('on', ready && !tps);
  if (ready) hintOnce('recall', tps ? 'Нажми ↩ — оружие само вернётся в руку' : 'Нажми ↩ внизу — оружие само вернётся в руку');
  $('fireBtn').classList.toggle('empty', game.projectile.state !== 'held' && !ready);
  el.firstElementChild.style.transform = `translate(${kx}px, ${ky}px)`;
}

// ---------- perks ----------
function showPerks(options) {
  if (mode !== 'choosing') return;
  const list = $('perkList');
  list.innerHTML = '';
  for (const id of options) {
    const p = getPerk(id), lvl = game.mods[id];
    const b = document.createElement('button');
    b.className = 'perk';
    b.innerHTML = `<span class="ico">${p.icon}</span><span><h3>${p.name}</h3><p>${p.desc}</p></span><span class="lvl">${lvl ? `${lvl}→${lvl + 1}` : 'новое'}</span>`;
    b.addEventListener('click', () => {
      if (!choosePerk(game, id)) return;
      audio.play({ type: 'catch' });
      renderPerkRow();
      mode = 'playing';
      input.setEnabled(true);
      last = performance.now();
      show('hud');
    }, { once: true });
    list.append(b);
  }
  show('perks');
}

function renderPerkRow() {
  $('perkRow').innerHTML = PERKS.filter((p) => game?.mods[p.id]).map((p) => `<span>${p.icon}${game.mods[p.id] > 1 ? game.mods[p.id] : ''}</span>`).join('');
}

const recallReady = () => game.projectile.state === 'dropped' && game.recallT === 0 && !game.over;
// One-time tips for new mechanics (remembered in the save).
function hintOnce(key, text) {
  data.settings.hints ||= {};
  if (data.settings.hints[key]) return;
  data.settings.hints[key] = true;
  progress.save(data);
  toast(text);
}

// Third person: the crosshair sits where a shot straight ahead is aimed, or on the locked enemy.
function placeCrosshair(dt) {
  const t = lock || aheadOfHero(), s = view.worldToScreen(t.x, lock ? 0.8 : 0.6, t.z), el = $('crosshair');
  if (!cross) cross = { x: s.x, y: s.y };
  const k = 1 - Math.exp(-25 * dt);
  cross.x += (s.x - cross.x) * k; cross.y += (s.y - cross.y) * k;
  el.style.left = `${cross.x}px`; el.style.top = `${cross.y}px`;
  el.classList.toggle('ready', game.projectile.state === 'held');
  el.classList.toggle('lock', !!lock);
}

function updateHint() {
  $('hint').textContent = viewMode() === 'tps'
    ? 'Джойстик — бежать. Веди по экрану — поворот. Кнопка — выстрел (зажми — прицел, потяни вниз — отмена).'
    : 'Джойстик — бежать. Зажми палец — прицел, отпусти — выстрел.';
}

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  const k = mode === 'paused' ? 0 : warp(dt); // hit-stop / slow motion
  if (mode === 'playing' && game) {
    acc += dt * k;
    while (acc >= STEP) {
      acc -= STEP;
      const tap = input.takeFire();
      let recallNow = input.takeRecall();
      // In third person the fire button doubles as ↩ while the projectile lies on the ground.
      if (tap?.forward && recallReady()) recallNow = true;
      else if (tap) queued = { tap, t: FIRE_BUFFER };
      let fire = null;
      if (queued && game.projectile.state === 'held') {
        const q = queued.tap;
        queued = null;
        if (q.forward) fire = shotTarget();
        else { fire = view.screenToGround(q.x, q.y); aimAt(q.x, q.y); }
      } else if (queued && (queued.t -= STEP) <= 0) queued = null;
      const wasFlying = game.projectile.state === 'flying';
      step(game, STEP, { move: moveVector(), fire, recall: recallNow });
      for (const ev of game.events) handle(ev);
      game.events.length = 0;
      if (killSound) { audio.play({ type: 'kill', combo: killSound }); killSound = 0; }
      if (wasFlying && game.projectile.state !== 'flying') endShot();
      if (timeFx[0]?.k === 0) { acc = 0; break; } // a hit-stop just started: freeze on this frame
    }
    yaw -= input.takeLook() + input.edgeTurn() * EDGE_TURN * dt;
    updateLock();
    // Aim line: the real trajectory toward the held finger (or the crosshair target in third person).
    const aim = game.projectile.state === 'held' && !game.over ? input.aim() : null;
    const target = aim && (aim.forward ? shotTarget() : view.screenToGround(aim.x, aim.y));
    view.setAim(target ? previewPath(game.weapon.id, game.hero, target, { arena: game.arena, solids: game.solids, rule: game.loc.rule }, game.mods) : null);
    updateHud();
  }
  if (game && mode !== 'menu') view.sync(game, dt * k, { yaw });
  if (game && mode === 'playing' && viewMode() === 'tps') placeCrosshair(dt);
  if (mode === 'playing' && game?.over) {
    overTimer -= dt;
    if (overTimer <= 0) finish();
  }
  view.render(mode === 'paused' ? 0 : dt);
}

// ---------- wiring ----------
for (const b of document.querySelectorAll('[data-go]')) {
  b.addEventListener('click', () => {
    audio.unlock(); audio.play({ type: 'click' });
    const to = b.dataset.go;
    if (to === 'heroes') { openHeroes(); return; }
    if (to === 'shop') { openShop(); return; }
    if (to === 'locations') renderLocations(data, pickLocation);
    if (to === 'menu') { toMenu(); return; }
    show(to);
  });
}
// Heroes screen: the camera closes in on the hero; arrows flip through heroes live in 3D.
function openHeroes() {
  browse = Math.max(0, HEROES.findIndex((h) => h.id === data.hero));
  view.setMenu('showcase');
  showBrowsed();
  show('heroes');
}
function showBrowsed() {
  const h = HEROES[browse];
  renderHero(data, h, browse, HEROES.length);
  showHero(h.id);
}
$('heroPrev').addEventListener('click', () => { browse = (browse + HEROES.length - 1) % HEROES.length; audio.play({ type: 'click' }); showBrowsed(); });
$('heroNext').addEventListener('click', () => { browse = (browse + 1) % HEROES.length; audio.play({ type: 'click' }); showBrowsed(); });
$('heroPick').addEventListener('click', () => {
  const h = HEROES[browse];
  if (!progress.heroUnlocked(data, h)) { toast(`Наберите ${h.unlock} очков, чтобы открыть`); return; }
  data.hero = h.id; progress.save(data);
  audio.play({ type: 'catch' });
  toast(`${h.name} готов к бою`);
  toMenu();
});
// ---------- shop ----------
// Tabs: today's deals or one category. Tapping an item tries it on the hero (trails circle the hero);
// the big button buys (and puts on) or puts on an owned item. Leaving restores what is worn.
let shopTab = 'deals';
let shopSel = null; // { cat, id }; id null is the free default look
function openShop() {
  shopTab = 'deals';
  shopSel = null;
  view.setMenu('shop');
  renderShop();
  show('shop');
}
function shopItems() {
  if (shopTab === 'deals') return shop.dealsFor(todayKey()).map((id) => ({ cat: shop.getItem(id).cat, id }));
  return [{ cat: shopTab, id: null }, ...shop.CATALOG.filter((i) => i.cat === shopTab).map((i) => ({ cat: i.cat, id: i.id }))];
}
function renderShop() {
  const today = todayKey(), deals = shop.dealsFor(today), off = `−${Math.round(shop.DEAL_OFF * 100)}%`;
  $('shopCoins').textContent = data.coins;
  for (const t of document.querySelectorAll('#shop .tab')) {
    const on = t.dataset.tab === shopTab;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  }
  const grid = $('shopGrid');
  grid.innerHTML = '';
  for (const s of shopItems()) {
    const it = shop.getItem(s.id), owned = shop.owns(data, s.id), worn = data.look[s.cat] === s.id;
    const deal = !!it && deals.includes(s.id), price = it ? shop.priceOf(s.id, today) : 0;
    const b = document.createElement('button');
    b.className = `shop-item${owned ? ' owned' : ''}${shopSel?.cat === s.cat && shopSel?.id === s.id ? ' sel' : ''}`;
    b.innerHTML = `<span class="sw" style="background:${it ? it.swatch : 'rgba(255,255,255,.15)'}"></span><b>${it ? it.name : 'Обычный'}</b>`
      + `<small>${owned ? (worn ? 'надето' : 'есть') : `${deal ? `<s>${it.price}</s>` : ''}🪙 ${price}`}</small>`
      + `${worn ? '<span class="tick">✓</span>' : ''}${deal && !owned ? `<span class="tag">${off}</span>` : ''}`;
    b.setAttribute('aria-label', `${it ? it.name : 'Обычный'}, ${owned ? (worn ? 'надето' : 'куплено') : `${price} монет`}`);
    b.addEventListener('click', () => {
      shopSel = s;
      audio.play({ type: 'click' });
      view.setGear({ ...data.look, [s.cat]: s.id }, s.cat === 'trail'); // try it on
      renderShop();
    });
    grid.append(b);
  }
  const btn = $('shopAction'), info = $('shopInfo');
  if (!shopSel) {
    btn.textContent = 'Выбери вещь';
    btn.disabled = true;
    info.textContent = shopTab === 'deals' ? `Скидка ${Math.round(shop.DEAL_OFF * 100)}% — до полуночи` : 'Нажми на вещь, чтобы примерить';
    return;
  }
  const it = shop.getItem(shopSel.id);
  info.textContent = it ? it.blurb : 'Как было с самого начала';
  if (!shop.owns(data, shopSel.id)) {
    const price = shop.priceOf(shopSel.id, today);
    btn.disabled = data.coins < price;
    btn.textContent = data.coins < price ? `Не хватает ${price - data.coins} 🪙` : `Купить за ${price} 🪙`;
  } else if (data.look[shopSel.cat] === shopSel.id) {
    btn.disabled = true;
    btn.textContent = 'Надето ✓';
  } else {
    btn.disabled = false;
    btn.textContent = 'Надеть';
  }
}
$('shopAction').addEventListener('click', () => {
  if (!shopSel) return;
  if (!shop.owns(data, shopSel.id)) {
    if (!shop.buy(data, shopSel.id, todayKey()).ok) return;
    audio.play({ type: 'waveClear' });
    toast(`Куплено: ${shop.getItem(shopSel.id).name}`);
  } else {
    shop.equip(data, shopSel.cat, shopSel.id);
    audio.play({ type: 'catch' });
  }
  progress.save(data);
  renderShop();
});
for (const t of document.querySelectorAll('#shop .tab')) {
  t.addEventListener('click', () => {
    shopTab = t.dataset.tab;
    shopSel = null;
    audio.play({ type: 'click' });
    view.setGear(data.look, false);
    renderShop();
  });
}

function pickLocation(id) { data.location = id; progress.save(data); renderLocations(data, pickLocation); toast(`Локация: ${getLocation(id).name}`); }

$('playBtn').addEventListener('click', () => start('free'));
$('dailyBtn').addEventListener('click', () => start('daily'));
$('challengeBtn').addEventListener('click', () => start('challenge'));
$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); pause(); });
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => start(run.kind));
$('quitBtn').addEventListener('click', toMenu);
$('againBtn').addEventListener('click', () => start(run.kind));
$('menuBtn').addEventListener('click', toMenu);
$('shareBtn').addEventListener('click', share);

const toggle = (id, on, onChange) => {
  const el = $(id);
  el.classList.toggle('on', on);
  el.addEventListener('click', () => { const v = !el.classList.contains('on'); el.classList.toggle('on', v); onChange(v); progress.save(data); });
};
toggle('soundToggle', data.settings.sound, (v) => { data.settings.sound = v; audio.setMuted(!v); });
toggle('viewToggle', viewMode() === 'tps', (v) => { data.settings.view = v ? 'tps' : 'top'; document.body.classList.toggle('tps', v); view.setView(viewMode()); updateHint(); });
toggle('aimToggle', data.settings.aimAssist !== false, (v) => { data.settings.aimAssist = v; });
toggle('stickToggle', !!data.settings.stickRight, (v) => { data.settings.stickRight = v; document.body.classList.toggle('stick-right', v); });
toggle('qualityToggle', data.settings.quality === 'high', (v) => { data.settings.quality = v ? 'high' : 'low'; toast('Применится после перезапуска'); });

addEventListener('resize', () => view.resize());
addEventListener('hashchange', () => { challenge = challengeFromHash(location.hash); if (mode === 'menu') refreshMenu(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); audio.suspend(); } else { audio.resume(); last = performance.now(); }
});
// Portrait only: turning the phone sideways shows the #rotate prompt (CSS) and pauses the run.
const landscape = matchMedia('(orientation: landscape) and (max-height: 520px)');
landscape.addEventListener('change', (e) => { if (e.matches) pause(); });

view.resize();
requestAnimationFrame(frame);
// Read-only handle for automated browser checks.
Object.defineProperty(window, '__ricochet', { value: { get game() { return game; }, get yaw() { return yaw; } } });
toMenu().catch((e) => {
  console.error(e);
  $('loadingText').textContent = 'Не удалось загрузить игру. Обновите страницу.';
});
