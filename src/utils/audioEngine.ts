import { KeepAliveMode } from '../types';

class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isRunning: boolean = false;
  private periodicInterval: number | null = null;
  private currentMode: KeepAliveMode = 'pure_silence';
  private onFocusStateChange: ((state: 'ACTIVE' | 'CONCURRENT_STREAM') => void) | null = null;

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setFocusCallback(cb: (state: 'ACTIVE' | 'CONCURRENT_STREAM') => void) {
    this.onFocusStateChange = cb;
  }

  public start(mode: KeepAliveMode = 'pure_silence') {
    this.init();
    if (!this.ctx) return;
    this.stop(); // Clear any existing

    this.currentMode = mode;
    this.isRunning = true;

    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 64;

    this.gainNode = this.ctx.createGain();

    if (mode === 'pure_silence') {
      // Create a continuous buffer source with pure 0s (digital silence)
      // This forces the audio session to stay active without making any sound
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds looped
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = 0.000001 * Math.sin((2 * Math.PI * 20 * i) / this.ctx.sampleRate); // Barely perceptible digital signal
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      this.gainNode.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      source.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);
      source.start();

      (this as unknown as { _source: AudioBufferSourceNode })._source = source;
    } else if (mode === 'sub_bass') {
      // 15 Hz inaudible tone - keeps older DAC hardware from sleeping
      this.oscillator = this.ctx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.setValueAtTime(15, this.ctx.currentTime); // 15 Hz is below human hearing (< 20 Hz)
      
      this.gainNode.gain.setValueAtTime(0.015, this.ctx.currentTime);
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);
      this.oscillator.start();
    } else if (mode === 'periodic_ping') {
      // Periodic micro ping every 3 seconds
      this.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);

      const sendPulse = () => {
        if (!this.isRunning || !this.ctx) return;
        const pulseOsc = this.ctx.createOscillator();
        const pulseGain = this.ctx.createGain();
        pulseOsc.frequency.setValueAtTime(18, this.ctx.currentTime);
        pulseGain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
        pulseOsc.connect(pulseGain);
        pulseGain.connect(this.analyserNode!);
        pulseOsc.start();
        pulseOsc.stop(this.ctx.currentTime + 0.1);
      };

      sendPulse();
      this.periodicInterval = window.setInterval(sendPulse, 3000);
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Bluetooth StayAlive Active',
        artist: 'Non-Stop Silent Streamer',
        album: 'Anti-Sleep Daemon',
      });
      navigator.mediaSession.playbackState = 'playing';
    }

    this.onFocusStateChange?.('ACTIVE');
  }

  public stop() {
    this.isRunning = false;
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      const existingSource = (this as unknown as { _source?: AudioBufferSourceNode })._source;
      if (existingSource) {
        existingSource.stop();
        existingSource.disconnect();
        delete (this as unknown as { _source?: AudioBufferSourceNode })._source;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
    } catch {
      // Cleaned up
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  /**
   * Simulates an incoming phone call or external music playing.
   * As requested: Silence NEVER stops! It continues streaming in parallel
   * (Zero-Interference Sub-Mix) without causing any sound quality loss or glitch.
   */
  public simulateAudioInterruption(type: 'call' | 'music', onComplete: () => void) {
    this.init();
    if (!this.ctx) return;

    // The silent stream stays playing 100% active!
    this.onFocusStateChange?.('CONCURRENT_STREAM');

    // Play the test call/music audio concurrently mixed into destination
    const testOsc = this.ctx.createOscillator();
    const testGain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    if (type === 'call') {
      testOsc.type = 'sine';
      testOsc.frequency.setValueAtTime(440, now);
      testOsc.frequency.setValueAtTime(480, now + 0.5);
      testGain.gain.setValueAtTime(0.12, now);
      testGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      testOsc.connect(testGain);
      testGain.connect(this.ctx.destination);
      testOsc.start(now);
      testOsc.stop(now + 2.0);

      setTimeout(() => {
        this.onFocusStateChange?.('ACTIVE');
        onComplete();
      }, 2100);
    } else {
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((freq, idx) => {
        const noteOsc = this.ctx!.createOscillator();
        const noteGain = this.ctx!.createGain();
        const noteStart = now + idx * 0.35;
        noteOsc.type = 'triangle';
        noteOsc.frequency.setValueAtTime(freq, noteStart);
        noteGain.gain.setValueAtTime(0.15, noteStart);
        noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.32);
        noteOsc.connect(noteGain);
        noteGain.connect(this.ctx!.destination);
        noteOsc.start(noteStart);
        noteOsc.stop(noteStart + 0.35);
      });

      setTimeout(() => {
        this.onFocusStateChange?.('ACTIVE');
        onComplete();
      }, 1600);
    }
  }

  public getVisualizerData(): Uint8Array {
    if (!this.analyserNode) {
      return new Uint8Array(16).fill(0);
    }
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getIsRunning() {
    return this.isRunning;
  }
}

export const audioEngine = new WebAudioEngine();
