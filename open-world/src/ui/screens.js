// Экраны (старт, загрузка, пауза, настройки) и форма настроек.
import { CONFIG } from '../config.js';

export class Screens {
  constructor() {
    this.els = {
      menu: document.getElementById('screen-menu'),
      loading: document.getElementById('screen-loading'),
      pause: document.getElementById('screen-pause'),
      settings: document.getElementById('screen-settings'),
    };
    this.current = null;
  }

  show(name) {
    this.current = name;
    for (const [k, el] of Object.entries(this.els)) {
      const on = k === name;
      el.classList.toggle('on', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    }
  }
}

// Связывает контролы формы с объектом настроек. onChange(key) — после каждого изменения.
export function bindSettings(settings, onChange) {
  const $ = (id) => document.getElementById(id);
  const S = CONFIG.world.chunkSize;
  const ranges = [
    ['set-view', 'out-view', 'viewDistance', (v) => `${v} ${plural(v, 'чанк', 'чанка', 'чанков')} · ${v * S} м`, Number],
    ['set-sens', 'out-sens', 'sensitivity', (v) => `${v.toFixed(1)}×`, Number],
    ['set-volume', 'out-volume', 'volume', (v) => `${Math.round(v * 100)}%`, (v) => Number(v) / 100, (v) => v * 100],
    ['set-ambience', 'out-ambience', 'ambience', (v) => `${Math.round(v * 100)}%`, (v) => Number(v) / 100, (v) => v * 100],
    ['set-effects', 'out-effects', 'effects', (v) => `${Math.round(v * 100)}%`, (v) => Number(v) / 100, (v) => v * 100],
  ];
  const refreshers = [];
  for (const [inputId, outId, key, fmt, parse, toInput = (v) => v] of ranges) {
    const input = $(inputId);
    const out = $(outId);
    const refresh = () => {
      input.value = String(toInput(settings[key]));
      out.textContent = fmt(settings[key]);
    };
    input.addEventListener('input', () => {
      settings[key] = parse(input.value);
      out.textContent = fmt(settings[key]);
      onChange(key);
    });
    refreshers.push(refresh);
  }
  const seg = document.querySelectorAll('.segmented [data-quality]');
  const refreshSeg = () => {
    for (const b of seg) b.setAttribute('aria-checked', b.dataset.quality === settings.quality ? 'true' : 'false');
  };
  for (const b of seg) {
    b.addEventListener('click', () => {
      if (settings.quality === b.dataset.quality) return;
      settings.quality = b.dataset.quality;
      settings.viewDistance = CONFIG.quality[settings.quality].viewDistance;
      refreshAll();
      onChange('quality');
    });
  }
  refreshers.push(refreshSeg);
  const toggles = [
    ['set-motion', 'reduceMotion'],
    ['set-invert', 'invertY'],
    ['set-debug', 'showDebug'],
  ];
  for (const [id, key] of toggles) {
    const el = $(id);
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      onChange(key);
    });
    refreshers.push(() => {
      el.checked = !!settings[key];
    });
  }
  function refreshAll() {
    for (const r of refreshers) r();
  }
  refreshAll();
  return refreshAll;
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
