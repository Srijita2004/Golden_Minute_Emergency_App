import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { alarmManager, EmergencyAlertPayload } from '../services/EmergencyAlarmManager';
import { webPushManager } from '../services/webpush';

interface EmergencyAlertContextType {
  activeAlert: EmergencyAlertPayload | null;
  isSirenPlaying: boolean;
  isAudioUnlocked: boolean;
  triggerLocalAlarm: (payload: EmergencyAlertPayload) => boolean;
  acknowledgeAlert: (incidentId?: string) => Promise<void>;
  stopSiren: () => void;
  dismissAlert: () => void;
  unlockAudio: () => Promise<boolean>;
}

const EmergencyAlertContext = createContext<EmergencyAlertContextType | undefined>(undefined);

export const EmergencyAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [alarmState, setAlarmState] = useState(() => alarmManager.getState());
  const initialLoadDoneRef = useRef<boolean>(false);
  const baselineSeenIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to Alarm Manager updates
  useEffect(() => {
    const unsubscribe = alarmManager.subscribe((state) => {
      setAlarmState(state);
    });
    return unsubscribe;
  }, []);

  // Initialize Service Worker in background
  useEffect(() => {
    webPushManager.registerServiceWorker();
  }, []);

  // Real-Time SSE Stream with short-polling fallback
  useEffect(() => {
    if (!user || !token) {
      initialLoadDoneRef.current = false;
      baselineSeenIdsRef.current.clear();
      return;
    }

    let isCancelled = false;
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    // Helper to process an incoming alert event
    const handleIncomingAlert = (alertEvent: any) => {
      if (!alertEvent || !alertEvent.data) return;
      const data = alertEvent.data;
      const incidentId = data.incidentId;
      if (!incidentId) return;

      // Deduplication: If this was present before connection established, mark seen without alarming
      if (!initialLoadDoneRef.current) {
        baselineSeenIdsRef.current.add(incidentId);
        return;
      }

      if (baselineSeenIdsRef.current.has(incidentId)) {
        return;
      }
      baselineSeenIdsRef.current.add(incidentId);

      const payload: EmergencyAlertPayload = {
        incidentId: incidentId,
        incidentType: data.incidentType || 'EMERGENCY',
        sourceType: data.sourceType || 'MONITORING_SYSTEM',
        title: alertEvent.title || '🚨 EMERGENCY DETECTED',
        body: alertEvent.body || 'New confirmed emergency incident.',
        latitude: data.latitude,
        longitude: data.longitude,
        bpm: data.bpm,
        confidence: data.confidence,
        imageUrl: data.imageUrl,
        timestamp: alertEvent.timestamp || new Date().toISOString()
      };

      alarmManager.triggerAlarm(payload);

      // Trigger standard browser notification if permitted and in foreground
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(payload.title || '🚨 EMERGENCY DETECTED', {
            body: payload.body,
            icon: '/favicon.svg',
            tag: payload.incidentId
          });
        } catch {}
      }
    };

    // 1. Initial snapshot fetch to baseline existing historical incidents
    const initBaseline = async () => {
      try {
        const res = await api.getActiveAlerts();
        if (res.alerts && Array.isArray(res.alerts)) {
          res.alerts.forEach((a: any) => {
            if (a.data?.incidentId) {
              baselineSeenIdsRef.current.add(a.data.incidentId);
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch baseline active alerts:', err);
      } finally {
        initialLoadDoneRef.current = true;
      }
    };

    initBaseline();

    // 2. Establish Real-Time SSE Stream
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';
    const streamUrl = `${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`;

    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        console.log('📡 [ALERTS] Real-time emergency SSE stream connected.');
      };

      eventSource.onmessage = (event) => {
        if (isCancelled || !event.data) return;
        try {
          const alert = JSON.parse(event.data);
          if (alert.type === 'CONNECTED') return;
          handleIncomingAlert(alert);
        } catch (e) {
          console.error('Failed to parse SSE alert event:', e);
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected, fallback to polling
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch (e) {
      console.warn('SSE not supported or failed to connect, using polling fallback:', e);
    }

    // 3. Robust Polling Fallback (every 3.5 seconds)
    pollInterval = setInterval(async () => {
      if (isCancelled) return;
      try {
        const res = await api.getActiveAlerts();
        if (res.alerts && Array.isArray(res.alerts)) {
          res.alerts.forEach((a: any) => {
            handleIncomingAlert(a);
          });
        }
      } catch {}
    }, 3500);

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [user, token]);

  const acknowledgeAlert = async (incidentId?: string) => {
    const targetId = incidentId || alarmState.activeAlert?.incidentId;
    alarmManager.acknowledgeAlarm(targetId);

    // If user is Admin or Hospital, persist ACKNOWLEDGED status to backend
    if (targetId && user?.role && ['ADMIN', 'HOSPITAL'].includes(user.role.toUpperCase())) {
      try {
        await api.updateIncidentStatus(targetId, 'ACKNOWLEDGED');
      } catch (err) {
        console.warn('Failed to update status on server:', err);
      }
    }
  };

  return (
    <EmergencyAlertContext.Provider
      value={{
        activeAlert: alarmState.activeAlert,
        isSirenPlaying: alarmState.isAlarmActive,
        isAudioUnlocked: alarmState.isAudioUnlocked,
        triggerLocalAlarm: (p) => alarmManager.triggerAlarm(p),
        acknowledgeAlert,
        stopSiren: () => alarmManager.stopAlarm(),
        dismissAlert: () => alarmManager.dismissBanner(),
        unlockAudio: () => alarmManager.unlockAudio()
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
