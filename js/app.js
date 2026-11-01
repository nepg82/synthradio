// app.js — UI + glue. Holds app state; the engine does the audio.
import { STYLES } from './styles/index.js';
import { AudioEngine, MIN_DB } from './engine/audio.js';
import { Sequencer } from './engine/sequencer.js';
import { makeSong } from './engine/song.js';
import { planRadio } from './engine/radio.js';
import { KEY_NAMES } from './engine/music.js';
import { initMediaSession } from './mediasession.js';

const $ = s => document.querySelector(s);
const STEP_DB = 3, MAX_DB = 12, OFF_DB = MIN_DB - STEP_DB;
const fmtDb = db => (db < MIN_DB ? 'Off' : `${db > 0 ? '+' : ''}${db} dB`);

// ---- State ------------------------------------------------------------------
const saved = (() => { try { return JSON.parse(localStorage.getItem('synthradio')) || {}; } catch { return {}; } })();
const state = {
  mode: saved.mode || 'manual',
  styleId: saved.styleId || STYLES[0].id,
  allStyles: !!saved.allStyles,
  levels: saved.levels || {},          // { styleId: { roleId: dB } }
  userBpm: saved.userBpm || null,      // set once the user touches BPM
  bpm: 0, key: Math.floor(Math.random() * 12), prog: 0, voices: {},
  song: null, playing: false, paused: false,
};
const save = () => {
  const { mode, styleId, allStyles, levels, userBpm } = state;
  try { localStorage.setItem('synthradio', JSON.stringify({ mode, styleId, allStyles, levels, userBpm })); } catch {}
};

const style = () => STYLES.find(s => s.id === state.styleId) || STYLES[0];
const levelsFor = st => (state.levels[st.id] ||= Object.fromEntries(st.roles.map(r => [r.id, r.mix])));

const engine = new AudioEngine();
const seq = new Sequencer(engine, { onPhrase, onEnd });
let gapTimer;
const session = initMediaSession({
  onPlay: () => (state.paused ? resume() : !state.playing && play()),
  onPause: pause,
  onStop: stop,
  onNext: nextSong,
});

// ---- Playback ---------------------------------------------------------------
async function play() {
  seq.open();
  session.start(); // must run synchronously inside the tap
  await engine.start();
  const ctx = engine.ctx;
  
  ctx.onstatechange = () => {
    // If the system suspends us while we should be playing, try to resume.
    if (ctx === engine.ctx && ctx.state !== 'running' && ctx.state !== 'closed' && state.playing && !state.paused) {
      ctx.resume().catch(() => {});
    }
  };
  
  engine.setStyle(style(), levelsFor(style()));
  state.playing = true; state.paused = false;
  state.mode === 'radio' ? nextRadio() : startManual();
  renderTransport();
}

function stop() {
  clearTimeout(gapTimer);
  seq.close(); engine.stop(); session.stop();
  state.playing = false; state.paused = false;
  renderTransport();
}

// Lock screen / Bluetooth pause: freeze the audio clock so resume continues mid-phrase.
function pause() {
  if (!state.playing || state.paused || !engine.ctx) return;
  state.paused = true;
  engine.ctx.suspend();
  session.pause();
  renderTransport();
}

async function resume() {
  if (!state.paused || !engine.ctx) return;
  state.paused = false;
  session.start();
  await engine.ctx.resume();
  renderTransport();
}

// Radio "Next song": finish the phrase, then end like a natural song end.
function nextSong() {
  if (!state.playing || state.mode !== 'radio') return;
  if (state.paused) resume();
  if (seq.endAfterPhrase()) {
    $('#section').textContent = 'Ending song…';
  } else { // already in the tail or the gap between songs: just move on
    clearTimeout(gapTimer);
    seq.stop();
    nextRadio();
  }
}

const restart = async () => { if (state.playing) { stop(); await play(); } };

function manualOpts(keep) {
  const st = style();
  return { key: state.key, bpm: state.bpm, progression: st.progressions[state.prog], voices: state.voices, keep };
}

function startManual() {
  const st = style();
  const song = makeSong(st, manualOpts());
  adopt(song);
  const all = new Set(st.roles.map(r => r.id));
  seq.start(song, i => ({ chord: i, active: all, section: 'Jam' }));
}

function nextRadio(startAt) {
  if (!state.playing) return;
  if (state.allStyles) {
    const pick = STYLES[Math.floor(Math.random() * STYLES.length)];
    if (pick.id !== state.styleId) selectStyle(pick.id);
  }
  const { song, arranger } = planRadio(style(), state.userBpm);
  adopt(song);
  seq.start(song, arranger, startAt);
}

function onEnd(startAt) {
  if (state.playing && state.mode === 'radio') nextRadio(startAt);
  else seq.stop();
}

// Make a song the current one and mirror its choices into state/UI.
function adopt(song) {
  state.song = song;
  session.setTrack(song);
  state.key = song.key; state.bpm = song.bpm;
  state.prog = song.style.progressions.indexOf(song.progression);
  for (const [id, v] of Object.entries(song.voices)) state.voices[id] = v.name;
  syncControls();
}

