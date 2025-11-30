/**
 * 8-bit retro sound effects for the slot machine
 * Generated using Web Audio API - no external files needed!
 */

class RetroSoundManager {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private volume = 0.3;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "square",
    volumeMultiplier = 1,
    frequencyEnd?: number,
  ): void {
    if (!this.enabled) return;

    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      // Frequency slide for effects
      if (frequencyEnd !== undefined) {
        oscillator.frequency.linearRampToValueAtTime(
          frequencyEnd,
          ctx.currentTime + duration,
        );
      }

      // Volume envelope
      const vol = this.volume * volumeMultiplier;
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio errors (user hasn't interacted yet, etc.)
    }
  }

  /** Handle pull - chunky mechanical sound */
  playHandlePull(): void {
    // Low thunk
    this.playTone(80, 0.1, "square", 0.8);
    // Slide up
    setTimeout(() => this.playTone(120, 0.15, "sawtooth", 0.5, 200), 50);
    // Click at end
    setTimeout(() => this.playTone(400, 0.05, "square", 0.6), 180);
  }

  /** Reel clicking - rapid tick sound */
  playReelClick(): void {
    // Quick high tick
    this.playTone(800 + Math.random() * 200, 0.03, "square", 0.25);
  }

  /** Reel stop - satisfying clunk */
  playReelStop(): void {
    // Deep clunk
    this.playTone(150, 0.08, "square", 0.7);
    // Higher accent
    setTimeout(() => this.playTone(300, 0.05, "square", 0.4), 30);
  }

  /** Win sound - Mario 1-UP style */
  playWin(): void {
    // Classic Mario 1-UP / power-up sound
    const notes = [
      { freq: 330, delay: 0 },     // E4
      { freq: 392, delay: 60 },    // G4
      { freq: 523, delay: 120 },   // C5
      { freq: 659, delay: 180 },   // E5
      { freq: 784, delay: 240 },   // G5
      { freq: 1047, delay: 300 },  // C6
    ];
    notes.forEach(({ freq, delay }) => {
      setTimeout(() => this.playTone(freq, 0.1, "square", 0.45), delay);
    });
  }

  /** Lose sound - Mario death style */
  playLose(): void {
    // Descending "wah wah wah wahhh" 
    const notes = [
      { freq: 494, delay: 0 },     // B4
      { freq: 466, delay: 150 },   // Bb4
      { freq: 440, delay: 300 },   // A4
      { freq: 415, delay: 450 },   // Ab4
    ];
    notes.forEach(({ freq, delay }) => {
      setTimeout(() => this.playTone(freq, 0.2, "square", 0.4), delay);
    });
    // Final low note
    setTimeout(() => this.playTone(200, 0.4, "square", 0.5, 100), 650);
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const soundManager = new RetroSoundManager();
