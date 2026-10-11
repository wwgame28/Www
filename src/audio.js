// Synthesized sound effects (no audio files). The context is created on the first user gesture,
// as iOS Safari requires. Everything runs through a low-pass (muffled on death) and a compressor,
// so a big multi-kill never clips the phone speaker.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // major pentatonic from G4: a combo plays a rising tune
const THROTTLE = 0.03; // the same sound at most every 30 ms

export function createAudio() {
  let ctx = null, master = null, lowpass = null, muted = false, voice = 'whoosh';
  const last = {};

  const unlock = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.12;
      master.connect(lowpass).connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    lowpass.frequency.cancelScheduledValues(ctx.currentTime); // full sound again after the death sweep
    lowpass.frequency.setValueAtTime(20000, ctx.currentTime);
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
  function noise({ dur = 0.2, vol = 0.4, type = 'lowpass', f0 = 1800, f1 = f0, q = 1 } = {}) {
    if (!ctx || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur);
  }

  const SFX = {
    // Thrown props whoosh; mage orbs zap.
    shoot: () => (voice === 'zap'
      ? (tone({ type: 'sawtooth', f0: 1400, f1: 500, dur: 0.12, vol: 0.18 }), tone({ type: 'sine', f0: 2200, f1: 3200, dur: 0.08, vol: 0.12, delay: 0.02 }))
      : noise({ dur: 0.16, vol: 0.55, type: 'bandpass', f0: 500, f1: 2500, q: 1.4 })),
    bounce: () => tone({ type: 'triangle', f0: 600, f1: 900, dur: 0.06, vol: 0.25 }),
    chain: () => tone({ type: 'sawtooth', f0: 1200, f1: 600, dur: 0.08, vol: 0.2 }),
    kill: (ev) => {
      noise({ dur: 0.09, vol: 0.45, type: 'bandpass', f0: 1800, q: 1.2 }); // bone crunch
      tone({ type: 'sine', f0: 140, f1: 55, dur: 0.12, vol: 0.5 });        // thump
      const s = PENTA[Math.min(PENTA.length - 1, Math.max(0, (ev.combo || 1) - 1))];
      tone({ type: 'triangle', f0: 392 * 2 ** (s / 12), dur: 0.16, vol: 0.3 });
    },
    hurt: () => tone({ type: 'square', f0: 200, f1: 150, dur: 0.08, vol: 0.25 }),
    pickup: () => { tone({ type: 'sine', f0: 520, dur: 0.07, vol: 0.4 }); tone({ type: 'sine', f0: 780, dur: 0.09, vol: 0.4, delay: 0.06 }); },
    return: () => tone({ type: 'sine', f0: 660, f1: 990, dur: 0.1, vol: 0.35 }),
    catch: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.08, vol: 0.35, delay: i * 0.05 }));
      tone({ type: 'sine', f0: 3100, f1: 2600, dur: 0.25, vol: 0.12 }); // shing
      noise({ dur: 0.18, vol: 0.15, type: 'highpass', f0: 6000 });
    },
    drop: () => { tone({ type: 'triangle', f0: 220, f1: 90, dur: 0.09, vol: 0.45 }); noise({ dur: 0.06, vol: 0.2, f0: 1200 }); },
    spawn: (ev) => { if (!ev.flying) noise({ dur: 0.3, vol: 0.35, f0: 300 }); }, // rumble from under the ground
    explode: () => { noise({ dur: 0.6, vol: 0.6, f0: 900 }); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.5, vol: 0.6 }); },
    death: () => {
      tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 0.6, vol: 0.4 }); noise({ dur: 0.4, vol: 0.3, f0: 700 });
      const t = ctx.currentTime;
      lowpass.frequency.setValueAtTime(20000, t); lowpass.frequency.exponentialRampToValueAtTime(500, t + 0.3); // everything goes muffled
    },
    wave: () => [392, 523, 659].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.25, delay: i * 0.08 })),
    waveClear: () => [659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.1, vol: 0.2, delay: i * 0.07 })),
    click: () => tone({ type: 'sine', f0: 700, dur: 0.04, vol: 0.2 }),
  };

  return {
    unlock,
    play(ev) {
      const fn = SFX[ev.type];
      if (!fn || !ctx || muted) return;
      if (ctx.currentTime - (last[ev.type] ?? -1) < THROTTLE) return;
      last[ev.type] = ctx.currentTime;
      fn(ev);
    },
    setVoice(v) { voice = v; }, // 'whoosh' (thrown props) | 'zap' (mage orbs)
    setMuted(m) { muted = m; },
    suspend() { ctx?.suspend(); },
    resume() { if (ctx && !muted) ctx.resume(); },
  };
}