function onPhrase(p, i) {
  const st = style();
  $('#section').textContent = `${p.section} · phrase ${i + 1}`;
  $('#active').textContent = st.roles.filter(r => p.active.has(r.id)).map(r => r.label).join(', ');
}

// ---- Controls ---------------------------------------------------------------
function selectStyle(id) {
  state.styleId = id;
  const st = style();
  state.voices = {}; state.prog = 0; state.bpm = state.userBpm || st.bpm.def;
  renderStyle();
  if (engine.ctx) engine.setStyle(st, levelsFor(st));
  save();
}

// Key/progression change in manual mode: rebuild the song live, keeping patterns.
function rebuild() {
  if (!state.playing || state.mode !== 'manual') return;
  const song = makeSong(style(), manualOpts(state.song));
  state.song = song; seq.song = song;
}

function setBpm(bpm) {
  const st = style();
  state.bpm = state.userBpm = Math.max(st.bpm.min - 10, Math.min(st.bpm.max + 10, bpm));
  if (state.song) { state.song.bpm = state.bpm; if (engine.ctx) engine.setTempo(state.bpm); }
  $('#bpm').textContent = state.bpm;
  save();
}

function setMode(mode) {
  state.mode = mode; save();
  renderMode();
  restart();
}

// ---- Rendering --------------------------------------------------------------
function renderMode() {
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  $('#all-styles-row').hidden = state.mode !== 'radio';
  $('#next').hidden = state.mode !== 'radio';
  session.setRadio(state.mode === 'radio');
}

function renderTransport() {
  $('#play').textContent = !state.playing ? 'Play' : state.paused ? 'Resume' : 'Stop';
  if (!state.playing) { $('#section').textContent = 'Stopped'; $('#active').textContent = ''; }
}

function renderStyle() {
  const st = style();
  $('#style').innerHTML = STYLES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('#style').value = st.id;
  $('#prog').innerHTML = st.progressions.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
  $('#key').innerHTML = KEY_NAMES.map((k, i) => `<option value="${i}">${k}</option>`).join('');

  const lv = levelsFor(st);
  $('#mixer').innerHTML = st.roles.map(r => `
    <div class="row" data-role="${r.id}">
      <span class="name">${r.label}</span>
      <select class="voice" aria-label="${r.label} voice">${r.voices.map(v => `<option>${v.name}</option>`).join('')}</select>
      <div class="level">
        <button data-d="-1" aria-label="${r.label} quieter">−</button>
        <output>${fmtDb(lv[r.id])}</output>
        <button data-d="1" aria-label="${r.label} louder">+</button>
      </div>
    </div>`).join('');
  if (!state.bpm) state.bpm = state.userBpm || st.bpm.def;
  syncControls();
}

function syncControls() {
  const st = style();
  $('#bpm').textContent = state.bpm;
  $('#key').value = state.key;
  $('#prog').value = state.prog;
  document.querySelectorAll('.row').forEach(row => {
    const name = state.voices[row.dataset.role];
    if (name) row.querySelector('.voice').value = name;
  });
  const song = state.song;
  $('#title').textContent = song ? song.title : 'Ready';
  $('#meta').textContent = song ? `${KEY_NAMES[song.key]} · ${song.bpm} BPM · ${song.progression.name}` : st.name;
}

// ---- Events -----------------------------------------------------------------
$('#play').onclick = () => (state.paused ? resume() : state.playing ? stop() : play());
$('#next').onclick = nextSong;
$('#style').onchange = e => { selectStyle(e.target.value); restart(); };
$('#key').onchange = e => { state.key = +e.target.value; rebuild(); };
$('#prog').onchange = e => { state.prog = +e.target.value; rebuild(); };
$('#bpm-down').onclick = () => setBpm(state.bpm - 1);
$('#bpm-up').onclick = () => setBpm(state.bpm + 1);
$('#all-styles').onchange = e => { state.allStyles = e.target.checked; save(); };
document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => setMode(b.dataset.mode)));

$('#mixer').addEventListener('change', e => {
  if (!e.target.matches('.voice')) return;
  const id = e.target.closest('.row').dataset.role, role = style().roles.find(r => r.id === id);
  state.voices[id] = e.target.value;
  if (state.song) state.song.voices[id] = role.voices.find(v => v.name === e.target.value); // live swap
});

$('#mixer').addEventListener('click', e => {
  const btn = e.target.closest('button[data-d]');
  if (!btn) return;
  const row = btn.closest('.row'), id = row.dataset.role, lv = levelsFor(style());
  lv[id] = Math.max(OFF_DB, Math.min(MAX_DB, lv[id] + btn.dataset.d * STEP_DB));
  row.querySelector('output').textContent = fmtDb(lv[id]);
  engine.setLevel(id, lv[id]);
  save();
});

// ---- Init -------------------------------------------------------------------
$('#all-styles').checked = state.allStyles;
selectStyle(state.styleId);
renderMode();
renderTransport();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');