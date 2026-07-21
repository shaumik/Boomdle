/*
 * Boomdle sound engine.
 * Everything is synthesized with the Web Audio API — no audio files, so it
 * stays self-contained and works inside a sandboxed artifact. The context is
 * created lazily on the first user gesture (browsers block audio otherwise)
 * and a master gain lets us mute globally.
 */
const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // A single enveloped oscillator "blip".
  function tone(opts) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const {
      freq = 440,
      dur = 0.12,
      type = "sine",
      gain = 0.3,
      attack = 0.004,
      slideTo = null,
      when = 0,
    } = opts;
    const t0 = c.currentTime + when;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  // Filtered white noise — the "crunch" under explosions.
  function noise(opts) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const {
      dur = 0.15,
      gain = 0.2,
      type = "highpass",
      freq = 800,
      when = 0,
    } = opts;
    const t0 = c.currentTime + when;
    const buf = c.createBuffer(1, Math.max(1, (c.sampleRate * dur) | 0), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  // ---- Named SFX ----
  const key = () => tone({ freq: 330, dur: 0.045, type: "square", gain: 0.1 });
  const del = () => tone({ freq: 180, dur: 0.05, type: "square", gain: 0.09 });
  const invalid = () => {
    tone({ freq: 160, dur: 0.14, type: "sawtooth", gain: 0.16 });
    tone({ freq: 150, dur: 0.14, type: "sawtooth", gain: 0.16, when: 0.07 });
  };

  // Tile flip: pitch rises across the row (i), timbre encodes the result.
  function flip(state, i) {
    const base = 300 + i * 55;
    if (state === "correct") {
      tone({ freq: base, dur: 0.16, type: "triangle", gain: 0.22, slideTo: base * 1.5 });
    } else if (state === "present") {
      tone({ freq: base, dur: 0.13, type: "sine", gain: 0.18 });
    } else {
      tone({ freq: base * 0.7, dur: 0.09, type: "sine", gain: 0.1 });
    }
    noise({ dur: 0.05, gain: 0.05, freq: 1400 });
  }

  const boom = () => {
    noise({ dur: 0.22, gain: 0.13, type: "lowpass", freq: 380 });
    tone({ freq: 90, dur: 0.18, type: "sine", gain: 0.16, slideTo: 40 });
  };

  function win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      tone({ freq: f, dur: 0.28, type: "triangle", gain: 0.26, when: i * 0.09 })
    );
    noise({ dur: 0.5, gain: 0.1, freq: 500, when: 0.22 });
    tone({ freq: 1047, dur: 0.5, type: "triangle", gain: 0.16, when: 0.36 });
  }

  function lose() {
    tone({ freq: 220, dur: 0.5, type: "sawtooth", gain: 0.18, slideTo: 70 });
    noise({ dur: 0.4, gain: 0.08, type: "lowpass", freq: 300, when: 0.05 });
  }

  function setMuted(m) {
    muted = m;
    if (!muted) ensure();
  }
  const isMuted = () => muted;

  return { ensure, key, del, invalid, flip, boom, win, lose, setMuted, isMuted };
})();
