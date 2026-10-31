// music.js — pure music theory + random helpers. No audio, no DOM.

export const SCALES = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

// Intervals in semitones from the chord root.
export const CHORD_TYPES = {
  maj:  [0, 4, 7],        min:  [0, 3, 7],
  sus2: [0, 2, 7],        sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],    min7: [0, 3, 7, 10],   dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],    maj9: [0, 4, 7, 11, 14], min9: [0, 3, 7, 10, 14],
};

export const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const mtof = m => 440 * 2 ** ((m - 69) / 12);
export const dbToGain = db => 10 ** (db / 20);

// Random helpers bound to a random function (swap in a seeded one if ever needed).
export function tools(rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const chance = p => rnd() < p;
  const shuffle = a => {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  return { rnd, pick, int, chance, shuffle };
}

// Lowest MIDI note >= lo that has pitch class `pc`.
export const fold = (pc, lo) => lo + (((pc - lo) % 12) + 12) % 12;

// MIDI notes of a chord, root placed in [lo, lo+11].
export function chordMidi(key, chord, lo) {
  const root = fold(key + chord.r, lo);
  return CHORD_TYPES[chord.t].map(i => root + i);
}

// All MIDI notes of a scale between lo and hi (inclusive).
export function scaleMidi(key, scale, lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) {
    if (SCALES[scale].includes((((m - key) % 12) + 12) % 12)) out.push(m);
  }
  return out;
}
