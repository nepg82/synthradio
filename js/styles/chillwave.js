// chillwave.js — a style is plain data. See PRIMER.md for the full schema.
// Pattern strings are 16 (one bar, repeated) or 32 (two bars) characters.

const c = (r, t) => ({ r, t }); // chord: root offset in semitones from the key, chord type

const osc = (type, gain = 1, detune = 0, mult = 1) => ({ type, gain, detune, mult });

// Intro/outro groups: roles that enter (or leave) together.
const G = { pad: ['pad'], drums: ['kick', 'hat'], bass: ['bass'], arp: ['arp'], snare: ['snare'], lead: ['lead'] };

export default {
  id: 'chillwave',
  name: 'Chillwave',
  bpm: { min: 82, max: 108, def: 94 },
  swing: 0.14, // delay on off-beat 16ths, as a fraction of a 16th

  names: {
    adj: ['Hazy', 'Neon', 'Faded', 'Velvet', 'Sunlit', 'Distant', 'Pastel', 'Lucid', 'Warm', 'Tidal'],
    noun: ['Tides', 'Polaroid', 'Boulevard', 'Summer', 'Static', 'Daydream', 'Horizon', 'Cassette', 'Mirage', 'Lagoon'],
  },

  fx: {
    reverb: { seconds: 3.2, decay: 2.5 },
    delay: { beats: 0.75, feedback: 0.38, lp: 2500 },
  },

  // Each chord lasts one phrase (2 bars), so a progression is 8 bars.
  progressions: [
    { name: 'Hazy Dream',     scale: 'minor',  chords: [c(0, 'min9'), c(8, 'maj7'), c(3, 'maj7'), c(10, 'add9')] },
    { name: 'Sunset Drive',   scale: 'major',  chords: [c(0, 'maj7'), c(5, 'maj7'), c(9, 'min7'), c(7, 'add9')] },
    { name: 'Faded Polaroid', scale: 'minor',  chords: [c(0, 'min7'), c(5, 'min7'), c(8, 'maj7'), c(7, 'dom7')] },
    { name: 'Tape Warp',      scale: 'major',  chords: [c(9, 'min7'), c(5, 'maj7'), c(0, 'maj7'), c(7, 'add9')] },
    { name: 'Neon Haze',      scale: 'dorian', chords: [c(0, 'min7'), c(5, 'dom7'), c(0, 'min7'), c(10, 'maj7')] },
  ],

  // part → how notes are generated (engine/parts.js); kind → sound generator (engine/instruments.js)
  roles: [
    {
      id: 'kick', label: 'Kick', part: 'drum', kind: 'kick', mix: 0,
      patterns: ['x.......x.x.....x.......x...x...', 'x...x...x...x...', 'x.....x...x.....'],
      voices: [
        { name: 'Soft Thump', p: { f0: 130, f1: 48, sweep: 0.12, decay: 0.5, gain: 0.9, lp: 600, click: 0.15 } },
        { name: 'Deep Tape',  p: { f0: 90,  f1: 42, sweep: 0.2,  decay: 0.7, gain: 0.9, lp: 300 } },
        { name: 'Punchy',     p: { f0: 170, f1: 50, sweep: 0.07, decay: 0.4, gain: 0.9, click: 0.3 } },
      ],
    },
    {
      id: 'snare', label: 'Snare', part: 'drum', kind: 'snare', mix: -3, send: { rev: 0.25 },
      patterns: ['....x.......x...', '....x..g....x...', '....x.......x.......x.......x..x'],
      voices: [
        { name: 'Clap',       p: { clap: true, noiseFreq: 1500, q: 1, decay: 0.25, gain: 0.5 } },
        { name: 'Soft Snare', p: { noiseFreq: 2200, decay: 0.22, gain: 0.45, tone: 190, toneDecay: 0.12, toneGain: 0.4 } },
        { name: 'Rim',        p: { noiseFreq: 3500, decay: 0.08, gain: 0.4, tone: 420, toneDecay: 0.05, toneGain: 0.5 } },
      ],
    },
    {
      id: 'hat', label: 'Hats', part: 'drum', kind: 'hat', mix: -6, send: { rev: 0.1 },
      patterns: ['x.x.x.x.x.x.x.xo', 'x.gxx.gxx.gxx.gx', '..x...x...x...x.'],
      voices: [
        { name: 'Crisp', p: { freq: 7500, decay: 0.04, openDecay: 0.25, gain: 0.35 } },
        { name: 'Dusty', p: { freq: 5000, decay: 0.06, openDecay: 0.3, gain: 0.4 } },
      ],
    },
    {
      id: 'bass', label: 'Bass', part: 'bass', kind: 'synth', mix: 0,
      patterns: ['r..r..r...r.....', 'r.......r.....5.', 'r...o...r...o...'],
      voices: [
        { name: 'Sub Sine', p: { osc: [osc('sine'), osc('triangle', 0.15, 0, 2)], filter: { freq: 800 }, amp: { a: 0.01, d: 0.2, s: 0.8, r: 0.15 }, gain: 0.5 } },
        { name: 'Warm Saw', p: { osc: [osc('sawtooth', 0.6), osc('sine', 0.6, 0, 0.5)], filter: { freq: 500, env: 800, decay: 0.2 }, amp: { a: 0.01, d: 0.3, s: 0.7, r: 0.15 }, gain: 0.3 } },
        { name: 'Pluck',    p: { osc: [osc('sawtooth', 0.6), osc('sine', 0.7)], filter: { freq: 350, env: 1500, decay: 0.12 }, amp: { a: 0.005, d: 0.25, s: 0.3, r: 0.1 }, gain: 0.4 } },
      ],
    },
    {
      id: 'pad', label: 'Pad', part: 'chord', kind: 'synth', mix: -3, send: { rev: 0.6 },
      voices: [
        { name: 'Lush Saws',    p: { osc: [osc('sawtooth', 0.33, -12), osc('sawtooth', 0.33), osc('sawtooth', 0.33, 12)], filter: { freq: 1400, q: 0.5 }, amp: { a: 0.9, d: 0.5, s: 0.8, r: 1.4 }, gain: 0.1 } },
        { name: 'Glass',        p: { osc: [osc('triangle', 0.6, -6), osc('triangle', 0.6, 6), osc('sine', 0.4, 0, 2)], filter: { freq: 3500 }, amp: { a: 0.6, d: 0.5, s: 0.8, r: 1.2 }, gain: 0.13 } },
        { name: 'Warm Strings', p: { osc: [osc('sawtooth', 0.4, -8), osc('sawtooth', 0.4, 8)], filter: { freq: 900, env: 600, decay: 1.5 }, amp: { a: 1.0, d: 0.6, s: 0.8, r: 1.5 }, gain: 0.11 } },
        { name: 'Dream Choir',  p: { osc: [osc('sine'), osc('triangle', 0.4, 7, 2), osc('sine', 0.15, 0, 3)], filter: { freq: 3000 }, vibrato: { rate: 5, depth: 8 }, amp: { a: 0.8, d: 0.5, s: 0.85, r: 1.3 }, gain: 0.15 } },
      ],
    },
    {
      id: 'lead', label: 'Lead', part: 'melody', kind: 'synth', mix: -3, send: { rev: 0.5, dly: 0.45 },
      range: [64, 81],
      rhythms: [
        [[0, 4], [6, 2], [8, 6], [16, 4], [22, 2], [24, 8]],
        [[0, 6], [8, 4], [12, 4], [16, 8], [28, 4]],
        [[2, 4], [8, 2], [10, 6], [18, 4], [24, 6]],
      ],
      voices: [
        { name: 'Dreamy Square', p: { osc: [osc('square', 0.5), osc('square', 0.5, 8)], filter: { freq: 2200 }, vibrato: { rate: 5.5, depth: 10 }, amp: { a: 0.03, d: 0.3, s: 0.6, r: 0.5 }, gain: 0.12 } },
        { name: 'Soft Saw',      p: { osc: [osc('sawtooth')], filter: { freq: 1800, env: 1500, decay: 0.3 }, amp: { a: 0.02, d: 0.3, s: 0.6, r: 0.4 }, gain: 0.13 } },
        { name: 'Bell Pluck',    p: { osc: [osc('sine'), osc('sine', 0.3, 0, 3.5)], filter: { freq: 5000 }, amp: { a: 0.005, d: 0.8, s: 0, r: 0.6 }, gain: 0.25 } },
        { name: 'Tape Sine',     p: { osc: [osc('sine'), osc('triangle', 0.2, 0, 2)], filter: { freq: 3000 }, vibrato: { rate: 4.5, depth: 15 }, amp: { a: 0.05, d: 0.3, s: 0.7, r: 0.5 }, gain: 0.2 } },
      ],
    },
    {
      id: 'arp', label: 'Arp', part: 'arp', kind: 'synth', mix: -6, send: { rev: 0.3, dly: 0.4 },
      patterns: ['0.1.2.3.2.1.0.1.', '0.12.3.21.0.12.3', '0123210301232103', '0.2.4.5.4.2.1.0.'],
      voices: [
        { name: 'Pluck',       p: { osc: [osc('sawtooth')], filter: { freq: 1500, env: 3000, decay: 0.12 }, amp: { a: 0.005, d: 0.15, s: 0, r: 0.1 }, gain: 0.14 } },
        { name: 'Glassy',      p: { osc: [osc('triangle'), osc('sine', 0.5, 0, 2)], filter: { freq: 6000 }, amp: { a: 0.005, d: 0.3, s: 0, r: 0.2 }, gain: 0.18 } },
        { name: 'Soft Square', p: { osc: [osc('square')], filter: { freq: 1800, env: 1200, decay: 0.1 }, amp: { a: 0.005, d: 0.2, s: 0, r: 0.15 }, gain: 0.1 } },
      ],
    },
  ],

  radio: {
    groups: [G.pad, G.drums, G.bass, G.arp, G.snare, G.lead],
    openers: [G.pad, G.drums, G.arp], // one of these enters first
    dropout: 0.35,                    // chance a main-section phrase loses 1–2 roles
    // decorate(plan, { song, R, groups }) — optional hook to add builds/drops etc.
  },
};
