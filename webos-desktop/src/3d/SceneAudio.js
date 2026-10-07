const NOISE_LENGTH = 0.5;

export class SceneAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.reverbMix = null;
    this.cameraGetter = null;
    this.lastHoverId = null;
    this.footstepTimer = 0;
    this.prevMoving = false;
    this.uiEnabled = true;
    this.footstepEnabled = true;
    this.ambientEnabled = true;
    this.masterVolume = 0.4;
    this.musicVolume = 0.6;
    this.effectsVolume = 1;
    this.lastHoloHover = 0;
    this.noiseBuffer = null;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.effectsVolume;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);
    this.createReverb();
  }

  createReverb() {
    const sr = this.ctx.sampleRate;
    const len = sr * 0.08;
    const buffer = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.015));
      }
    }
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = buffer;
    this.reverbMix = this.ctx.createGain();
    this.reverbMix.gain.value = 0.25;
    this.reverbNode.connect(this.reverbMix);
    this.reverbMix.connect(this.sfxGain);
  }

  createGain(vol) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    return g;
  }

  createOsc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  getNoiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sr = this.ctx.sampleRate;
    const len = sr * NOISE_LENGTH;
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  playTone(freq, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, sweep = 0, delay = 0, filter = 0, pan = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, freq);
    const gain = this.createGain(0);
    if (pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      osc.connect(bp);
      bp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    if (sweep) osc.frequency.linearRampToValueAtTime(freq + sweep, now + duration);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playNoise(duration, opts = {}) {
    this.ensure();
    const { volume = 0.05, filter = 0, delay = 0, pan = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const buffer = this.getNoiseBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = this.createGain(0);
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      src.connect(bp);
      bp.connect(gain);
    } else {
      src.connect(gain);
    }
    if (pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    src.start(now);
    src.stop(now + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
  }

  playSweep(from, to, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, delay = 0, filter = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, from);
    const gain = this.createGain(0);
    if (filter) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = filter;
      osc.connect(bp);
      bp.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.sfxGain);
    osc.frequency.linearRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.setValueAtTime(volume, now + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  playSweepTone(from, to, duration, opts = {}) {
    return this.playSweep(from, to, duration, opts);
  }

  playChord(freqs, duration, opts = {}) {
    for (const f of freqs) {
      this.playTone(f, duration, opts);
    }
  }

  playReverbTone(freq, duration, opts = {}) {
    this.ensure();
    const { type = "sine", volume = 0.1, delay = 0 } = opts;
    const now = this.ctx.currentTime + delay;
    const osc = this.createOsc(type, freq);
    const gain = this.createGain(0);
    osc.connect(gain);
    gain.connect(this.reverbNode);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  spatialGain(pos) {
    if (!this.cameraGetter || !pos) return null;
    const cam = this.cameraGetter();
    if (!cam) return null;
    const dx = cam.position.x - pos.x;
    const dz = cam.position.z - (pos.z || 0);
    const dist = Math.sqrt(dx * dx + dz * dz);
    const vol = Math.max(0.1, Math.min(1, 1 - dist / 8));
    const g = this.ctx.createGain();
    g.gain.value = vol;
    return g;
  }

  playHover() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.03, { type: "triangle", volume: 0.05, filter: 2000 });
  }

  playClick() {
    if (!this.uiEnabled) return;
    this.playTone(600, 0.015, { type: "sine", volume: 0.1 });
    this.playNoise(0.015, { volume: 0.04, filter: 3000 });
  }

  playToggleOn() {
    if (!this.uiEnabled) return;
    this.playSweepTone(400, 800, 0.06, { type: "sine", volume: 0.08 });
  }

  playToggleOff() {
    if (!this.uiEnabled) return;
    this.playNoise(0.04, { volume: 0.04, filter: 200 });
  }

  playEKey() {
    if (!this.uiEnabled) return;
    this.playTone(440, 0.05, { type: "triangle", volume: 0.08 });
    this.playTone(660, 0.05, { type: "triangle", volume: 0.05, delay: 0.015 });
  }

  playBookGrab(pos) {
    if (!this.ambientEnabled) return;
    const vol = 0.07;
    this.playNoise(0.1, { volume: 0.04, filter: 500 });
    this.playTone(300, 0.08, { type: "sine", volume: vol });
  }

  playBookThrow() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(200, 2000, 0.15, { type: "sine", volume: 0.05, filter: 1000 });
  }

  playBookShelve() {
    if (!this.ambientEnabled) return;
    this.playTone(800, 0.04, { type: "sine", volume: 0.12 });
    this.playTone(400, 0.03, { type: "sine", volume: 0.08, delay: 0.02 });
    this.playTone(80, 0.03, { type: "sine", volume: 0.06 });
  }

  playFurnitureGrab() {
    if (!this.ambientEnabled) return;
    this.playTone(150, 0.08, { type: "sawtooth", volume: 0.05, filter: 300 });
    this.playNoise(0.08, { volume: 0.04, filter: 200 });
  }

  playFurnitureRelease() {
    if (!this.ambientEnabled) return;
    this.playTone(60, 0.1, { type: "sine", volume: 0.1 });
    this.playNoise(0.1, { volume: 0.04, filter: 100 });
  }

  playSit() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(250, 200, 0.06, { type: "triangle", volume: 0.07 });
    this.playNoise(0.04, { volume: 0.03, filter: 300 });
  }

  playStand() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(200, 280, 0.08, { type: "triangle", volume: 0.06 });
  }

  playBallGrab() {
    if (!this.ambientEnabled) return;
    this.playTone(600, 0.03, { type: "sine", volume: 0.08 });
  }

  playBallThrow() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(1200, 800, 0.2, { type: "sine", volume: 0.05, filter: 2000 });
  }

  playBallBounce() {
    if (!this.ambientEnabled) return;
    this.playTone(400, 0.1, { type: "sine", volume: 0.07 });
    const playBounce = (f, d, vol) => {
      this.playTone(f, d * 0.8, { type: "sine", volume: vol, delay: d });
    };
    playBounce(350, 0.1, 0.05);
    playBounce(300, 0.2, 0.04);
    playBounce(260, 0.35, 0.03);
  }

  playBookGrabPOV() {
    if (!this.ambientEnabled) return;
    this.playNoise(0.06, { volume: 0.03, filter: 600 });
    this.playTone(350, 0.06, { type: "sine", volume: 0.06 });
  }

  playReleasePOV() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(300, 200, 0.1, { type: "sine", volume: 0.06, filter: 400 });
  }

  playHoloHover(opts = {}) {
    if (!this.uiEnabled) return;
    this.ensure();
    const now = this.ctx.currentTime;
    if (now - this.lastHoloHover < 0.055) return;
    this.lastHoloHover = now;
    let pan = 0;
    let pitch = 0;
    let bright = false;
    if (opts && typeof opts === "object") {
      pan = Math.max(-0.6, Math.min(0.6, opts.pan || 0));
      pitch = opts.pitch || 0;
      bright = !!opts.bright;
    } else if (typeof opts === "number") {
      pan = opts;
    }
    let hash = 0;
    if (opts && typeof opts.id === "string") {
      for (let i = 0; i < opts.id.length; i++) hash = (hash * 31 + opts.id.charCodeAt(i)) >>> 0;
      pitch = hash % 7;
      bright = opts.id.includes("main_play") || opts.id.includes("board_endless") || opts.id.includes("sort");
    }
    const base = 720 + pitch * 42 + (bright ? 110 : 0);
    const jitter = (Math.random() - 0.5) * 14;
    const f1 = base + jitter;
    const f2 = f1 * 1.498;
    const f3 = f1 * 2.01;
    this.playTone(f1, 0.07, { type: "triangle", volume: bright ? 0.058 : 0.042, filter: 3400, pan, sweep: 55 });
    this.playTone(f2, 0.085, {
      type: "sine",
      volume: bright ? 0.028 : 0.019,
      delay: 0.018,
      filter: 4200,
      pan: pan * 0.5
    });
    this.playNoise(0.018, { volume: 0.016, filter: 5200, pan: pan * 0.3 });
    this.playReverbTone(f3, 0.16, { type: "sine", volume: bright ? 0.022 : 0.014, delay: 0.022 });
    if (bright)
      this.playTone(f1 * 0.5, 0.09, { type: "sine", volume: 0.02, delay: 0.01, filter: 1800, pan: pan * 0.2 });
  }

  playHoloClick() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.06, { type: "sine", volume: 0.1 });
    this.playTone(1200, 0.06, { type: "sine", volume: 0.06, delay: 0.02 });
  }

  playHoloPage() {
    if (!this.uiEnabled) return;
    this.playNoise(0.04, { volume: 0.03, filter: 1000 });
    this.playTone(600, 0.06, { type: "sine", volume: 0.07, delay: 0.03 });
  }

  playHoloDot() {
    if (!this.uiEnabled) return;
    this.playTone(1000, 0.03, { type: "sine", volume: 0.05 });
  }

  playTabSwitch() {
    if (!this.uiEnabled) return;
    this.playSweepTone(500, 700, 0.05, { type: "triangle", volume: 0.06 });
  }

  playCardHover() {
    if (!this.uiEnabled) return;
    this.playTone(900, 0.02, { type: "sine", volume: 0.03, filter: 2000 });
  }

  playSpawnFromCatalog() {
    if (!this.uiEnabled) return;
    this.playSweepTone(400, 800, 0.06, { type: "sine", volume: 0.08 });
    this.playNoise(0.08, { volume: 0.04, filter: 1000, delay: 0.04 });
  }

  playRecover() {
    if (!this.uiEnabled) return;
    this.playSweepTone(800, 400, 0.12, { type: "sine", volume: 0.07 });
    this.playNoise(0.1, { volume: 0.03, filter: 800, delay: 0.05 });
  }

  playCloseCatalog() {
    if (!this.uiEnabled) return;
    this.playSweepTone(800, 200, 0.12, { type: "sine", volume: 0.06, filter: 600 });
    this.playNoise(0.12, { volume: 0.04, filter: 200 });
  }

  playFootstep(sprint, intensity = 1, crouch = false) {
    if (!this.footstepEnabled) return;
    const rnd = 0.85 + Math.random() * 0.3;
    const dur = (sprint ? 0.04 : 0.06) * rnd;
    let vol = (sprint ? 0.15 : 0.1) * (0.6 + 0.4 * intensity);
    const filterVal = sprint ? 500 : 400;
    if (crouch) vol *= 0.45;
    this.playNoise(dur, { volume: vol, filter: crouch ? filterVal * 0.6 : filterVal });
    this.playTone((sprint ? 100 : 80) * rnd, dur, {
      type: "sine",
      volume: vol * 0.5,
      filter: crouch ? 200 : 0
    });
  }

  playJump() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(200, 600, 0.08, { type: "sine", volume: 0.05, filter: 800 });
  }

  playLand(impact = 2) {
    if (!this.ambientEnabled) return;
    const vol = Math.min(0.18, 0.06 + impact * 0.02);
    this.playTone(80, 0.06, { type: "sine", volume: vol });
    this.playNoise(0.06, { volume: vol * 0.5, filter: 100 });
  }

  playGameStart() {
    if (!this.ambientEnabled) return;
    this.playTone(400, 0.08, { type: "triangle", volume: 0.1 });
    this.playTone(500, 0.08, { type: "triangle", volume: 0.08, delay: 0.08 });
    this.playTone(600, 0.08, { type: "triangle", volume: 0.07, delay: 0.16 });
    this.playTone(800, 0.15, { type: "triangle", volume: 0.09, delay: 0.24 });
  }

  playCorrect() {
    if (!this.ambientEnabled) return;
    this.playReverbTone(880, 0.15, { type: "sine", volume: 0.15 });
    this.playTone(1320, 0.2, { type: "sine", volume: 0.1, delay: 0.04 });
  }

  playWrong() {
    if (!this.ambientEnabled) return;
    this.playTone(150, 0.12, { type: "sawtooth", volume: 0.08, filter: 300 });
  }

  playGameComplete() {
    if (!this.ambientEnabled) return;
    const notes = [293, 369, 440, 554];
    notes.forEach((f, i) => {
      this.playReverbTone(f, 0.3, { type: "sine", volume: 0.12, delay: i * 0.1 });
    });
  }

  completionScales(accuracy) {
    const grade = accuracy >= 90 ? "S" : accuracy >= 75 ? "A" : accuracy >= 60 ? "B" : accuracy >= 40 ? "C" : "D";
    const scales = {
      S: [523, 659, 784, 1047, 1319, 1568],
      A: [440, 554, 659, 880, 1109],
      B: [392, 494, 587, 784],
      C: [349, 440, 523, 698],
      D: [311, 392, 466, 587]
    };
    return { grade, notes: scales[grade] };
  }

  playCompletionFanfare(accuracy) {
    if (!this.ambientEnabled) return;
    const { notes } = this.completionScales(accuracy);
    notes.forEach((f, i) => {
      this.playReverbTone(f, 0.35, { type: "sine", volume: 0.11, delay: i * 0.12 });
    });
    const top = notes[notes.length - 1];
    const t = notes.length * 0.12;
    this.playTone(top * 2, 0.25, { type: "sine", volume: 0.06, delay: t + 0.05, filter: 4000 });
    this.playTone(top * 3, 0.35, { type: "sine", volume: 0.05, delay: t + 0.17, filter: 5000 });
  }

  playCompletionRow(index, total, accuracy) {
    if (!this.ambientEnabled) return;
    const pct = Math.max(0, Math.min(1, accuracy / 100));
    const base = 420 + pct * 380;
    const span = 1 + pct * 2.2;
    const f = base * Math.pow(2, (index / Math.max(1, total)) * span);
    this.playTone(f, 0.12, { type: "sine", volume: 0.08, filter: 2400 });
  }

  playGradeReveal(grade) {
    if (!this.ambientEnabled) return;
    const roots = { S: 523, A: 440, B: 392, C: 349, D: 311 };
    const root = roots[grade] || 392;
    this.playReverbTone(root, 0.6, { type: "sine", volume: 0.14 });
    this.playReverbTone(root * 1.25, 0.6, { type: "sine", volume: 0.1, delay: 0.03 });
    this.playReverbTone(root * 1.5, 0.7, { type: "sine", volume: 0.09, delay: 0.06 });
  }

  playSparkle() {
    if (!this.ambientEnabled) return;
    this.playTone(1500, 0.07, { type: "sine", volume: 0.06, filter: 4000 });
    this.playTone(2200, 0.1, { type: "sine", volume: 0.04, delay: 0.03 });
  }

  playChime() {
    if (!this.ambientEnabled) return;
    this.playReverbTone(523, 0.25, { type: "sine", volume: 0.12 });
    this.playReverbTone(784, 0.3, { type: "sine", volume: 0.1, delay: 0.08 });
  }

  playCashDing() {
    if (!this.ambientEnabled) return;
    this.playTone(1200, 0.08, { type: "sine", volume: 0.12 });
    this.playTone(1800, 0.2, { type: "sine", volume: 0.08, delay: 0.04 });
  }

  playCatWindup() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(180, 900, 0.5, { type: "sawtooth", volume: 0.09, filter: 900 });
    this.playSweepTone(300, 1400, 0.45, { type: "sine", volume: 0.05, filter: 1600, delay: 0.06 });
    this.playTone(1800, 0.3, { type: "sine", volume: 0.03, filter: 2400, delay: 0.12 });
    this.playNoise(0.4, { volume: 0.05, filter: 1100 });
  }

  playCatKnock() {
    if (!this.ambientEnabled) return;
    this.playNoise(0.18, { volume: 0.1, filter: 350 });
    this.playTone(110, 0.16, { type: "sine", volume: 0.16 });
    this.playSweepTone(220, 90, 0.2, { type: "triangle", volume: 0.08, filter: 500 });
  }

  playCatStun() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(600, 150, 0.4, { type: "triangle", volume: 0.14 });
    this.playNoise(0.3, { volume: 0.06, filter: 500 });
  }

  playMeow() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(600, 900, 0.15, { type: "sine", volume: 0.2 });
    this.playSweepTone(900, 600, 0.2, { type: "sine", volume: 0.18, delay: 0.15 });
  }

  playPurr() {
    if (!this.ambientEnabled) return;
    this.playNoise(1.2, { volume: 0.06, filter: 250 });
    this.playTone(120, 1.2, { type: "sine", volume: 0.05 });
    this.playTone(90, 1.2, { type: "sine", volume: 0.04, delay: 0.1 });
  }

  playContractStart() {
    if (!this.ambientEnabled) return;
    this.playTone(392, 0.12, { type: "triangle", volume: 0.1 });
    this.playTone(494, 0.12, { type: "triangle", volume: 0.09, delay: 0.1 });
    this.playTone(587, 0.2, { type: "triangle", volume: 0.08, delay: 0.2 });
  }

  playPayday() {
    if (!this.ambientEnabled) return;
    this.playReverbTone(523, 0.3, { type: "sine", volume: 0.12 });
    this.playReverbTone(659, 0.3, { type: "sine", volume: 0.1, delay: 0.12 });
    this.playReverbTone(784, 0.4, { type: "sine", volume: 0.1, delay: 0.24 });
  }

  playTimerTick() {
    if (!this.ambientEnabled) return;
    this.playTone(600, 0.02, { type: "sine", volume: 0.05 });
  }

  playEditorEnter() {
    if (!this.uiEnabled) return;
    this.playSweepTone(300, 900, 0.2, { type: "triangle", volume: 0.08, filter: 1000 });
    this.playTone(450, 0.1, { type: "triangle", volume: 0.06, delay: 0.1 });
    this.playTone(600, 0.1, { type: "triangle", volume: 0.05, delay: 0.15 });
  }

  playEditorExit() {
    if (!this.uiEnabled) return;
    this.playSweepTone(900, 300, 0.15, { type: "triangle", volume: 0.07 });
  }

  playEquip() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.06, { type: "sine", volume: 0.08 });
    this.playTone(120, 0.06, { type: "sine", volume: 0.06, delay: 0.015 });
  }

  playPlaceValid() {
    if (!this.uiEnabled) return;
    this.playTone(100, 0.06, { type: "sine", volume: 0.12 });
    this.playNoise(0.06, { volume: 0.05, filter: 150 });
  }

  playPlaceInvalid() {
    if (!this.uiEnabled) return;
    this.playTone(100, 0.1, { type: "sawtooth", volume: 0.06, filter: 200 });
  }

  playSelect() {
    if (!this.uiEnabled) return;
    this.playSweepTone(1000, 800, 0.05, { type: "sine", volume: 0.08 });
  }

  playDeselect() {
    if (!this.uiEnabled) return;
    this.playSweepTone(600, 400, 0.04, { type: "triangle", volume: 0.06 });
  }

  playUndo() {
    if (!this.uiEnabled) return;
    this.playTone(800, 0.03, { type: "sine", volume: 0.07 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.06, delay: 0.03 });
    this.playTone(400, 0.03, { type: "sine", volume: 0.05, delay: 0.06 });
  }

  playRedo() {
    if (!this.uiEnabled) return;
    this.playTone(400, 0.03, { type: "sine", volume: 0.07 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.06, delay: 0.03 });
    this.playTone(800, 0.03, { type: "sine", volume: 0.05, delay: 0.06 });
  }

  playSnap(on) {
    if (!this.uiEnabled) return;
    if (on) {
      this.playTone(1000, 0.03, { type: "sine", volume: 0.08 });
    } else {
      this.playTone(400, 0.02, { type: "triangle", volume: 0.05 });
    }
  }

  playLobThrow() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(600, 200, 0.16, { type: "sine", volume: 0.05, filter: 900 });
    this.playNoise(0.14, { volume: 0.03, filter: 700, delay: 0.02 });
  }

  playLobSnap() {
    if (!this.ambientEnabled) return;
    this.playTone(1200, 0.04, { type: "sine", volume: 0.1, filter: 3000 });
    this.playTone(1600, 0.05, { type: "sine", volume: 0.07, delay: 0.02, filter: 3500 });
    this.playTone(80, 0.05, { type: "sine", volume: 0.07 });
  }

  playStreak(level) {
    if (!this.ambientEnabled) return;
    const root = 523 * Math.pow(2, (Math.min(Math.max(level, 1), 8) * 2) / 12);
    this.playTone(root, 0.09, { type: "sine", volume: 0.1, filter: 2400 });
    this.playTone(root * 1.5, 0.11, { type: "sine", volume: 0.08, delay: 0.07, filter: 2600 });
  }

  playDayNight() {
    if (!this.uiEnabled) return;
    this.playNoise(0.5, { volume: 0.03, filter: 400 });
    this.playSweepTone(300, 500, 0.4, { type: "triangle", volume: 0.04 });
  }

  playScreenshot() {
    if (!this.uiEnabled) return;
    this.playNoise(0.03, { volume: 0.06, filter: 3000 });
    this.playTone(1200, 0.02, { type: "sine", volume: 0.06 });
  }

  playAutoSave() {
    if (!this.uiEnabled) return;
    this.playTone(600, 0.03, { type: "sine", volume: 0.04 });
    this.playTone(600, 0.03, { type: "sine", volume: 0.04, delay: 0.03 });
  }

  playShatter() {
    if (!this.ambientEnabled) return;
    this.playNoise(0.25, { volume: 0.08, filter: 2000 });
    this.playSweepTone(400, 80, 0.25, { type: "sawtooth", volume: 0.06, filter: 600 });
  }

  playThief() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(800, 200, 0.3, { type: "triangle", volume: 0.07 });
  }

  playCushion() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(300, 900, 0.25, { type: "sawtooth", volume: 0.09, filter: 1000 });
    this.playNoise(0.12, { volume: 0.07, filter: 800 });
  }

  playShuffle() {
    if (!this.ambientEnabled) return;
    this.playTone(660, 0.05, { type: "sine", volume: 0.1 });
    this.playTone(440, 0.05, { type: "sine", volume: 0.09, delay: 0.06 });
    this.playNoise(0.1, { volume: 0.06, filter: 700, delay: 0.05 });
  }

  playShake() {
    if (!this.ambientEnabled) return;
    this.playSweepTone(120, 180, 0.3, { type: "sine", volume: 0.09 });
    this.playNoise(0.2, { volume: 0.06, filter: 300 });
  }

  playCatnip() {
    if (!this.ambientEnabled) return;
    this.playTone(1800, 0.06, { type: "sine", volume: 0.05, filter: 4000 });
    this.playTone(2400, 0.1, { type: "sine", volume: 0.04, delay: 0.06, filter: 4000 });
  }

  playBuy() {
    if (!this.uiEnabled) return;
    this.playReverbTone(880, 0.15, { type: "sine", volume: 0.1 });
    this.playReverbTone(1320, 0.2, { type: "sine", volume: 0.08, delay: 0.06 });
  }

  playError() {
    if (!this.uiEnabled) return;
    this.playTone(160, 0.18, { type: "square", volume: 0.08 });
  }

  checkHover(targetId) {
    if (targetId !== this.lastHoverId) {
      this.lastHoverId = targetId;
      if (targetId) this.playHover();
    }
  }

  resetHover() {
    this.lastHoverId = null;
  }

  startMusic(url) {
    this.ensure();
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buffer) => {
        if (!this.ctx) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const gain = this.createGain(0.25);
        src.connect(gain);
        gain.connect(this.musicGain);
        src.start();
      })
      .catch(() => {});
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setEffectsVolume(v) {
    this.effectsVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setUIEnabled(enabled) {
    this.uiEnabled = enabled;
  }

  setFootstepEnabled(enabled) {
    this.footstepEnabled = enabled;
  }

  setAmbientEnabled(enabled) {
    this.ambientEnabled = enabled;
  }

  setCameraGetter(fn) {
    this.cameraGetter = fn;
  }

  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.reverbMix = null;
    this.reverbNode = null;
    this.noiseBuffer = null;
  }
}
