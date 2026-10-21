// Звуковой движок на Web Audio: всё синтезируется в коде, файлов нет.
// AudioContext создаётся и запускается только по первому жесту пользователя.
import { Ambience } from './ambience.js';
import { Sfx } from './sfx.js';

function makeNoise(ctx, kind, seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      // фильтр Пола Келлета
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // плавная склейка конца с началом — без щелчка на повторе
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[n - fade + i] = d[n - fade + i] * (1 - t) + d[i] * t;
  }
  return buf;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { volume: 0.8, ambience: 0.8, effects: 0.9 };
    this.paused = false;
    this.ambience = null;
    this.sfx = null;
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.ratio.value = 8;
      this.limiter.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(this.limiter);
      this.ambBus = ctx.createGain();
      this.ambBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.noise = { white: makeNoise(ctx, 'white'), pink: makeNoise(ctx, 'pink', 3), brown: makeNoise(ctx, 'brown', 4) };
      this.ambience = new Ambience(this);
      this.sfx = new Sfx(this);
      this.applyVolumes();
    }
    if (this.ctx.state !== 'running' && !this.paused) this.ctx.resume().catch(() => {});
  }

  setVolumes({ volume, ambience, effects }) {
    this.volumes = { volume, ambience, effects };
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.volume, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.ambience, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.effects, t, 0.05);
  }

  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  update(dt, state) {
    if (!this.ready) return;
    this.ambience.update(dt, state);
  }
}
