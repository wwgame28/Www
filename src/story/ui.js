// DOM pieces of «Приключение»: the creator's choices, hearts, the chapter title card.
import { $ } from '../ui.js';
import { BASES, PALETTES, SKINS } from './data.js';
import { WEAPONS } from '../weapons.js';

// The creator's open tab ('look' | 'weapon'): a row of buttons per choice; onPick(key, id) on a tap.
export function renderCreator(tab, draft, onPick) {
  const box = $('creatorPicks');
  box.innerHTML = '';
  const row = (label, items, key, swatch = false) => {
    const r = document.createElement('div');
    r.className = 'pick-row';
    if (label) r.innerHTML = `<small>${label}</small>`;
    for (const it of items) {
      const b = document.createElement('button'), on = draft[key] === it.id;
      b.className = `pick${swatch ? ' sw' : ''}${on ? ' on' : ''}`;
      if (swatch) { b.style.background = it.swatch; b.setAttribute('aria-label', it.name); } else b.textContent = it.name;
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => onPick(key, it.id));
      r.append(b);
    }
    box.append(r);
  };
  for (const t of document.querySelectorAll('[data-ctab]')) {
    const on = t.dataset.ctab === tab;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  }
  if (tab === 'look') {
    row('', BASES.map((b) => ({ id: b.model, name: b.name })), 'base');
    row('Одежда', PALETTES, 'palette', true);
    row('Кожа', SKINS, 'skin', true);
    $('creatorInfo').textContent = 'Нажми, чтобы примерить';
  } else {
    row('', WEAPONS, 'weapon');
    $('creatorInfo').textContent = WEAPONS.find((w) => w.id === draft.weapon)?.desc || '';
  }
}

export function renderHearts(n, max, hit = false) {
  const el = $('hearts');
  el.innerHTML = Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">❤️</span>`).join('');
  el.setAttribute('aria-label', `Сердца: ${n} из ${max}`);
  if (hit) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
}

export function chapterCard(title, sub = '') {
  $('cardTitle').textContent = title;
  $('cardSub').textContent = sub;
  const el = $('chapterCard');
  el.classList.remove('go');
  void el.offsetWidth; // restart the animation
  el.classList.add('go');
}
