// song.js — builds a "song": every random choice that stays fixed while it plays
// (key, tempo, progression, voices, patterns, melodic motifs, title).
import { tools, CHORD_TYPES, scaleMidi } from './music.js';

// o = optional overrides: { key, bpm, progression, voices:{roleId:voiceName}, keep: previousSong }
// `keep` reuses the previous song's drum/bass/arp patterns and title.
export function makeSong(style, o = {}, rnd = Math.random) {
  const R = tools(rnd);
  const progression = o.progression || R.pick(style.progressions);
  const key = o.key ?? R.int(0, 11);
  const bpm = o.bpm ?? R.int(style.bpm.min, style.bpm.max);
  const voices = {}, patterns = {}, motifs = {};

  for (const role of style.roles) {
    voices[role.id] = role.voices.find(v => v.name === o.voices?.[role.id]) || R.pick(role.voices);
    if (role.patterns) patterns[role.id] = o.keep?.patterns[role.id] || R.pick(role.patterns);
    if (role.part === 'melody') {
      motifs[role.id] = progression.chords.map(ch => makeMotif(role, key, ch, progression.scale, R));
    }
  }
  const title = o.keep?.title || `${R.pick(style.names.adj)} ${R.pick(style.names.noun)}`;
  return { style, key, bpm, progression, voices, patterns, motifs, title };
}

// One 2-bar motif: {step: {midi, len}}. Starts on a chord tone, then mostly steps.
function makeMotif(role, key, chord, scale, R) {
  const pool = scaleMidi(key, scale, role.range[0], role.range[1]);
  const pcs = CHORD_TYPES[chord.t].map(i => (key + chord.r + i) % 12);
  const tones = pool.filter(m => pcs.includes(m % 12));
  const motif = {};
  let prev = R.pick(tones);
  R.pick(role.rhythms).forEach(([s, len], i) => {
    const near = pool.filter(m => Math.abs(m - prev) <= 4 && m !== prev);
    prev = i === 0 || !near.length || R.chance(0.3) ? R.pick(tones) : R.pick(near);
    motif[s] = { midi: prev, len };
  });
  return motif;
}
