import { getToken, isSupported, Messaging, onMessage, getMessaging } from 'firebase/messaging';
import { app } from '../firebase';

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let messagingInstancePromise: Promise<Messaging | null> | null = null;

const getServiceWorkerRegistration = async () => {
  if (serviceWorkerRegistrationPromise) return serviceWorkerRegistrationPromise;

  serviceWorkerRegistrationPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    } catch (error) {
      console.warn('[Push] Service worker registration failed:', error);
      return null;
    }
  })();

  return serviceWorkerRegistrationPromise;
};

const getMessagingInstance = async () => {
  if (messagingInstancePromise) return messagingInstancePromise;

  messagingInstancePromise = (async () => {
    if (typeof window === 'undefined') return null;
    try {
      const supported = await isSupported();
      if (!supported) return null;
      return getMessaging(app);
    } catch (error) {
      console.warn('[Push] Firebase messaging is not supported here:', error);
      return null;
    }
  })();

  return messagingInstancePromise;
};

export async function registerPushToken() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return null;
  }

  const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  if (!vapidKey) {
    console.warn('[Push] VITE_FIREBASE_VAPID_KEY is missing, skipping token registration.');
    return null;
  }

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission().catch(() => Notification.permission)
    : Notification.permission;

  if (permission !== 'granted') {
    return null;
  }

  const [registration, messaging] = await Promise.all([
    getServiceWorkerRegistration(),
    getMessagingInstance()
  ]);

  if (!registration || !messaging) {
    return null;
  }

  try {
    return await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });
  } catch (error) {
    console.warn('[Push] Failed to get FCM token:', error);
    return null;
  }
}

export async function subscribeToForegroundMessages(
  handler: (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => void
) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    handler({
      notification: {
        title: payload.notification?.title,
        body: payload.notification?.body
      },
      data: payload.data
    });
  });
}
