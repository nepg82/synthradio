// parts.js — turns a pattern + chord into note events for one 16th-note step.
// A style's role picks one via `part: 'drum' | 'bass' | 'chord' | 'arp' | 'melody'`.
// To add a new behaviour (e.g. a wobble bass), add a function here.
// Every part receives a context object c = { song, role, pat, s, chord, ci, stepDur }
//   s = step within the 2-bar phrase (0–31), ci = chord index in the progression.
import { chordMidi, mtof, fold } from './music.js';

// Steps from s until the next non-rest character (cyclic).
const hold = (pat, s) => {
  let n = 1;
  while (n < pat.length && pat[(s + n) % pat.length] === '.') n++;
  return n;
};

export const PARTS = {
  // x = hit, g = ghost (quiet), o = open (hats), . = rest
  drum({ pat, s }) {
    const ch = pat[s % pat.length];
    if (ch === '.') return [];
    return [{ vel: ch === 'g' ? 0.4 : 0.85 + Math.random() * 0.15, open: ch === 'o' }];
  },

  // r = root, 5 = fifth, o = octave up, . = rest. Notes hold until the next hit.
  bass({ song, pat, s, chord, stepDur }) {
    const off = { r: 0, 5: 7, o: 12 }[pat[s % pat.length]];
    if (off === undefined) return [];
    const root = fold(song.key + chord.r, 28);
    return [{ freq: mtof(root + off), dur: hold(pat, s) * stepDur * 0.92, vel: 1 }];
  },

  // Sustained chord, struck once per 2-bar phrase.
  chord({ song, s, chord, stepDur }) {
    if (s) return [];
    return chordMidi(song.key, chord, 55).map(m => ({ freq: mtof(m), dur: 32 * stepDur, vel: 0.8 }));
  },

  // Digits index into the chord tones (wrapping up an octave); . = rest.
  arp({ song, pat, s, chord, stepDur }) {
    const ch = pat[s % pat.length];
    if (ch === '.') return [];
    const tones = chordMidi(song.key, chord, 60), i = +ch;
    const note = tones[i % tones.length] + 12 * Math.floor(i / tones.length);
    return [{ freq: mtof(note), dur: stepDur * 1.5, vel: 0.8 }];
  },

  // Pre-generated motif per chord (see song.js).
  melody({ song, role, ci, s, stepDur }) {
    const n = song.motifs[role.id][ci][s];
    return n ? [{ freq: mtof(n.midi), dur: n.len * stepDur * 0.95, vel: 0.9 }] : [];
  },
};
