import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export interface AlertEvent {
  alert_id: string;
  title: string;
  body: string;
  data: {
    incidentId: string;
    incidentType: string;
    eventId: string;
    sourceType: string;
    latitude?: string;
    longitude?: string;
    bpm?: string;
    confidence?: string;
  };
  timestamp: string;
}

interface EmergencyAlertContextType {
  activeAlert: AlertEvent | null;
  dismissAlert: () => void;
  triggerLocalSiren: () => void;
  stopSiren: () => void;
  isSirenPlaying: boolean;
}

const EmergencyAlertContext = createContext<EmergencyAlertContextType | undefined>(undefined);

export const EmergencyAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeAlert, setActiveAlert] = useState<AlertEvent | null>(null);
  const [isSirenPlaying, setIsSirenPlaying] = useState<boolean>(false);
  const seenAlertIds = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Initialize Web Audio API siren
  const playEmergencySiren = () => {
    try {
      if (audioContextRef.current) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      // Frequency modulation for siren effect (800Hz <-> 1200Hz)
      const now = ctx.currentTime;
      for (let i = 0; i < 20; i++) {
        osc.frequency.linearRampToValueAtTime(1200, now + i * 0.5 + 0.25);
        osc.frequency.linearRampToValueAtTime(800, now + i * 0.5 + 0.5);
      }

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscillatorRef.current = osc;
      setIsSirenPlaying(true);

      // Trigger hardware vibration if OS / device allows
      if ('vibrate' in navigator) {
        navigator.vibrate([500, 250, 500, 250, 500, 250, 1000]);
      }
    } catch (e) {
      console.log('Audio playback permission pending user gesture:', e);
    }
  };

  const stopSiren = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch {}
    setIsSirenPlaying(false);
  };

  const dismissAlert = () => {
    stopSiren();
    setActiveAlert(null);
  };

  // Poll for real-time emergency events when user is logged in
  useEffect(() => {
    if (!user) return;

    // Register web notification token if permitted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const interval = setInterval(async () => {
      try {
        const res = await api.getActiveAlerts();
        if (res.alerts && res.alerts.length > 0) {
          const latest = res.alerts[0];
          if (!seenAlertIds.current.has(latest.alert_id)) {
            seenAlertIds.current.add(latest.alert_id);
            setActiveAlert(latest);
            playEmergencySiren();

            // Browser Notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(latest.title, {
                body: latest.body,
                icon: '/favicon.ico',
                tag: latest.alert_id
              });
            }
          }
        }
      } catch (err) {
        // Silently continue polling
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <EmergencyAlertContext.Provider
      value={{
        activeAlert,
        dismissAlert,
        triggerLocalSiren: playEmergencySiren,
        stopSiren,
        isSirenPlaying
      }}
    >
      {children}
    </EmergencyAlertContext.Provider>
  );
};

export const useEmergencyAlert = () => {
  const context = useContext(EmergencyAlertContext);
  if (!context) throw new Error('useEmergencyAlert must be used within EmergencyAlertProvider');
  return context;
};
