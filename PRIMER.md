# Synth Radio — Design Primer

Paste this file at the start of a new chat to restore full context.

## What it is
A vanilla-JS PWA that procedurally generates electronic music in the browser with the Web Audio API. No samples, no libraries, no build step, no visuals (device is usually locked in a pocket). Hosted on GitHub Pages; used mainly on Android (Motorola), tested on localhost on a MacBook. iOS is not a target (cheap compatibility only).

Chillwave is the only style so far. Synthwave, Darksynth, Dubstep, etc. are planned, so **the engine must stay style-agnostic: a style is one data file.**

## Features
- **Manual mode**: pick style, key, chord progression, BPM, a voice per instrument, and a per-instrument level shown as `[ − ] [ +3 dB ] [ + ]` (3 dB steps, −24 to +12, below that = Off). Key/progression/BPM/voice changes apply live.
- **Radio mode**: endless auto-playing "songs" of ~3–4 min. Each song randomizes key, progression, BPM, voices and patterns. Intro adds instrument groups one phrase at a time in random order (random opener); main section has random 1–2 instrument dropouts for one phrase; outro removes groups in reverse until one remains, then ends. 1–2 s gap, then the next song. Stays in the selected style unless "hops between all styles" is on. If the user has set BPM, radio picks within ±5 BPM of it (clamped to the style's range). "Next song" button skips.
- Now-playing readout: generated title, key · BPM · progression, section/phrase, active instruments.
- Levels, style, mode, user BPM persist in localStorage.

## Hard constraints
- Everything synthesized; offline-capable; readable, un-minified code.
- **All phrasing is in 2-bar increments**: 1 phrase = 32 sixteenth-steps; one chord per phrase; a 4-chord progression = 8 bars.
- No visuals/analyser (battery).

## File map
```
index.html, manifest.json, sw.js, css/style.css, PRIMER.md
app-icons/app-icon-192.png, app-icon-512.png   (user supplies)
js/app.js               UI, state, mode logic, radio loop
js/engine/music.js      scales, chord types, MIDI helpers, random tools
js/engine/instruments.js generic sound "kinds": kick, snare, hat, synth
js/engine/audio.js      AudioContext, master + compressor, per-role channels, reverb/delay sends
js/engine/parts.js      pattern → note events: drum, bass, chord, arp, melody
js/engine/song.js       makeSong(): key, bpm, progression, voices, patterns, melody motifs, title
js/engine/radio.js      planRadio(): intro/main/outro plan + arranger
js/engine/sequencer.js  look-ahead scheduler (Worker ticker, 100 ms tick, 0.5 s lookahead, swing)
js/styles/index.js      registry (array of styles)
js/styles/chillwave.js  the style data
```

## Data flow
`style` (data) → `makeSong()` fixes all random choices → `Sequencer` asks an **arranger** `(phraseIndex) → {chord, active:Set<roleId>, section} | null` at each phrase boundary → for each active role, `PARTS[role.part]` yields events → `engine.play()` uses `KINDS[role.kind]` with the chosen voice preset into that role's channel. Manual mode's arranger loops forever with everything active; radio's returns the planned list then `null` (song over → tail → onEnd → next song).

## Style schema
```
{ id, name, bpm:{min,max,def}, swing, names:{adj[],noun[]},
  fx:{ reverb:{seconds,decay}, delay:{beats,feedback,lp} },
  progressions:[{ name, scale, chords:[{r: semitones from key, t: chord type}] }],   // 1 chord = 1 phrase
  roles:[{ id, label, part, kind, mix(dB default), send:{rev,dly},
           patterns:[strings], voices:[{name, p:{preset params}}],
           range, rhythms }],                                  // range/rhythms: melody parts only
  radio:{ groups, openers, dropout, decorate?(plan,{song,R,groups}) } }
```
- Pattern strings: 16 chars (one bar, cycles) or 32 (two bars). drum: `x` hit, `g` ghost, `o` open hat. bass: `r` root, `5` fifth, `o` octave. arp: digits = chord-tone index (wraps up octaves). `.` = rest.
- `part` ∈ drum | bass | chord | arp | melody (parts.js). `kind` ∈ kick | snare | hat | synth (instruments.js). Synth preset: `{osc:[{type,gain,detune,mult}], filter:{type,freq,q,env,decay}, amp:{a,d,s,r}, vibrato:{rate,depth}, gain}`.
- Chord types and scales live in music.js and can be extended.

## Adding a style
1. Create `js/styles/<name>.js` following the schema. 2. Import and add to the array in `js/styles/index.js`. 3. Add the file to `ASSETS` in `sw.js` and bump `CACHE`.
New behaviours (wobble bass, risers, impacts) → add a function to `PARTS` and/or `KINDS`, then reference by name. Dubstep builds/drops → use `radio.decorate(plan, …)` to rewrite phrases (e.g. add `section:'Build'`, `'Drop'`, change `active`).

## Roadmap / ideas
- Styles: Synthwave, Darksynth, Dubstep (builds + drops via decorate hook).
- Lock-screen/Bluetooth controls via Media Session API. Android generally needs a real (silent, looping) `<audio>` element playing for the notification to appear; Web Audio alone won't show one. Wire play/pause/nexttrack to `play()/stop()/#next`.
- Wake lock, background-audio hardening on Android.
- Mix tuning by ear (preset `gain` values and role `mix` defaults are first guesses, untested by listening).

## Gotchas
- Bump `CACHE` in sw.js on every deploy. The SW is bypassed on `localhost`.
- AudioContext is created on the first Play tap and discarded on Stop (clears scheduled notes; saves battery).
- Chord changes in manual mode rebuild the song but keep drum/bass/arp patterns.
