// mediasession.js — lock screen / notification / Bluetooth transport controls.
// A hidden, silent, looping <audio> element makes Android treat the page as a media player;
// the real music still comes from Web Audio. Nothing here touches the synth.

const ICONS = [
  { src: 'app-icons/app-icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: 'app-icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
];

// 10 s of near-silence (±1 LSB, inaudible). Under ~5 s Chrome ignores the media for
// notifications, and pure digital zero can be treated as "not playing".
function silentWavUrl(seconds = 10, rate = 8000) {
  const n = seconds * rate, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i % 2 ? 1 : -1, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function initMediaSession({ onPlay, onPause, onStop, onNext, onLog }) {
  const audio = new Audio(silentWavUrl());
  audio.loop = true;
  ['play', 'pause', 'waiting', 'stalled', 'ended', 'error'].forEach(ev =>
    audio.addEventListener(ev, () => onLog?.(`silent el ${ev}`)));
  const ms = navigator.mediaSession;

  const handler = (action, fn) => {
    try { ms?.setActionHandler(action, fn); } catch { /* action unsupported */ }
  };
  handler('play', onPlay);
  handler('pause', onPause);
  handler('stop', onStop);

  return {
    // Call synchronously inside a tap (or a media-session action).
    start() {
      audio.play().catch(() => {});
      if (ms) ms.playbackState = 'playing';
    },
    pause() {
      audio.pause();
      if (ms) ms.playbackState = 'paused';
    },
    stop() {
      audio.pause();
      if (ms) ms.playbackState = 'none';
    },
    // Page became visible: if the system paused our silent element, start it again.
    kick() {
      if (audio.paused) audio.play().catch(() => {});
    },
    setTrack(song) {
      if (!ms) return;
      ms.metadata = new MediaMetadata({
        title: song.title,
        artist: song.style.name,
        album: 'Synth Radio',
        artwork: ICONS,
      });
    },
    // "Next track" only makes sense in Radio mode.
    setRadio(isRadio) { handler('nexttrack', isRadio ? onNext : null); },
  };
}