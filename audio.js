// Synthesized Neon Arcade Audio Engine (Web Audio API - zero external files required)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('neonflap_muted') === '1';
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('neonflap_muted', this.muted ? '1' : '0');
    if (!this.muted) {
      this.init();
      this.click();
    }
    return this.muted;
  }

  playTone({ freq = 440, endFreq = null, type = 'sine', duration = 0.12, gain = 0.14, delay = 0 }) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  flap() {
    this.playTone({ freq: 290, endFreq: 560, type: 'triangle', duration: 0.11, gain: 0.14 });
  }

  score() {
    this.playTone({ freq: 660, type: 'sine', duration: 0.09, gain: 0.13, delay: 0 });
    this.playTone({ freq: 990, type: 'sine', duration: 0.16, gain: 0.13, delay: 0.065 });
  }

  reward() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone({ freq: n, type: 'triangle', duration: 0.18, gain: 0.15, delay: idx * 0.07 });
    });
  }

  crash() {
    this.playTone({ freq: 210, endFreq: 42, type: 'sawtooth', duration: 0.28, gain: 0.18 });
    this.playTone({ freq: 120, endFreq: 32, type: 'square', duration: 0.22, gain: 0.12, delay: 0.03 });
  }

  click() {
    this.playTone({ freq: 520, endFreq: 680, type: 'sine', duration: 0.055, gain: 0.09 });
  }
}

window.soundFX = new SoundEngine();
