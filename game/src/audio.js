// Synthesized sound effects: no audio files, everything is built from
// oscillators and filtered noise through one WebAudio graph. The context is
// created on the first user gesture (browsers block audio before that).

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    /** Call from any user gesture; also safe to call any time. */
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() { tone(880, 0.08, 'square', 0.10, 220); },
    enemyShoot() { tone(320, 0.14, 'sawtooth', 0.07, 140); },
    explode(big = false) {
      noise(big ? 0.5 : 0.25, big ? 0.5 : 0.3, big ? 900 : 1600);
      tone(big ? 120 : 180, big ? 0.4 : 0.2, 'triangle', 0.25, 40);
    },
    hit() { tone(200, 0.09, 'sawtooth', 0.16, 90); },
    hurt() { tone(140, 0.25, 'sawtooth', 0.3, 55); noise(0.18, 0.25, 700); },
    pickup() { tone(660, 0.09, 'sine', 0.16, 990); tone(990, 0.12, 'sine', 0.12, 1320, 0.07); },
    heart() { tone(523, 0.12, 'sine', 0.18); tone(659, 0.12, 'sine', 0.18, null, 0.1); tone(784, 0.2, 'sine', 0.18, null, 0.2); },
    dash() { noise(0.16, 0.2, 2400); tone(300, 0.14, 'sine', 0.12, 900); },
    waveHorn() { tone(220, 0.35, 'sawtooth', 0.16, 220); tone(330, 0.35, 'sawtooth', 0.12, 330, 0.12); },
    bossAlarm() { tone(440, 0.18, 'square', 0.14, 440); tone(440, 0.18, 'square', 0.14, 440, 0.24); },
    upgrade() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.14, null, i * 0.07)); },
    victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, null, i * 0.11)); },
    click() { tone(700, 0.05, 'sine', 0.12, 900); },
  };
}
