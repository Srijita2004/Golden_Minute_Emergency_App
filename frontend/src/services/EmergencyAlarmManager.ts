/**
 * Centralized Emergency Alarm & Audio Manager
 * 
 * Provides:
 * 1. Web Audio API continuous dual-tone emergency siren (no external MP3/network dependency).
 * 2. Guaranteed user gesture audio unlocking for modern browser autoplay policies.
 * 3. Hardware vibration API coordination with repeating patterns.
 * 4. Strict incident deduplication and acknowledgment tracking.
 * 5. Single active alarm instance (prevents overlapping sirens or audio conflicts).
 */

export interface EmergencyAlertPayload {
  incidentId: string;
  incidentType: string;
  sourceType: string;
  title?: string;
  body?: string;
  latitude?: number | string;
  longitude?: number | string;
  bpm?: number | string;
  confidence?: number | string;
  imageUrl?: string;
  timestamp: string;
}

export type AlarmListener = (state: {
  isAlarmActive: boolean;
  activeAlert: EmergencyAlertPayload | null;
  isAudioUnlocked: boolean;
}) => void;

class EmergencyAlarmManager {
  private audioContext: AudioContext | null = null;
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private sirenIntervalId: any = null;
  private vibrationIntervalId: any = null;

  private isAlarmActive: boolean = false;
  private isAudioUnlocked: boolean = false;
  private activeAlert: EmergencyAlertPayload | null = null;
  private acknowledgedIncidentIds: Set<string> = new Set();
  private listeners: Set<AlarmListener> = new Set();

  constructor() {
    // Attempt auto-unlock if user performs any global touch or keypress
    if (typeof window !== 'undefined') {
      const handleUserGesture = () => {
        this.unlockAudio();
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('touchstart', handleUserGesture);
        window.removeEventListener('keydown', handleUserGesture);
      };
      window.addEventListener('click', handleUserGesture, { once: true, passive: true });
      window.addEventListener('touchstart', handleUserGesture, { once: true, passive: true });
      window.addEventListener('keydown', handleUserGesture, { once: true, passive: true });
    }
  }

  /**
   * Browser Audio Unlock
   * Must be called during legitimate user interaction (button tap, camera enable, alert click).
   */
  public async unlockAudio(): Promise<boolean> {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play ultra-short silent buffer to satisfy browser autoplay restriction
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      this.isAudioUnlocked = true;
      console.log('✅ [ALARM MANAGER] Browser AudioContext unlocked and running.');
      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('⚠️ [ALARM MANAGER] Audio unlock pending user gesture:', err);
      return false;
    }
  }

  /**
   * Start continuous emergency siren
   */
  private startSirenAudio(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      // Stop any existing oscillator
      this.stopSirenAudio();

      const ctx = this.audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.oscillatorNode = osc;
      this.gainNode = gain;

      // Continuous dual-tone siren modulation (700Hz <-> 1150Hz every 500ms)
      let highTone = true;
      this.sirenIntervalId = setInterval(() => {
        if (!this.oscillatorNode || !this.audioContext) return;
        const now = this.audioContext.currentTime;
        const targetFreq = highTone ? 1150 : 700;
        this.oscillatorNode.frequency.cancelScheduledValues(now);
        this.oscillatorNode.frequency.linearRampToValueAtTime(targetFreq, now + 0.45);
        highTone = !highTone;
      }, 500);

    } catch (e) {
      console.error('❌ [ALARM MANAGER] Audio playback error:', e);
    }
  }

  /**
   * Stop emergency siren
   */
  private stopSirenAudio(): void {
    if (this.sirenIntervalId) {
      clearInterval(this.sirenIntervalId);
      this.sirenIntervalId = null;
    }

    if (this.gainNode && this.audioContext) {
      try {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.05);
      } catch {}
    }

    if (this.oscillatorNode) {
      try {
        this.oscillatorNode.stop();
        this.oscillatorNode.disconnect();
      } catch {}
      this.oscillatorNode = null;
    }
    this.gainNode = null;
  }

  /**
   * Hardware Vibration Management
   */
  private startVibration(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = [500, 200, 500, 200, 800, 300];
      try {
        navigator.vibrate(pattern);
        this.vibrationIntervalId = setInterval(() => {
          if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
          }
        }, 2500);
      } catch {}
    }
  }

  private stopVibration(): void {
    if (this.vibrationIntervalId) {
      clearInterval(this.vibrationIntervalId);
      this.vibrationIntervalId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  /**
   * Public Trigger Method
   * Dispatches emergency siren, vibration, and UI banner.
   * Deduplicates by incident ID.
   */
  public triggerAlarm(payload: EmergencyAlertPayload): boolean {
    if (!payload || !payload.incidentId) return false;

    // Deduplication check: Ignore if this incident was already acknowledged
    if (this.acknowledgedIncidentIds.has(payload.incidentId)) {
      console.log(`ℹ️ [ALARM MANAGER] Incident ${payload.incidentId} already acknowledged. Suppressing alarm.`);
      return false;
    }

    // If same incident is already actively alarming, just update payload
    if (this.isAlarmActive && this.activeAlert?.incidentId === payload.incidentId) {
      this.activeAlert = payload;
      this.notifyListeners();
      return true;
    }

    console.log(`🚨 [ALARM MANAGER] Triggering emergency alarm for ${payload.incidentType} (${payload.incidentId})`);
    this.activeAlert = payload;
    this.isAlarmActive = true;

    // Start physical alerts
    this.startSirenAudio();
    this.startVibration();

    this.notifyListeners();
    return true;
  }

  /**
   * Acknowledge Alert
   * Stops local siren, stops vibration, marks incident as acknowledged so it never alarms again.
   * NOTE: Acknowledged != Resolved.
   */
  public acknowledgeAlarm(incidentId?: string): void {
    const targetId = incidentId || this.activeAlert?.incidentId;
    if (targetId) {
      this.acknowledgedIncidentIds.add(targetId);
      console.log(`✅ [ALARM MANAGER] Incident ${targetId} acknowledged.`);
    }

    this.stopSirenAudio();
    this.stopVibration();
    this.isAlarmActive = false;
    this.notifyListeners();
  }

  /**
   * Stop / Mute siren without permanent acknowledgment
   */
  public stopAlarm(): void {
    this.stopSirenAudio();
    this.stopVibration();
    this.isAlarmActive = false;
    this.notifyListeners();
  }

  /**
   * Clear active banner (dismiss)
   */
  public dismissBanner(): void {
    this.stopAlarm();
    this.activeAlert = null;
    this.notifyListeners();
  }

  public isAcknowledged(incidentId: string): boolean {
    return this.acknowledgedIncidentIds.has(incidentId);
  }

  public getState() {
    return {
      isAlarmActive: this.isAlarmActive,
      activeAlert: this.activeAlert,
      isAudioUnlocked: this.isAudioUnlocked
    };
  }

  public subscribe(listener: AlarmListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('Error notifying alarm listener:', e);
      }
    });
  }
}

export const alarmManager = new EmergencyAlarmManager();
