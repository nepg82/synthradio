// radio.js — plans a whole radio "song": intro → main → outro.
// Returns { song, arranger }. arranger(phraseIndex) → { chord, active:Set, section }
// or null when the song is over. One phrase = 2 bars.
import { tools } from './music.js';
import { makeSong } from './song.js';

export function planRadio(style, userBpm, rnd = Math.random) {
  const R = tools(rnd), cfg = style.radio;

  // Tempo: random in the style's range, or within ±5 of the user's setting.
  const bpm = userBpm
    ? Math.min(style.bpm.max, Math.max(style.bpm.min, userBpm + R.int(-5, 5)))
    : undefined;
  const song = makeSong(style, { bpm }, rnd);

  // Intro order: a random opener first, then the remaining groups shuffled.
  const opener = R.pick(cfg.openers);
  const groups = [opener, ...R.shuffle(cfg.groups.filter(g => g !== opener))];
  const G = groups.length, allRoles = style.roles.map(r => r.id);
  const upTo = n => new Set(groups.slice(0, n).flat());

  // Length: ~3–4 minutes, with the main section a multiple of one progression.
  const phraseSec = (8 * 60) / song.bpm;
  const total = Math.round(R.int(180, 240) / phraseSec);
  const mainLen = Math.max(8, Math.round((total - 2 * G + 1) / 4) * 4);

  const plan = [];
  for (let i = 1; i <= G; i++) plan.push({ section: 'Intro', active: upTo(i) });
  for (let i = 0; i < mainLen; i++) {
    const active = new Set(allRoles);
    const edge = i === 0 || i === mainLen - 1;
    if (!edge && R.chance(cfg.dropout)) { // random dropout for one phrase
      R.shuffle(allRoles).slice(0, R.chance(0.3) ? 2 : 1).forEach(r => active.delete(r));
    }
    plan.push({ section: 'Main', active });
  }
  for (let i = G - 1; i >= 1; i--) plan.push({ section: 'Outro', active: upTo(i) });
  plan.forEach((p, i) => (p.chord = i));

  cfg.decorate?.(plan, { song, R, groups }); // style hook: builds, drops, breakdowns…
  return { song, arranger: i => plan[i] || null };
}
