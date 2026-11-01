// sequencer.js — look-ahead scheduler. Steps are 16th notes; a phrase is 32 steps (2 bars).
// A Web Worker ticks every 250 ms for the whole play session. Each tick schedules audio ahead of
// the audio clock: 1.2 s while the page is visible, 45 s while hidden (so a frozen or throttled
// page keeps playing from the audio thread's queue).
import { PARTS } from './parts.js';

const STEPS = 32, TICK_MS = 250, TAIL_S = 2.5;
const LOOKAHEAD_VISIBLE = 1.2, LOOKAHEAD_HIDDEN = 45;

function makeTicker(fn, ms) {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms})`]));
    const w = new Worker(url);
    w.onmessage = fn;
    return () => { w.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

export class Sequencer {
  active = false;       // a song is being scheduled (or is in its end gap)
  gapUntil = null;      // audio-clock time when the end-of-song gap finishes
  endAt = null;         // audio-clock time a "Next song" fade ends the song
  phraseStarts = [];    // audio-clock start times of scheduled phrases

  constructor(engine, { onPhrase, onEnd }) {
    this.engine = engine;
    this.cb = { onPhrase, onEnd };
  }

  // Ticker lives for the whole play session: open on Play, close on Stop.
  open() { this.closeTicker ||= makeTicker(() => this.tick(), TICK_MS); }
  close() { this.stop(); this.closeTicker?.(); this.closeTicker = null; }

  // arranger(phraseIndex) → { chord, active:Set<roleId>, section } | null (song over)
  // startAt (audio-clock seconds) lets a new song begin exactly when the gap ends.
  start(song, arranger, startAt) {
    this.open();
    this.song = song;
    this.arranger = arranger;
    this.step = 0;
    this.endAt = null;
    this.gapUntil = null;
    this.phraseStarts = [];
    this.next = Math.max(startAt ?? 0, this.engine.ctx.currentTime + 0.1);
    this.engine.newSong();
    this.engine.setTempo(song.bpm);
    this.active = true;
    this.tick(); // schedule immediately instead of waiting for the first tick
  }

  stop() { this.active = false; }

  // Radio "Next song": play to the end of the current phrase, fade out, then end like a
  // natural song end. Returns false if there's nothing to end (already in the gap).
  endAfterPhrase() {
    if (!this.active || this.gapUntil !== null) return false;
    if (this.endAt !== null) return true; // already ending
    const now = this.engine.ctx.currentTime + 0.25;
    let at = this.phraseStarts.find(t => t > now);
    if (at === undefined) { // no scheduled boundary ahead: compute the next one
      const stepDur = 60 / this.song.bpm / 4;
      at = this.next + ((STEPS - (this.step % STEPS)) % STEPS) * stepDur;
    }
    this.endAt = Math.max(at, now);
    this.engine.fadeSong(this.endAt);
    this.tick();
    return true;
  }

  tick() {
    const ctx = this.engine.ctx;
    if (!ctx || !this.active) return;

    // Song over: wait on the audio clock (no timers), then hand off to the next song.
    if (this.gapUntil !== null) {
      if (ctx.currentTime + LOOKAHEAD_VISIBLE >= this.gapUntil) {
        const at = this.gapUntil;
        this.gapUntil = null;
        this.cb.onEnd(at);
      }
      return;
    }

    // Woke up far behind (frozen page)? Skip to the next phrase instead of scheduling the past.
    if (this.next < ctx.currentTime - 0.5) {
      this.step += (STEPS - (this.step % STEPS)) % STEPS;
      this.next = ctx.currentTime + 0.1;
    }

    const look = document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD_VISIBLE;
    if (this.endAt !== null && this.next >= this.endAt) return this.finish(this.endAt);
    while (this.next < ctx.currentTime + look) {
      const song = this.song, s = this.step % STEPS, stepDur = 60 / song.bpm / 4;
      if (s === 0) {
        const idx = this.step / STEPS;
        this.phrase = this.arranger(idx);
        if (!this.phrase) return this.finish(this.next);
        this.phraseStarts.push(this.next);
        this.cb.onPhrase(this.phrase, idx);
      }
      const swing = s % 2 ? song.style.swing * stepDur : 0;
      this.playStep(s, this.next + swing, stepDur);
      this.next += stepDur;
      this.step++;
      if (this.endAt !== null && this.next >= this.endAt) return this.finish(this.endAt);
    }
  }

  playStep(s, t, stepDur) {
    const { song, phrase } = this;
    const ci = phrase.chord % song.progression.chords.length;
    const chord = song.progression.chords[ci];
    for (const role of song.style.roles) {
      if (!phrase.active.has(role.id)) continue;
      const events = PARTS[role.part]({ song, role, pat: song.patterns[role.id], s, chord, ci, stepDur });
      for (const ev of events) this.engine.play(role, t, ev, song.voices[role.id]);
    }
  }

  // Song over at audio time t: let the tail ring plus a 1–2 s gap pass on the audio clock.
  finish(t) {
    this.gapUntil = t + TAIL_S + 1 + Math.random();
  }
}