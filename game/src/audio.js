// Solara Bay — audio: everything is synthesized with WebAudio, no audio
// files. Engine hum follows speed, sirens wail in two tones, gunfire is a
// filtered noise burst, pickups blip, missions sting.
export function createAudio() {
  let ctx = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
      sirenOsc.start();
      started = true;
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type = 'sine', vol = 0.16) {
    if (!ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get ready() { return started; },
    engine(speedKmh, driving) {
      if (!ensure()) return;
      const target = driving ? 0.05 + Math.min(0.16, speedKmh / 900) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, ctx.currentTime, 0.08);
    },
    siren(wanted) {
      if (!ensure()) return;
      if (wanted > 0) {
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        const t = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(t);
        sirenOsc.frequency.setValueAtTime(660, t);
        sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.45);
        sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
      } else sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    },
    shot() {
      if (!ensure()) return;
      const len = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
    },
    pickup() { blip(880, 0.14, 'sine', 0.2); setTimeout(() => blip(1320, 0.2, 'sine', 0.2), 90); },
    stage() { blip(660, 0.12, 'triangle', 0.2); setTimeout(() => blip(990, 0.18, 'triangle', 0.2), 110); },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.28, 'triangle', 0.22), i * 130));
    },
    fail() { blip(220, 0.5, 'sawtooth', 0.18); },
  };
}
