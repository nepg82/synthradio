// sequencer.js — look-ahead scheduler. Steps are 16th notes; a phrase is 32 steps (2 bars).
// A ticker (Web Worker, so it isn't throttled as hard when the screen is off)
// wakes every 100 ms and schedules audio ~0.5 s ahead of the clock.
import { PARTS } from './parts.js';

const STEPS = 32, LOOKAHEAD = 1.2, TICK_MS = 250, TAIL_S = 2.5;

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
  constructor(engine, { onPhrase, onEnd }) {
    this.engine = engine;
    this.cb = { onPhrase, onEnd };
  }

  // startAt (audio-clock seconds) lets a new song begin exactly when the gap ends.
  start(song, arranger, startAt) {
    this.stop();
    this.endPending = false;
    this.late = 0;
    this.gapUntil = null;
    this.song = song;
    this.arranger = arranger;
    this.step = 0;
    this.next = Math.max(startAt ?? 0, this.engine.ctx.currentTime + 0.1);
    this.engine.setTempo(song.bpm);
    this.cancel = makeTicker(() => this.tick(), TICK_MS);
    this.tick(); // schedule immediately instead of waiting for the first tick
  }
  
  stop() {
    this.cancel?.(); this.cancel = null;
    clearTimeout(this.endTimer);
  }

  // Radio "Next song": let the current phrase finish, then end like a natural song end.
  // Returns false if nothing is currently scheduling, so the caller can skip immediately.
  endAfterPhrase() {
    if (!this.cancel || this.gapUntil !== null) return false;
    this.endPending = true;
    return true;
  }

  tick() {
    const ctx = this.engine.ctx;
    if (!ctx) return;
    
    if (this.gapUntil !== null) { // song over: wait on the audio clock, then hand off
      if (ctx.currentTime + LOOKAHEAD >= this.gapUntil) {
        const at = this.gapUntil;
        this.gapUntil = null;
        this.cb.onEnd(at);
      }
      return;
    }
    
    while (this.cancel && this.next < ctx.currentTime + LOOKAHEAD) {
      if (this.next < ctx.currentTime) this.late++; // DEBUG: a step scheduled after its start time
      const song = this.song, s = this.step % STEPS, stepDur = 60 / song.bpm / 4;
      if (s === 0) {
        const idx = this.step / STEPS;
        this.phrase = this.endPending ? null : this.arranger(idx);
        if (!this.phrase) return this.finish();
        this.cb.onPhrase(this.phrase, idx);
      }
      const swing = s % 2 ? song.style.swing * stepDur : 0;
      this.playStep(s, this.next + swing, stepDur);
      this.next += stepDur;
      this.step++;
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

  // Song over: keep the ticker alive and let the tail ring plus a 1–2 s gap pass on the audio clock.
  finish() {
    this.gapUntil = this.next + TAIL_S + 1 + Math.random();
  }
}
