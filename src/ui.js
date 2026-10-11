import { launch, stepProjectile } from './weapons.js';
import { LOCATIONS, ARENA } from './locations.js';
import { heroUnlocked, locationUnlocked } from './progress.js';

export const $ = (id) => document.getElementById(id);

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
function drawTrajectory(canvas, weaponId, color = '#ffd34d') {
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
  c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(...P(p.x, p.z));
  for (let i = 0; i < 400 && p.state === 'flying'; i++) { stepProjectile(p, 1 / 60, world); c.lineTo(...P(p.x, p.z)); }
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(...P(hero.x, hero.z), 3, 0, Math.PI * 2); c.fill();
}

// Hero card under the 3D close-up: name, weapon, its real trajectory, lock state.
export function renderHero(data, h, index, total) {
  const open = heroUnlocked(data, h);
  const hex = `#${h.color.toString(16).padStart(6, '0')}`;
  $('heroName').textContent = h.name;
  $('heroWeapon').textContent = h.weaponName;
  $('heroWeapon').style.color = hex;
  $('heroDesc').textContent = h.desc;
  $('heroCount').textContent = `${index + 1} / ${total}`;
  const pick = $('heroPick');
  pick.disabled = false;
  pick.classList.toggle('ghost', !open);
  pick.textContent = !open ? `🔒 Рекорд ${h.unlock}` : data.hero === h.id ? 'Выбран ✓' : 'Играть за него';
  drawTrajectory($('heroPath'), h.weapon, hex);
}

export function renderLocations(data, onPick) {
  const list = $('locationList');
  list.innerHTML = '';
  for (const l of LOCATIONS) {
    const open = locationUnlocked(data, l);
    const el = document.createElement('div');
    el.className = `item${open ? '' : ' locked'}${data.location === l.id ? ' sel' : ''}`;
    el.innerHTML = `<div class="pic" style="font-size:34px">${l.icon}</div>
      <div><h3>${l.name}</h3><p>${l.desc}</p>${open ? '' : `<span class="lock">🔒 Дойдите до волны ${l.unlockWave}</span>`}</div>
      <span class="chip">🏆 ${data.best[l.id] || 0}</span>`;
    el.addEventListener('click', () => (open ? onPick(l.id) : toast(`Дойдите до волны ${l.unlockWave}`)));
    list.append(el);
  }
}

export function popup(x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  if (cls.includes('combo')) el.style.rotate = `${(Math.random() - 0.5) * 12}deg`; // a little tilt, so a chain doesn't look stamped
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  $('pops').append(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 2000); // in case the animation never runs (reduced motion)
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
