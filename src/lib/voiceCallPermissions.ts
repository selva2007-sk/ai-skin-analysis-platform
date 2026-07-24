import { Capacitor } from '@capacitor/core';

export type PermissionStateValue = 'granted' | 'denied' | 'prompt' | 'unsupported';

export type VoicePermissionResult = {
  microphone: PermissionStateValue;
  notifications: PermissionStateValue;
  stream?: MediaStream;
  error?: string;
};

function normalizePermissionState(value?: PermissionState | NotificationPermission | string | null): PermissionStateValue {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  if (value === 'prompt' || value === 'default') return 'prompt';
  return 'unsupported';
}

export async function requestNotificationPermission(): Promise<PermissionStateValue> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }

  try {
    if (Notification.permission === 'default') {
      return normalizePermissionState(await Notification.requestPermission());
    }
    return normalizePermissionState(Notification.permission);
  } catch {
    return normalizePermissionState(Notification.permission);
  }
}

export async function requestVoicePermissions(): Promise<VoicePermissionResult> {
  const notifications = await requestNotificationPermission();

  // On most mobile browsers, microphone access is blocked unless the page is a secure context (HTTPS)
  // or localhost. This shows up as a confusing permission error, so we gate it explicitly.
  if (
    typeof window !== 'undefined' &&
    !window.isSecureContext &&
    !isCapacitorRuntime() &&
    typeof location !== 'undefined' &&
    !['localhost', '127.0.0.1'].includes(location.hostname)
  ) {
    return {
      microphone: 'denied',
      notifications,
      error: 'Voice calls require HTTPS on mobile browsers. Open the app over https:// (or use the native build) to enable the microphone.'
    };
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      microphone: 'unsupported',
      notifications,
      error: 'Microphone access is not supported in this browser.'
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });

    return {
      microphone: 'granted',
      notifications,
      stream
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Microphone permission was denied.';
    return {
      microphone: 'denied',
      notifications,
      error: message
    };
  }
}

export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function triggerIncomingCallVibration() {
  if (canVibrate()) {
    navigator.vibrate([250, 150, 250, 150, 350]);
  }
}

export function stopIncomingCallVibration() {
  if (canVibrate()) {
    navigator.vibrate(0);
  }
}

export function isCapacitorRuntime() {
  return Capacitor.isNativePlatform();
}
