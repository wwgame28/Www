// HUD: биом, координаты, время суток, компас, режим полёта, всплывающие подписи и подсказки.
import { CONFIG } from '../config.js';
import { PAL } from './palette.js';

const DIRS = [
  [0, 'С'],
  [45, 'СВ'],
  [90, 'В'],
  [135, 'ЮВ'],
  [180, 'Ю'],
  [225, 'ЮЗ'],
  [270, 'З'],
  [315, 'СЗ'],
];
const SUN_ICON =
  '<circle cx="12" cy="12" r="4.2" fill="#ffc861"/><g stroke="#ffc861" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>';
const MOON_ICON = '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.3 7 7 0 0 1-5-13.3z" fill="#cfe0ff"/>';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.biomeDot = document.getElementById('biome-dot');
    this.biomeName = document.getElementById('biome-name');
    this.coords = document.getElementById('coords');
    this.clock = document.getElementById('clock');
    this.clockIcon = document.getElementById('clock-icon');
    this.dayEl = document.getElementById('day');
    this.modeChip = document.getElementById('mode-chip');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.lockHint = document.getElementById('lock-hint');
    this.compass = document.getElementById('compass');
    this.ctx = this.compass.getContext('2d');
    this.lastHeading = null;
    this.lastText = {};
    this.isDay = null;
    this.toastTimer = 0;
    this.hintTimer = 0;
    this.sizeCompass();
  }

  show(v) {
    this.root.hidden = !v;
    if (v) this.sizeCompass();
  }

  sizeCompass() {
    const r = this.compass.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round((r.width || 240) * dpr);
    const h = Math.round((r.height || 40) * dpr);
    if (this.compass.width !== w || this.compass.height !== h) {
      this.compass.width = w;
      this.compass.height = h;
    }
    this.dpr = dpr;
    this.lastHeading = null;
  }

  setText(el, key, text) {
    if (this.lastText[key] === text) return;
    this.lastText[key] = text;
    el.textContent = text;
  }

  // Раз в 1/hudHz секунды
  update({ x, y, z, biome, time, day, flying }) {
    this.setText(this.coords, 'coords', `X ${Math.round(x)} · Y ${Math.round(y)} · Z ${Math.round(z)}`);
    if (biome) {
      this.setText(this.biomeName, 'biome', biome.name);
      if (this.lastText.dot !== biome.chip) {
        this.lastText.dot = biome.chip;
        this.biomeDot.style.background = biome.chip;
      }
    }
    const minutes = Math.floor(time * 24 * 60);
    const hh = String(Math.floor(minutes / 60) % 24).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    this.setText(this.clock, 'clock', `${hh}:${mm}`);
    this.setText(this.dayEl, 'day', `день ${day}`);
    const isDay = time > 0.25 && time < 0.75;
    if (isDay !== this.isDay) {
      this.isDay = isDay;
      this.clockIcon.innerHTML = isDay ? SUN_ICON : MOON_ICON;
    }
    if (this.modeChip.hidden === flying) this.modeChip.hidden = !flying;
  }

  // Компас: лента направлений, сдвигается с поворотом головы. yaw=0 — взгляд на север (−z).
  drawCompass(yaw) {
    let heading = ((-yaw * 180) / Math.PI) % 360;
    if (heading < 0) heading += 360;
    if (this.lastHeading !== null && Math.abs(heading - this.lastHeading) < 0.2) return;
    this.lastHeading = heading;
    const c = this.ctx;
    const W = this.compass.width;
    const H = this.compass.height;
    const d = this.dpr;
    const span = 140;
    const px = W / span;
    c.clearRect(0, 0, W, H);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let a = 0; a < 360; a += 15) {
      let rel = a - heading;
      rel = ((rel + 540) % 360) - 180;
      if (Math.abs(rel) > span / 2) continue;
      const x = W / 2 + rel * px;
      const fade = 1 - Math.abs(rel) / (span / 2);
      c.globalAlpha = Math.max(0, Math.min(1, fade * 1.6));
      const label = DIRS.find((p) => p[0] === a);
      if (label) {
        const main = a % 90 === 0;
        c.fillStyle = a === 0 ? PAL.danger : main ? PAL.text : PAL.muted;
        c.font = `800 ${Math.round((main ? 15 : 12) * d)}px Manrope, system-ui, sans-serif`;
        c.fillText(label[1], x, H / 2 + 1 * d);
      } else {
        c.fillStyle = PAL.muted;
        c.fillRect(x - 0.75 * d, H * 0.36, 1.5 * d, H * 0.28);
      }
    }
    c.globalAlpha = 1;
    c.fillStyle = PAL.primary;
    c.beginPath();
    c.moveTo(W / 2 - 6 * d, 0);
    c.lineTo(W / 2 + 6 * d, 0);
    c.lineTo(W / 2, 7 * d);
    c.closePath();
    c.fill();
  }

  toast(text, color) {
    this.toastEl.innerHTML = '';
    if (color) {
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = color;
      this.toastEl.appendChild(dot);
    }
    this.toastEl.appendChild(document.createTextNode(text));
    this.toastEl.classList.add('on');
    this.toastTimer = CONFIG.ui.toastSec;
  }

  hint(text, sec = CONFIG.ui.hintSec) {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('on');
    this.hintTimer = sec;
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('on');
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('on');
    }
  }

  setLockHint(v) {
    if (this.lockHint.hidden === !v) return;
    this.lockHint.hidden = !v;
  }
}
