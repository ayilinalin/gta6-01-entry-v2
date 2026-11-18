// NEON TIDE v2 — procedural sound. Every effect is synthesized with
// WebAudio: no audio files, no network. Silent (but never crashing) when
// there is no audio device, as in a headless screenshot run.
export function createAudio() {
  const audio = { ctx: null, muted: false, engineOsc: null, engineGain: null, sirenTimer: 0 };
  audio.ensure = function ensure() {
    if (audio.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.25;
      audio.master.connect(audio.ctx.destination);
    } catch { /* no audio here */ }
  };
  audio.resume = function resume() {
    audio.ensure();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  };
  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    try {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), audio.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, audio.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
      o.connect(g); g.connect(audio.master);
      o.start(); o.stop(audio.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }
  function noise(dur, vol, low) {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = vol || 0.3;
      const f = audio.ctx.createBiquadFilter();
      f.type = low ? 'lowpass' : 'highpass';
      f.frequency.value = low ? 900 : 1200;
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start();
    } catch { /* ignore */ }
  }
  audio.click = () => tone(660, 0.06, 'square', 0.12);
  audio.pickup = () => { tone(880, 0.08, 'sine', 0.2); setTimeout(() => tone(1320, 0.1, 'sine', 0.2), 70); };
  audio.buy = () => { tone(520, 0.09, 'triangle', 0.2); setTimeout(() => tone(780, 0.12, 'triangle', 0.2), 90); };
  audio.shot = (w) => { noise(0.12, w === 'smg' ? 0.2 : 0.35, false); tone(160, 0.08, 'sawtooth', 0.15, 60); };
  audio.punch = () => noise(0.08, 0.25, true);
  audio.mission = () => { tone(440, 0.12, 'triangle', 0.2); setTimeout(() => tone(660, 0.16, 'triangle', 0.2), 120); };
  audio.complete = () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.22), i * 110));
  };
  audio.siren = (dt) => {
    if (!audio.ctx || audio.muted) return;
    audio.sirenTimer -= dt;
    if (audio.sirenTimer <= 0) {
      audio.sirenTimer = 0.42;
      tone(audio.sirenHigh ? 700 : 950, 0.4, 'sine', 0.05);
      audio.sirenHigh = !audio.sirenHigh;
    }
  };
  audio.engine = (speed01) => {
    if (!audio.ctx || audio.muted) return;
    try {
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        audio.engineOsc.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      audio.engineOsc.frequency.value = 55 + speed01 * 130;
      audio.engineGain.gain.value = speed01 > 0.02 ? 0.03 + speed01 * 0.04 : 0;
    } catch { /* ignore */ }
  };
  audio.toggleMute = () => { audio.muted = !audio.muted; return audio.muted; };
  return audio;
}
