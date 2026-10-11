import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame, step, result, choosePerk } from './game.js';
import { getPerk, PERKS } from './perks.js';
import { LOCATIONS, getLocation, layoutFor } from './locations.js';
import { WEAPONS, getWeapon, previewPath } from './weapons.js';
import { createRng, todayKey } from './rng.js';
import { challengeFromHash, challengeUrl } from './share.js';
import * as progress from './progress.js';
import { $, show, toast, renderWeapons, renderLocations, popup, banner, aimAt } from './ui.js';

const STEP = 1 / 60;
const data = progress.load();
const audio = createAudio();
const canvas = $('game');
const stickCenter = () => {
  const r = $('stick').getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};
const input = createInput(canvas, stickCenter);
document.body.classList.toggle('stick-right', !!data.settings.stickRight);
const view = createRenderer(canvas, { quality: data.settings.quality });
audio.setMuted(!data.settings.sound);

let mode = 'menu';           // menu | playing | choosing | paused | over
let game = null;
let run = null;              // { kind: 'free'|'daily'|'challenge', seed, date, locationId, weaponId }
let challenge = challengeFromHash(location.hash);
let sceneKey = '';           // which location+weapon is currently built
let overTimer = 0;
let hintShown = false;

const daily = (date) => {
  const rng = createRng(`daily:${date}`);
  return { locationId: rng.pick(LOCATIONS).id, weaponId: rng.pick(WEAPONS).id };
};

async function buildScene(locationId, weaponId) {
  const key = `${locationId}/${weaponId}`;
  if (key === sceneKey) return;
  $('loadingText').textContent = `Загрузка: ${getLocation(locationId).name}…`;
  show('loading');
  const loc = getLocation(locationId);
  await view.setLocation(loc, layoutFor(loc), getWeapon(weaponId));
  sceneKey = key;
}

// ---------- menu ----------
function refreshMenu() {
  const w = getWeapon(data.weapon), l = getLocation(data.location);
  $('menuWeapon').textContent = w.name;
  $('menuWeaponPic').src = `assets/ui/${w.model}.png`;
  $('menuLocation').textContent = l.name;
  $('menuBest').textContent = data.best[l.id] || 0;
  const today = todayKey();
  const d = daily(today);
  $('dailySub').textContent = `${getLocation(d.locationId).name} · ${getWeapon(d.weaponId).name}${data.daily[today] ? ` · 🏆 ${data.daily[today]}` : ''}`;
  const box = $('challenge');
  if (challenge) {
    $('challengeText').innerHTML = `Друг набрал <b>${challenge.score}</b> (комбо ×${challenge.combo}, волна ${challenge.wave}) — ${getLocation(challenge.location).name}, ${getWeapon(challenge.weapon).name}. Побьёшь?`;
    box.classList.add('on');
  } else box.classList.remove('on');
}

async function toMenu() {
  mode = 'menu';
  input.setEnabled(false);
  await buildScene(data.location, data.weapon);
  view.clearRun();
  view.setMenu(true);
  refreshMenu();
  show('menu');
}

// ---------- run ----------
async function start(kind) {
  audio.unlock();
  if (kind === 'free') {
    run = { kind, seed: `free:${Date.now()}`, locationId: data.location, weaponId: data.weapon };
  } else if (kind === 'daily') {
    const date = todayKey();
    run = { kind, date, seed: `daily:${date}`, ...daily(date) };
  } else {
    run = { kind, date: challenge.date, seed: `daily:${challenge.date}`, locationId: challenge.location, weaponId: challenge.weapon };
  }
  await buildScene(run.locationId, run.weaponId);
  game = createGame({ seed: run.seed, locationId: run.locationId, weaponId: run.weaponId });
  view.clearRun();
  view.setMenu(false);
  view.resize();
  $('score').textContent = '0';
  $('wave').textContent = 'Волна 1';
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
  progress.save(data);
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

async function share() {
  const r = result(game);
  const url = challengeUrl(location.href, { date: run.date || todayKey(), location: r.location, weapon: r.weapon, score: r.score, combo: r.combo, wave: r.wave });
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
  audio.play(ev);
  view.effect(ev);
  if (ev.type === 'kill') {
    const s = view.worldToScreen(ev.x, 1.2, ev.z);
    popup(s.x, s.y, ev.combo > 1 ? `+${ev.points} ×${ev.combo}` : `+${ev.points}`, ev.combo > 1 ? 'combo' : '');
  } else if (ev.type === 'wave') {
    $('wave').textContent = `Волна ${ev.wave}`;
    banner(`Волна ${ev.wave}`);
  } else if (ev.type === 'waveClear') {
    banner(`+${ev.bonus}`);
  } else if (ev.type === 'catch') {
    const s = view.worldToScreen(ev.x, 1.4, ev.z);
    popup(s.x, s.y, 'Поймал! ×2', 'combo');
  } else if (ev.type === 'shoot' && !hintShown) {
    hintShown = true;
    $('hint').style.opacity = 0;
  } else if (ev.type === 'death') {
    overTimer = 1.1;
  } else if (ev.type === 'perkChoice') {
    mode = 'choosing';
    input.setEnabled(false);
    view.setAim(null);
    setTimeout(() => showPerks(ev.options), 650); // let the wave-clear banner play first
  } else if (ev.type === 'shield') {
    const s = view.worldToScreen(ev.x, 1.2, ev.z);
    popup(s.x, s.y, 'Щит!', 'combo');
    renderPerkRow();
  }
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
    arrow.style.top = `${cy + Math.sin(a) * k - 11}px`;
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

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  if (mode === 'playing' && game) {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      let fire = null;
      const tap = input.takeFire();
      if (tap) { fire = view.screenToGround(tap.x, tap.y); aimAt(tap.x, tap.y); }
      step(game, STEP, { move: input.move(), fire });
      for (const ev of game.events) handle(ev);
      game.events.length = 0;
    }
    // Aim line: the real trajectory toward the held finger.
    const aim = game.projectile.state === 'held' && !game.over ? input.aim() : null;
    const target = aim && view.screenToGround(aim.x, aim.y);
    view.setAim(target ? previewPath(game.weapon.id, game.hero, target, { arena: game.arena, solids: game.solids, rule: game.loc.rule }, game.mods) : null);
    updateHud();
  }
  if (game && mode !== 'menu') view.sync(game, mode === 'paused' ? 0 : dt);
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
    if (to === 'arsenal') renderWeapons(data, pickWeapon);
    if (to === 'locations') renderLocations(data, pickLocation);
    if (to === 'menu') { toMenu(); return; }
    show(to);
  });
}
function pickWeapon(id) { data.weapon = id; progress.save(data); renderWeapons(data, pickWeapon); toast(`Выбрано: ${getWeapon(id).name}`); }
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
toggle('stickToggle', !!data.settings.stickRight, (v) => { data.settings.stickRight = v; document.body.classList.toggle('stick-right', v); });
toggle('qualityToggle', data.settings.quality === 'high', (v) => { data.settings.quality = v ? 'high' : 'low'; toast('Применится после перезапуска'); });

addEventListener('resize', () => view.resize());
addEventListener('hashchange', () => { challenge = challengeFromHash(location.hash); if (mode === 'menu') refreshMenu(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); audio.suspend(); } else { audio.resume(); last = performance.now(); }
});

view.resize();
requestAnimationFrame(frame);
// Read-only handle for automated browser checks.
Object.defineProperty(window, '__ricochet', { value: { get game() { return game; } } });
toMenu().catch((e) => {
  console.error(e);
  $('loadingText').textContent = 'Не удалось загрузить игру. Обновите страницу.';
});
