import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface WebPushStatus {
  supported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  error?: string;
}

class WebPushManager {
  private swRegistration: ServiceWorkerRegistration | null = null;

  public async getStatus(): Promise<WebPushStatus> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return {
        supported: false,
        permission: 'denied',
        isSubscribed: false,
        error: 'Web Push not supported in this browser'
      };
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        return {
          supported: true,
          permission: Notification.permission,
          isSubscribed: false
        };
      }

      this.swRegistration = reg;
      const sub = await reg.pushManager.getSubscription();
      return {
        supported: true,
        permission: Notification.permission,
        isSubscribed: sub !== null
      };
    } catch (e: any) {
      return {
        supported: true,
        permission: Notification.permission,
        isSubscribed: false,
        error: e.message
      };
    }
  }

  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = registration;
      console.log('✅ [WEBPUSH] Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (err) {
      console.error('❌ [WEBPUSH] Service Worker registration failed:', err);
      return null;
    }
  }

  public async getExistingSubscription(): Promise<PushSubscription | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return null;
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  public async subscribe(): Promise<{ success: boolean; error?: string }> {
    return this.subscribeToEmergencyAlerts();
  }

  public async subscribeToEmergencyAlerts(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
        return { success: false, error: 'Web Push notifications are not supported in this browser.' };
      }

      // 1. Request Browser Notification Permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was denied by user.' };
      }

      // 2. Ensure Service Worker is registered and active
      let reg: ServiceWorkerRegistration | null = this.swRegistration || (await navigator.serviceWorker.getRegistration()) || null;
      if (!reg) {
        reg = await this.registerServiceWorker();
      }
      if (!reg) {
        return { success: false, error: 'Failed to initialize Service Worker.' };
      }

      await navigator.serviceWorker.ready;

      // 3. Fetch VAPID Public Key from backend
      const vapidRes = await api.getVapidPublicKey();
      const publicKey = vapidRes.publicKey;
      if (!publicKey) {
        return { success: false, error: 'VAPID public key unavailable from server.' };
      }

      // 4. Subscribe to PushManager
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource
        });
      }

      const subJson = sub.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        return { success: false, error: 'Invalid PushSubscription returned by browser.' };
      }

      // 5. Send subscription to Golden Minute backend
      await api.subscribeWebPush({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        },
        user_agent: navigator.userAgent
      });

      console.log('✅ [WEBPUSH] Successfully subscribed to Emergency Alerts with server.');
      return { success: true };
    } catch (err: any) {
      console.error('❌ [WEBPUSH] Emergency alert subscription error:', err);
      return { success: false, error: err.message || 'Subscription failed.' };
    }
  }

  public async unsubscribe(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await api.unsubscribeWebPush(endpoint);
      }
      return true;
    } catch (err) {
      console.error('Failed to unsubscribe Web Push:', err);
      return false;
    }
  }
}

export const webPushManager = new WebPushManager();
