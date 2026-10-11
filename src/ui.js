import { WEAPONS, launch, stepProjectile } from './weapons.js';
import { LOCATIONS, ARENA } from './locations.js';
import { weaponUnlocked, locationUnlocked } from './progress.js';

export const $ = (id) => document.getElementById(id);

const RULES = {
  forest: 'Деревья и камни отражают пулю',
  cave: 'Темно — свет только вокруг тебя',
  winter: 'Лёд: скользишь, пуля катится',
  river: 'Река замедляет всех',
};

export function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
}

let toastT = 0;
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

// Draw the weapon's real trajectory (from the simulation) as a small preview.
function drawTrajectory(canvas, weaponId) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 54 * dpr; canvas.height = 72 * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  const sx = 54 / (ARENA.W * 2), sz = 72 / (ARENA.D * 2);
  const P = (x, z) => [(x + ARENA.W) * sx, (z + ARENA.D) * sz];
  c.fillStyle = 'rgba(255,255,255,.06)';
  c.fillRect(0, 0, 54, 72);
  const hero = { x: 0, z: 5 };
  const world = { arena: ARENA, solids: [], enemies: [], hero, rule: {} };
  const p = launch(weaponId, hero, { x: 1.5, z: -6 });
  c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(...P(p.x, p.z));
  for (let i = 0; i < 400 && p.state === 'flying'; i++) { stepProjectile(p, 1 / 60, world); c.lineTo(...P(p.x, p.z)); }
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(...P(hero.x, hero.z), 3, 0, Math.PI * 2); c.fill();
}

export function renderWeapons(data, onPick) {
  const list = $('weaponList');
  list.innerHTML = '';
  for (const w of WEAPONS) {
    const open = weaponUnlocked(data, w);
    const el = document.createElement('div');
    el.className = `item${open ? '' : ' locked'}${data.weapon === w.id ? ' sel' : ''}`;
    el.innerHTML = `<div class="pic"><img src="assets/ui/${w.model}.png" alt=""></div>
      <div><h3>${w.name}</h3><p>${w.desc}</p>${open ? '' : `<span class="lock">🔒 Рекорд ${w.unlock}</span>`}</div>
      <canvas aria-hidden="true"></canvas>`;
    drawTrajectory(el.querySelector('canvas'), w.id);
    el.addEventListener('click', () => (open ? onPick(w.id) : toast(`Наберите ${w.unlock} очков, чтобы открыть`)));
    list.append(el);
  }
}

export function renderLocations(data, onPick) {
  const list = $('locationList');
  list.innerHTML = '';
  const icons = { forest: '🌲', cave: '🪨', winter: '❄️', river: '🏰' };
  for (const l of LOCATIONS) {
    const open = locationUnlocked(data, l);
    const el = document.createElement('div');
    el.className = `item${open ? '' : ' locked'}${data.location === l.id ? ' sel' : ''}`;
    el.innerHTML = `<div class="pic" style="font-size:34px">${icons[l.id]}</div>
      <div><h3>${l.name}</h3><p>${RULES[l.id]}</p>${open ? '' : `<span class="lock">🔒 Дойдите до волны ${l.unlockWave}</span>`}</div>
      <span class="chip">🏆 ${data.best[l.id] || 0}</span>`;
    el.addEventListener('click', () => (open ? onPick(l.id) : toast(`Дойдите до волны ${l.unlockWave}`)));
    list.append(el);
  }
}

export function popup(x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  $('pops').append(el);
  setTimeout(() => el.remove(), 850);
}

export function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
}

export function aimAt(x, y) {
  const a = $('aim');
  a.style.left = `${x}px`; a.style.top = `${y}px`;
  a.classList.remove('go'); void a.offsetWidth; a.classList.add('go');
}
