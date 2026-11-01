// audio.js — owns the AudioContext, master bus, per-role channels and shared FX.
import { dbToGain } from './music.js';
import { KINDS } from './instruments.js';

export const MIN_DB = -24; // anything below this is "Off"
const levelGain = db => (db < MIN_DB ? 0 : dbToGain(db));

function impulse(ctx, seconds, decay) {
  const n = (ctx.sampleRate * seconds) | 0;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  for (let c = 0; c < 1; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
  }
  return buf;
}

export class AudioEngine {
  ctx = null;
  channels = {};
  nodes = [];
  styleId = null;

  // Must be called from a user gesture the first time.
  async start() {
    if (!this.ctx) {
      const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' }));
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(comp).connect(ctx.destination);
      this.styleId = null;
      this.nodes = [];
      this.songGains = {};
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  // Fade out and discard the context (clears any already-scheduled notes).
  stop() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ctx = null; this.channels = {};
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    setTimeout(() => ctx.close(), 400);
  }

  // Build reverb, delay and one channel per role for a style.
  setStyle(style, levels) {
    if (this.styleId === style.id) return;
    const ctx = this.ctx, fx = style.fx;
    this.nodes.forEach(n => n.disconnect());
    this.nodes = [];
    const keep = n => (this.nodes.push(n), n);

    const rev = null; // TEST: convolver disabled (heaviest node in the graph)

    const dly = (this.dly = keep(ctx.createDelay(4)));
    const fb = keep(ctx.createGain()); fb.gain.value = fx.delay.feedback;
    const lp = keep(ctx.createBiquadFilter()); lp.frequency.value = fx.delay.lp;
    this.delayBeats = fx.delay.beats;
    dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(this.master);

    this.channels = {};
    for (const role of style.roles) {
      const input = keep(ctx.createGain());
      input.gain.value = levelGain(levels[role.id]);
      input.connect(this.master);
      const send = (dest, amt) => {
        if (!amt || !dest) return;
        const g = keep(ctx.createGain()); g.gain.value = amt;
        input.connect(g); g.connect(dest);
      };
      send(rev, role.send?.rev);
      send(dly, role.send?.dly);
      this.channels[role.id] = input;
    }
    this.styleId = style.id;
  }

  setLevel(roleId, db) {
    const ch = this.channels[roleId];
    if (ch) ch.gain.setTargetAtTime(levelGain(db), this.ctx.currentTime, 0.02);
  }

  setTempo(bpm) {
    if (this.dly) this.dly.delayTime.setTargetAtTime((60 / bpm) * this.delayBeats, this.ctx.currentTime, 0.1);
  }

  // A fresh gain stage per role for each song, so a song can be faded out as a unit.
  newSong() {
    const old = this.songGains || {};
    setTimeout(() => Object.values(old).forEach(g => g.disconnect()), 15000);
    this.songGains = {};
    for (const [id, ch] of Object.entries(this.channels)) {
      const g = this.ctx.createGain();
      g.connect(ch);
      this.songGains[id] = g;
    }
  }

  // Fade the current song to silence, finishing exactly at audio time `at`.
  fadeSong(at, dur = 0.2) {
    for (const g of Object.values(this.songGains)) {
      g.gain.setValueAtTime(1, Math.max(at - dur, this.ctx.currentTime));
      g.gain.linearRampToValueAtTime(0, at);
    }
  }

  play(role, t, ev, voice) {
    KINDS[role.kind](this.ctx, this.songGains[role.id], t, ev, voice.p);
  }
}
