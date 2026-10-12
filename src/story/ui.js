// DOM pieces of «Приключение»: the creator's choices, hearts, the chapter title card, a queen's gift
// and the island map.
import { $ } from '../ui.js';
import { BASES, PALETTES, SKINS, GEMS } from './data.js';
import { WEAPONS } from '../weapons.js';
import { ZONES, LINES } from './zones/index.js';
import { meets } from './quests.js';
import { BOOKS, PAGES, pageOpen } from './chronicle.js';

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
  el.classList.toggle('many', max > 8); // smaller hearts once the queens' gems add more
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

// A saved kingdom (the queen's gem and blessing) or a ⭐ errand done: a card that fades by itself.
let giftTimer = 0;
export function giftCard({ head = 'Царство спасено!', title, gem, blessing, note }) {
  const el = $('gift');
  el.innerHTML = `<small>${head}</small><h3>${title}</h3>`
    + (gem ? `<p class="gem" style="--c:${gem.color}">Камень королевы: ◆ ${gem.name}</p>` : '')
    + (blessing ? `<p class="bless"><b>${blessing.icon} ${blessing.name}</b>${blessing.desc}</p>` : '')
    + (note ? `<p class="bless">${note}</p>` : '');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(giftTimer);
  giftTimer = setTimeout(() => el.classList.remove('on'), 7000);
}

// The island in the pause menu: the village in the middle, a kingdom on each side, the snow beyond
// the mountains, magic beyond the forest and the caves under the village well.
const MAP = [['', 'forest', 'magic'], ['mountains', 'village', 'beach'], ['snow', 'desert', 'caves']];
const ICON = { village: '🏘️', forest: '🌳', beach: '🌊', desert: '🏜️', mountains: '⛰️', snow: '❄️', magic: '✨', caves: '🕯️' };
export function renderMap(story, here) {
  const cell = (id) => {
    if (!id) return '<span class="cell empty"></span>';
    const own = LINES.filter((l) => l.zone === id && !l.ending && !l.side), done = own.length > 0 && own.every((l) => story.done.includes(l.id));
    const errands = LINES.filter((l) => l.zone === id && l.side && !story.done.includes(l.id) && meets(story, l.requires)).length;
    const gem = GEMS.find((g) => own.some((l) => l.gem === g.id));
    const seen = id === 'village' || story.zone === id || own.some((l) => story.done.includes(l.id) || story.lines[l.id] !== undefined);
    const cls = ['cell', done ? 'done' : '', id === here ? 'here' : '', seen ? '' : 'fog'].join(' ');
    return `<span class="${cls}"><i>${ICON[id]}</i><b>${ZONES[id].name}</b>${gem ? `<em style="--c:${gem.color}">${story.gems.includes(gem.id) ? '◆' : '◇'}</em>` : ''}${errands ? `<s>⭐${errands}</s>` : ''}${id === here ? '<u>ты здесь</u>' : ''}</span>`;
  };
  $('islandMap').innerHTML = MAP.map((row) => row.map(cell).join('')).join('');
  $('mapGems').textContent = `Камни королев: ${story.gems.length} из ${GEMS.length}`;
}

// The «Летопись»: books with their pages; a closed page says how to open it.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function howToOpen(p) {
  if (p.unlock.scroll) return `Свиток спрятан: ${ZONES[p.unlock.scroll.zone].name}`;
  const l = LINES.find((x) => x.id === p.unlock.done);
  if (l.side) return `⭐ Поручение «${l.title}» · ${ZONES[l.zone].name}`;
  return { awakening: 'Пройди первую главу', king: 'Победи Короля скелетов', finale: 'Заверши историю' }[l.id] || `Спаси: ${ZONES[l.zone].name}`;
}
export function renderChronicle(story, onOpen) {
  const read = story.read || [], open = PAGES.filter((p) => pageOpen(story, p));
  $('chronCount').textContent = `${open.length} из ${PAGES.length}`;
  const box = $('chronList');
  box.innerHTML = '';
  BOOKS.forEach((b, i) => {
    const h = document.createElement('h4');
    h.textContent = `Книга ${ROMAN[i]} · ${b.title}`;
    box.append(h);
    for (const p of PAGES.filter((x) => x.book === b.id)) {
      const on = pageOpen(story, p), row = document.createElement('button');
      row.className = `page${on ? '' : ' shut'}${on && !read.includes(p.id) ? ' fresh' : ''}`;
      row.innerHTML = on ? `<b>${p.title}</b>` : `<b>🔒 ???</b><small>${howToOpen(p)}</small>`;
      if (on) row.addEventListener('click', () => onOpen(p));
      else row.disabled = true;
      box.append(row);
    }
  });
}
export function showPage(p) {
  $('chronTitle').textContent = p.title;
  $('chronText').innerHTML = p.text.map((t) => `<p>${t}</p>`).join('');
  $('chronicle').classList.add('reading');
  $('chronPage').scrollTop = 0;
}
