// instruments.js — generic sound generators ("kinds"). Styles supply parameter
// presets; nothing here knows about any particular genre.
// Every kind has the same signature: (ctx, out, t, ev, p)
//   ctx = AudioContext, out = destination node, t = start time,
//   ev  = event {freq, dur, vel, open}, p = preset params from the style.

const noiseCache = new WeakMap();

function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function noiseSrc(ctx, t, dur) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.start(t, Math.random()); // random offset so hits differ slightly
  s.stop(t + dur);
  return s;
}

const decayEnv = (g, t, peak, decay) => {
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
};

function filter(ctx, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

// ---- Drums ----------------------------------------------------------------

function kick(ctx, out, t, ev, p) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = p.type || 'sine';
  o.frequency.setValueAtTime(p.f0, t);
  o.frequency.exponentialRampToValueAtTime(p.f1, t + p.sweep);
  decayEnv(g, t, ev.vel * p.gain, p.decay);
  o.connect(g);
  let tail = g;
  if (p.lp) { tail = filter(ctx, 'lowpass', p.lp); g.connect(tail); }
  tail.connect(out);
  o.start(t); o.stop(t + p.decay + 0.05);
  if (p.click) { // short noise transient
    const n = noiseSrc(ctx, t, 0.02), cg = ctx.createGain();
    decayEnv(cg, t, ev.vel * p.click, 0.015);
    n.connect(filter(ctx, 'highpass', 2000)).connect(cg).connect(out);
  }
}

function snare(ctx, out, t, ev, p) {
  const bursts = p.clap ? [0, 0.011, 0.022] : [0];
  bursts.forEach((off, i) => {
    const last = i === bursts.length - 1;
    const d = last ? p.decay : 0.012;
    const n = noiseSrc(ctx, t + off, d + 0.05), g = ctx.createGain();
    decayEnv(g, t + off, ev.vel * p.gain, d);
    n.connect(filter(ctx, 'bandpass', p.noiseFreq, p.q || 0.8)).connect(g).connect(out);
  });
  if (p.tone) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(p.tone, t);
    o.frequency.exponentialRampToValueAtTime(p.tone * 0.6, t + p.toneDecay);
    decayEnv(g, t, ev.vel * p.toneGain, p.toneDecay);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + p.toneDecay + 0.05);
  }
}

function hat(ctx, out, t, ev, p) {
  const d = ev.open ? p.openDecay : p.decay;
  const n = noiseSrc(ctx, t, d + 0.05), g = ctx.createGain();
  decayEnv(g, t, ev.vel * p.gain, d);
  n.connect(filter(ctx, 'highpass', p.freq)).connect(g).connect(out);
}

// ---- Subtractive synth (bass / pad / lead / arp / anything tonal) ----------
// p = { osc:[{type, detune, mult, gain}], filter:{type,freq,q,env,decay},
//       amp:{a,d,s,r}, vibrato:{rate,depth}, gain }

function synth(ctx, out, t, ev, p) {
  const { a = 0.01, d = 0.2, s = 0.6, r = 0.2 } = p.amp || {};
  const dur = Math.max(ev.dur, a + 0.02);
  const end = t + dur;
  const peak = ev.vel * (p.gain ?? 0.2);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + a);
  amp.gain.setTargetAtTime(peak * s, t + a, d / 3);
  amp.gain.setTargetAtTime(0, end, r / 3);

  const fp = p.filter || {};
  const flt = filter(ctx, fp.type || 'lowpass', (fp.freq || 4000) + (fp.env || 0), fp.q || 0.7);
  if (fp.env) flt.frequency.setTargetAtTime(fp.freq || 4000, t, (fp.decay || 0.3) / 3);
  flt.connect(amp).connect(out);

  const stopAt = end + r * 1.5;
  let lfo;
  if (p.vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = p.vibrato.rate;
    lfo.start(t); lfo.stop(stopAt);
  }
  for (const spec of p.osc) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = spec.type;
    o.frequency.value = ev.freq * (spec.mult || 1);
    o.detune.value = spec.detune || 0;
    g.gain.value = spec.gain ?? 1;
    if (lfo) {
      const depth = ctx.createGain();
      depth.gain.value = p.vibrato.depth; // cents
      lfo.connect(depth).connect(o.detune);
    }
    o.connect(g).connect(flt);
    o.start(t); o.stop(stopAt);
  }
}

// Registry: styles reference these by name via role.kind. To add a new kind
// (e.g. a wobble bass), add a function here.
export const KINDS = { kick, snare, hat, synth };
