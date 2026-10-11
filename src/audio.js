// Synthesized sound effects (no audio files). The context is created on the first user gesture,
// as iOS Safari requires.

export function createAudio() {
  let ctx = null, master = null, muted = false;

  const unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  };

  function tone({ type = 'square', f0, f1 = f0, dur = 0.12, vol = 0.5, delay = 0 }) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur = 0.2, vol = 0.4, cutoff = 1800) {
    if (!ctx || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur);
  }

  const SFX = {
    shoot: () => tone({ f0: 880, f1: 220, dur: 0.12, vol: 0.3 }),
    bounce: () => tone({ type: 'triangle', f0: 600, f1: 900, dur: 0.06, vol: 0.25 }),
    chain: () => tone({ type: 'sawtooth', f0: 1200, f1: 600, dur: 0.08, vol: 0.2 }),
    kill: (ev) => { noise(0.12, 0.3, 2500); tone({ type: 'square', f0: 300 + ev.combo * 120, f1: 600 + ev.combo * 160, dur: 0.1, vol: 0.25 }); },
    hurt: () => tone({ type: 'square', f0: 200, f1: 150, dur: 0.08, vol: 0.25 }),
    pickup: () => { tone({ type: 'sine', f0: 520, dur: 0.07, vol: 0.4 }); tone({ type: 'sine', f0: 780, dur: 0.09, vol: 0.4, delay: 0.06 }); },
    return: () => tone({ type: 'sine', f0: 660, f1: 990, dur: 0.1, vol: 0.35 }),
    catch: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.08, vol: 0.35, delay: i * 0.05 })),
    explode: () => { noise(0.6, 0.6, 900); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.5, vol: 0.6 }); },
    death: () => { tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 0.6, vol: 0.4 }); noise(0.4, 0.3, 700); },
    wave: () => [392, 523, 659].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.25, delay: i * 0.08 })),
    waveClear: () => [659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.2, delay: i * 0.07 })),
    click: () => tone({ type: 'sine', f0: 700, dur: 0.04, vol: 0.2 }),
  };

  return {
    unlock,
    play: (ev) => SFX[ev.type]?.(ev),
    setMuted(m) { muted = m; },
    suspend() { ctx?.suspend(); },
    resume() { if (ctx && !muted) ctx.resume(); },
  };
}
