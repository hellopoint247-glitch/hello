/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { safeLocalStorage as localStorage } from './safeStorage';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initSetting();
  }

  private initSetting() {
    try {
      const stored = localStorage.getItem('hellopoint_sound_enabled');
      this.isEnabled = stored !== 'false';
    } catch {
      this.isEnabled = true;
    }
  }

  public getSoundEnabled(): boolean {
    try {
      const stored = localStorage.getItem('hellopoint_sound_enabled');
      return stored !== 'false';
    } catch {
      return this.isEnabled;
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('hellopoint_sound_enabled', enabled ? 'true' : 'false');
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Signature iPhone App Store / Apple Pay Face ID Verification Sound:
   * Authentic dual-pitch crystal chime with subtle tactile swoosh & bell resonance.
   */
  public playIPhoneVerificationSound() {
    if (!this.getSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Subtle smooth tactile bass/mid swoosh (simulates iOS haptic spring / FaceID lock click)
      const swooshOsc = ctx.createOscillator();
      const swooshGain = ctx.createGain();
      swooshOsc.type = 'sine';
      swooshOsc.frequency.setValueAtTime(260, now);
      swooshOsc.frequency.exponentialRampToValueAtTime(540, now + 0.08);

      swooshGain.gain.setValueAtTime(0.001, now);
      swooshGain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      swooshGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      swooshOsc.connect(swooshGain);
      swooshGain.connect(ctx.destination);
      swooshOsc.start(now);
      swooshOsc.stop(now + 0.1);

      // 2. Chime 1 (Eb6 - 1244.5 Hz) - First gentle crystal strike
      const note1Time = now + 0.02;
      const f1 = 1244.5;
      
      // Fundamental sine
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(f1, note1Time);
      gain1.gain.setValueAtTime(0.0001, note1Time);
      gain1.gain.linearRampToValueAtTime(0.22, note1Time + 0.005);
      gain1.gain.exponentialRampToValueAtTime(0.0001, note1Time + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(note1Time);
      osc1.stop(note1Time + 0.3);

      // Chime 1 harmonic overtone (subtle shimmer)
      const osc1Harm = ctx.createOscillator();
      const gain1Harm = ctx.createGain();
      osc1Harm.type = 'triangle';
      osc1Harm.frequency.setValueAtTime(f1 * 2, note1Time);
      gain1Harm.gain.setValueAtTime(0.0001, note1Time);
      gain1Harm.gain.linearRampToValueAtTime(0.06, note1Time + 0.004);
      gain1Harm.gain.exponentialRampToValueAtTime(0.0001, note1Time + 0.16);
      osc1Harm.connect(gain1Harm);
      gain1Harm.connect(ctx.destination);
      osc1Harm.start(note1Time);
      osc1Harm.stop(note1Time + 0.18);

      // 3. Chime 2 (Ab6 - 1661.2 Hz / C7 - 2093 Hz) - Crisp high Apple Pay completion bell
      const note2Time = now + 0.105;
      const f2 = 1661.2;

      // Fundamental sine
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(f2, note2Time);
      gain2.gain.setValueAtTime(0.0001, note2Time);
      gain2.gain.linearRampToValueAtTime(0.28, note2Time + 0.006);
      gain2.gain.exponentialRampToValueAtTime(0.0001, note2Time + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(note2Time);
      osc2.stop(note2Time + 0.45);

      // Chime 2 high crystal overtone
      const osc2Harm = ctx.createOscillator();
      const gain2Harm = ctx.createGain();
      osc2Harm.type = 'sine';
      osc2Harm.frequency.setValueAtTime(f2 * 2, note2Time);
      gain2Harm.gain.setValueAtTime(0.0001, note2Time);
      gain2Harm.gain.linearRampToValueAtTime(0.09, note2Time + 0.005);
      gain2Harm.gain.exponentialRampToValueAtTime(0.0001, note2Time + 0.26);
      osc2Harm.connect(gain2Harm);
      gain2Harm.connect(ctx.destination);
      osc2Harm.start(note2Time);
      osc2Harm.stop(note2Time + 0.28);

    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  }

  /**
   * Sound 1: Customer Cash Entry (GAVE / GOT / Cash-in / Cash-out)
   */
  public playCashEntrySound(_type: 'GAVE' | 'GOT' = 'GOT') {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 2: Pay Bill Paid / New Paybill Entry
   */
  public playPayBillPaidSound() {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 3: Cash In Entry (Balance replenishment / Cash-In)
   */
  public playCashInSound() {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 4: Cashbook Entry / General Positive Entry
   */
  public playCashbookSound(_type: 'IN' | 'OUT' = 'IN') {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 5: Delete / Trash Action (Gentle soft feedback)
   */
  public playDeleteSound() {
    if (!this.getSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.17);
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  }

  /**
   * Sound 6: Success / General notification chime
   */
  public playSuccessSound() {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 7: Chat Message Sent (Light snappy swoosh/pop)
   */
  public playMessageSentSound() {
    if (!this.getSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  }

  /**
   * Sound 8: Chat Incoming Message (Warm Messenger / iMessage style double pop)
   */
  public playIncomingMessageSound() {
    if (!this.getSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [784, 1046.5]; // G5 -> C6

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.001, now + idx * 0.07);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.16);
      });
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  }

  /**
   * Sound 9: Unlock PIN Success (Signature iPhone chime)
   */
  public playPinUnlockSound() {
    this.playIPhoneVerificationSound();
  }

  /**
   * Sound 10: PIN Error / Failed Attempt (Subtle error wobble tone)
   */
  public playPinErrorSound() {
    if (!this.getSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [220, 180]; // Low error buzz

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0.001, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.15);
      });
    } catch (e) {
      console.warn('Audio playback notice:', e);
    }
  }

  /**
   * Sound 11: SIM Balance Recharge / Cash-In Balance Added (iPhone verification tone)
   */
  public playSimBalanceRechargeSound() {
    this.playIPhoneVerificationSound();
  }
}

export const soundEngine = new SoundEngine();

