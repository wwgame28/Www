// «Плотность»: весь звук синтезируется в WebAudio, файлов нет.

export class Sfx {
  constructor() { this.ctx = null; this.voice = null; }

  // Вызывать из жеста пользователя (iOS не даст звука иначе).
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    // Гул дома: два низких тона и глухой шум.
    this.amb = ctx.createGain();
    this.amb.gain.value = 0.05;
    this.amb.connect(this.master);
    for (const f of [41, 43.7]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(this.amb); o.start(); }
    const n = this.loopNoise(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260;
    const ng = ctx.createGain(); ng.gain.value = 0.35;
    n.connect(lp).connect(ng).connect(this.amb);
    // Треск рядом с Жильцом.
    this.dread = ctx.createGain();
    this.dread.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    this.loopNoise().connect(bp).connect(this.dread).connect(this.master);
    this.primeVoice();
  }

  loopNoise() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(0, Math.random() * 1.5); return s; }

  out(pan = 0) {
    if (!this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.master); return p;
  }

  burst({ dur = 0.02, freq = 3000, q = 4, vol = 0.05, pan = 0, at = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out(pan));
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  tone({ f0 = 60, f1 = 40, dur = 0.2, vol = 0.3, type = 'sine', pan = 0, at = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out(pan));
    o.start(t); o.stop(t + dur + 0.02);
  }

  tick(beam) { this.burst({ dur: beam ? 0.012 : 0.018, freq: beam ? 6500 : 3200 + Math.random() * 800, vol: beam ? 0.03 : 0.045 }); }
  impulse() {
    this.tone({ f0: 180, f1: 2400, dur: 0.45, vol: 0.12, type: 'triangle' });
    this.burst({ dur: 0.6, freq: 1800, q: 0.6, vol: 0.18 });
  }
  step(pan, vol) { this.tone({ f0: 70, f1: 40, dur: 0.18, vol, pan }); this.burst({ dur: 0.05, freq: 400, q: 1, vol: vol * 0.3, pan }); }
  heart(vol) { this.tone({ f0: 55, f1: 35, dur: 0.16, vol }); this.tone({ f0: 50, f1: 32, dur: 0.18, vol: vol * 0.7, at: 0.2 }); }
  knock(pan, vol) {
    for (let i = 0; i < 3; i++) { this.tone({ f0: 140, f1: 70, dur: 0.12, vol, pan, at: i * 0.32 }); this.burst({ dur: 0.04, freq: 1200, q: 2, vol: vol * 0.4, pan, at: i * 0.32 }); }
  }
  creak(pan, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(55, t + 1.1);
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(f).connect(g).connect(this.out(pan)); o.start(t); o.stop(t + 1.25);
  }
  radio(dur = 0.6) { for (let i = 0; i < 6; i++) this.burst({ dur: dur / 4, freq: 1400 + Math.random() * 1600, q: 1.5, vol: 0.05, at: (i * dur) / 6 }); }
  chime() { this.tone({ f0: 660, f1: 640, dur: 0.9, vol: 0.06, type: 'triangle' }); this.tone({ f0: 990, f1: 960, dur: 1.1, vol: 0.04, type: 'sine', at: 0.08 }); }
  unlockDoor() { this.tone({ f0: 300, f1: 200, dur: 0.08, vol: 0.2, type: 'square' }); this.tone({ f0: 220, f1: 150, dur: 0.1, vol: 0.2, type: 'square', at: 0.15 }); }
  death() { this.burst({ dur: 1.6, freq: 900, q: 0.3, vol: 0.5 }); this.tone({ f0: 120, f1: 25, dur: 1.8, vol: 0.5, type: 'sawtooth' }); }
  setDread(x) { if (this.ctx) this.dread.gain.setTargetAtTime(0.12 * x * x, this.ctx.currentTime, 0.2); }

  // Голос Ани: системный синтез речи, низко и медленно.
  primeVoice() {
    const ss = globalThis.speechSynthesis;
    if (!ss) return;
    ss.speak(new SpeechSynthesisUtterance(' '));
    const pick = () => { this.voice = ss.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ru')) || null; };
    pick();
    ss.addEventListener?.('voiceschanged', pick);
  }
  say(text, { pitch = 0.6, rate = 0.85 } = {}) {
    const ss = globalThis.speechSynthesis;
    if (!ss || !text) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU'; u.pitch = pitch; u.rate = rate; u.volume = 0.9;
    if (this.voice) u.voice = this.voice;
    ss.speak(u);
  }
  suspend() { this.ctx?.suspend(); globalThis.speechSynthesis?.cancel(); }
  resume() { this.ctx?.resume(); }
}
