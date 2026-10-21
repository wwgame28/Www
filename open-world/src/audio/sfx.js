// Короткие эффекты: шаги (свои для травы, леса, песка, снега, камня и воды), прыжок, приземление, всплеск, клик.
import { CONFIG } from '../config.js';

const STEP = {
  grass: { type: 'bandpass', f: 1700, q: 0.7, dur: 0.11, peak: 0.42, attack: 0.008 },
  forest: { type: 'bandpass', f: 1400, q: 0.8, dur: 0.12, peak: 0.42, attack: 0.008, twig: true },
  sand: { type: 'bandpass', f: 3000, q: 0.5, dur: 0.17, peak: 0.3, attack: 0.025 },
  snow: { type: 'lowpass', f: 2600, q: 0.6, dur: 0.16, peak: 0.36, attack: 0.01, crunch: true },
  rock: { type: 'highpass', f: 900, q: 0.7, dur: 0.06, peak: 0.45, attack: 0.002, thump: 120 },
  water: { type: 'bandpass', f: 900, q: 0.9, dur: 0.28, peak: 0.5, attack: 0.02, sweep: 420 },
};

export class Sfx {
  constructor(engine) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.bus = engine.sfxBus;
    this.level = CONFIG.audio.steps.level;
  }

  noiseBurst(t, dur, filterType, freq, q, peak, attack, rate = 1, sweepTo = 0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.engine.noise.white;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  tone(t, dur, freq, peak, type = 'sine', endFreq = 0) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  step(surface, run = false, loud = 1) {
    if (!this.engine.ready) return;
    const p = STEP[surface] || STEP.grass;
    const t = this.ctx.currentTime + 0.005;
    const jitter = 0.92 + Math.random() * 0.16; // ±8% высоты тона
    const peak = p.peak * this.level * (run ? 1.25 : 1) * loud;
    this.noiseBurst(t, p.dur, p.type, p.f * jitter, p.q, peak, p.attack, jitter, p.sweep ? p.sweep * jitter : 0);
    if (p.thump) this.tone(t, 0.08, p.thump * jitter, peak * 0.6, 'sine', p.thump * 0.6);
    if (p.crunch) {
      for (let i = 1; i <= 3; i++) this.noiseBurst(t + i * 0.022, 0.03, 'highpass', 2500 * jitter, 0.8, peak * 0.5, 0.002);
    }
    if (p.twig && Math.random() < 0.25) this.noiseBurst(t + 0.03, 0.025, 'highpass', 4000, 1, peak * 0.7, 0.001);
  }

  jump(surface) {
    if (!this.engine.ready) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.18, 'bandpass', 600, 0.8, 0.12 * this.level, 0.03, 1, 1400);
    this.step(surface, false, 0.6);
  }

  land(surface, impact) {
    if (!this.engine.ready) return;
    const k = Math.min(1.6, 0.6 + impact / 10);
    const t = this.ctx.currentTime + 0.005;
    this.tone(t, 0.14, 95, 0.22 * this.level * k, 'sine', 55);
    this.step(surface, true, k);
  }

  splash(power) {
    if (!this.engine.ready) return;
    const t = this.ctx.currentTime + 0.005;
    const k = 0.5 + power;
    this.noiseBurst(t, 0.45, 'bandpass', 1500, 0.6, 0.45 * this.level * k, 0.01, 1, 380);
    for (let i = 0; i < 4; i++) this.tone(t + 0.08 + i * 0.05 + Math.random() * 0.04, 0.06, 600 + Math.random() * 500, 0.05 * this.level, 'sine', 1200);
  }

  swim() {
    if (!this.engine.ready) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.35, 'bandpass', 700, 0.8, 0.22 * this.level, 0.06, 0.9, 350);
  }

  fly(on) {
    if (!this.engine.ready) return;
    const t = this.ctx.currentTime + 0.005;
    this.noiseBurst(t, 0.5, 'bandpass', on ? 400 : 1600, 1.2, 0.18 * this.level, 0.12, 1, on ? 1800 : 300);
  }

  click() {
    if (!this.engine.ready) return;
    const t = this.ctx.currentTime + 0.002;
    this.tone(t, 0.05, 880, 0.08, 'triangle', 640);
  }
}
