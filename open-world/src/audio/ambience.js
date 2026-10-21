// Фон мира: ветер (сильнее на высоте и в полёте), прибой у воды, птицы днём, сверчки ночью.
import { CONFIG } from '../config.js';

const A = CONFIG.audio;
const BIRD_BIOMES = { plains: 1, forest: 1.6, beach: 0.5, mountains: 0.4 };
const CRICKET_BIOMES = { plains: 1, forest: 0.8, beach: 0.6, desert: 0.5, mountains: 0.25, lake: 0.5 };

function loop(ctx, buffer, rate = 1) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  s.playbackRate.value = rate;
  s.loopStart = 0;
  s.start(0, Math.random() * buffer.duration);
  return s;
}

export class Ambience {
  constructor(engine) {
    this.engine = engine;
    const ctx = engine.ctx;
    const bus = engine.ambBus;
    this.ctx = ctx;

    // ветер: бурый шум через полосовой фильтр + тонкий свист на высоте
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 450;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    loop(ctx, engine.noise.brown).connect(this.windFilter).connect(this.windGain).connect(bus);
    this.whistleFilter = ctx.createBiquadFilter();
    this.whistleFilter.type = 'bandpass';
    this.whistleFilter.frequency.value = 1400;
    this.whistleFilter.Q.value = 3;
    this.whistleGain = ctx.createGain();
    this.whistleGain.gain.value = 0;
    loop(ctx, engine.noise.pink, 1.1).connect(this.whistleFilter).connect(this.whistleGain).connect(bus);

    // прибой: розовый шум, низкие частоты, медленные «накаты»
    this.surfFilter = ctx.createBiquadFilter();
    this.surfFilter.type = 'lowpass';
    this.surfFilter.frequency.value = 700;
    this.surfSwell = ctx.createGain();
    this.surfSwell.gain.value = 0.55;
    this.surfLfo = ctx.createOscillator();
    this.surfLfo.frequency.value = 0.12;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.45;
    this.surfLfo.connect(lfoDepth).connect(this.surfSwell.gain);
    this.surfLfo.start();
    this.surfGain = ctx.createGain();
    this.surfGain.gain.value = 0;
    loop(ctx, engine.noise.pink, 0.9).connect(this.surfFilter).connect(this.surfSwell).connect(this.surfGain).connect(bus);

    // сверчки: несколько высоких тонов с импульсной огибающей
    this.cricketBus = ctx.createGain();
    this.cricketBus.gain.value = 0;
    this.cricketBus.connect(bus);
    this.crickets = [];
    for (let i = 0; i < A.crickets.voices; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 4200 + i * 430 + Math.random() * 120;
      const g = ctx.createGain();
      g.gain.value = 0;
      const pan = ctx.createStereoPanner();
      pan.pan.value = (i / Math.max(1, A.crickets.voices - 1)) * 1.4 - 0.7;
      osc.connect(g).connect(pan).connect(this.cricketBus);
      osc.start();
      this.crickets.push({ g, next: ctx.currentTime + Math.random(), rate: 0.55 + Math.random() * 0.4, pulses: 3 + (i % 2) });
    }

    this.birdBus = ctx.createGain();
    this.birdBus.gain.value = A.birds.level;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 7000;
    this.birdBus.connect(soften).connect(bus);
    this.nextBird = ctx.currentTime + 2;
    this.gust = 0;
    this.gustTarget = 0;
    this.gustTimer = 0;
  }

  // s: { altitude, speed, flying, swimming, nearWater, daylight, biome }
  update(dt, s) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gustTimer = 1.5 + Math.random() * 3;
      this.gustTarget = Math.random();
    }
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 0.8);

    const alt = Math.max(0, s.altitude);
    const fly = s.flying ? s.speed : 0;
    let wind = A.wind.base + alt * A.wind.altitude + fly * A.wind.flight + this.gust * A.wind.gust;
    if (s.biome === 'forest') wind *= 0.7;
    if (s.biome === 'snow' || s.biome === 'mountains') wind *= 1.3;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, wind), t, 0.4);
    this.windFilter.frequency.setTargetAtTime(320 + this.gust * 380 + fly * 9 + alt * 1.5, t, 0.5);
    this.whistleGain.gain.setTargetAtTime(Math.min(0.08, Math.max(0, alt - 60) * 0.0006 + fly * 0.0009), t, 0.6);

    const surf = s.swimming ? 1 : s.nearWater;
    this.surfGain.gain.setTargetAtTime(surf * A.surf.level, t, 0.6);

    const birdK = (BIRD_BIOMES[s.biome] || 0) * Math.max(0, s.daylight - 0.3) * 1.4;
    if (birdK > 0.05 && t >= this.nextBird) {
      this.bird(t + 0.05);
      const gap = A.birds.minGap + Math.random() * (A.birds.maxGap - A.birds.minGap);
      this.nextBird = t + gap / Math.min(2, birdK);
    } else if (birdK <= 0.05) {
      this.nextBird = Math.max(this.nextBird, t + 1);
    }

    const night = Math.max(0, 1 - s.daylight * 1.6);
    const cricketK = night * (CRICKET_BIOMES[s.biome] || 0) * (s.flying && alt > 30 ? 0.2 : 1);
    this.cricketBus.gain.setTargetAtTime(cricketK * A.crickets.level, t, 0.8);
    if (cricketK > 0.02) this.scheduleCrickets(t);
  }

  scheduleCrickets(t) {
    for (const c of this.crickets) {
      if (c.next < t) c.next = t + Math.random() * 0.3;
      while (c.next < t + 0.3) {
        let at = c.next;
        for (let i = 0; i < c.pulses; i++) {
          c.g.gain.setValueAtTime(0, at);
          c.g.gain.linearRampToValueAtTime(1, at + 0.004);
          c.g.gain.setValueAtTime(1, at + 0.016);
          c.g.gain.linearRampToValueAtTime(0, at + 0.021);
          at += 0.042;
        }
        c.next += c.rate * (0.85 + Math.random() * 0.3);
      }
    }
  }

  // Птица: короткая фраза из свиста, трели или чириканья, со случайной панорамой
  bird(t0) {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const out = ctx.createGain();
    out.gain.value = 0.5 + Math.random() * 0.5;
    out.connect(pan).connect(this.birdBus);
    const kind = Math.floor(Math.random() * 3);
    const base = 2400 + Math.random() * 1600;
    const notes = [];
    if (kind === 0) {
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) notes.push([t0 + i * 0.16, 0.08, base, base * 1.45]);
    } else if (kind === 1) {
      const n = 7 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) notes.push([t0 + i * 0.055, 0.035, base * 1.2, base * 1.1]);
    } else {
      notes.push([t0, 0.22, base * 0.9, base * 0.95]);
      notes.push([t0 + 0.3, 0.3, base * 0.72, base * 0.66]);
    }
    let end = t0;
    for (const [at, dur, f0, f1] of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.9, at + Math.min(0.012, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.02);
      end = Math.max(end, at + dur);
    }
    setTimeout(() => out.disconnect(), (end - ctx.currentTime + 0.5) * 1000);
  }
}
