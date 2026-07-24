import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppUser, BookingItem } from '../app/types';
import {
  requestVoicePermissions,
  isCapacitorRuntime,
  stopIncomingCallVibration,
  triggerIncomingCallVibration
} from '../lib/voiceCallPermissions';
import {
  buildCallEventMessage,
  CALL_RING_TIMEOUT_MS,
  getCurrentParticipant,
  getOtherParticipant,
  isCallSessionActive,
  isTerminalCallStatus
} from '../lib/voiceCallUtils';
import { createCallSession, patchCallSession, pushIceCandidate, subscribeToCallSession, subscribeToRemoteIceCandidates } from '../lib/voiceCallSignaling';
import { CallSessionDoc, CallUiState } from '../lib/voiceCallTypes';
import { fetchApiJson } from '../lib/apiClient';
import { useWebRTCAudioSession } from './useWebRTCAudioSession';

type VoiceCallManagerOptions = {
  user: AppUser | null;
  bookings: BookingItem[];
  apiBase?: string;
  onError?: (message: string) => void;
};

type BookingCallAccess = {
  canCall: boolean;
  reason?: string;
};

function isServerReachabilityError(message: string) {
  return /unable to reach the call server|failed to fetch|networkerror|load failed|cors/i.test(message);
}

function isSecureCallContext() {
  if (typeof window === 'undefined') return true;
  if (isCapacitorRuntime()) return true;
  if (window.isSecureContext) return true;
  if (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)) return true;
  return false;
}

function makeCallId() {
  return `call_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function createRingtonePlayer() {
  let context: AudioContext | null = null;
  let timer: number | null = null;

  const playBurst = () => {
    try {
      context = context || new AudioContext();
      const now = context.currentTime;
      [0, 0.22].forEach((offset) => {
        const oscillator = context!.createOscillator();
        const gain = context!.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = offset === 0 ? 740 : 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.05, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
        oscillator.connect(gain);
        gain.connect(context!.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.2);
      });
    } catch {}
  };

  return {
    start() {
      if (timer) return;
      playBurst();
      timer = window.setInterval(playBurst, 1800);
    },
    stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }
  };
}

export function useVoiceCallManager({ user, bookings, apiBase, onError }: VoiceCallManagerOptions) {
  const [uiState, setUiState] = useState<CallUiState>('idle');
  const [currentBooking, setCurrentBooking] = useState<BookingItem | null>(null);
  const [currentSession, setCurrentSession] = useState<CallSessionDoc | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [timerLabel, setTimerLabel] = useState('00:00');
  const currentSessionRef = useRef<CallSessionDoc | null>(null);
  const currentBookingRef = useRef<BookingItem | null>(null);
  const isCallerRef = useRef(false);
  const ringTimeoutRef = useRef<number | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const candidateUnsubscribeRef = useRef<(() => void) | null>(null);
  const ringtoneRef = useRef(createRingtonePlayer());
  const sessionUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const apiBaseRef = useRef(apiBase || '');

  useEffect(() => {
    if (apiBase) apiBaseRef.current = apiBase;
  }, [apiBase]);

  const webRtc = useWebRTCAudioSession({
    onLocalCandidate: async (candidate) => {
      const bookingId = currentBookingRef.current?.id;
      if (!bookingId) return;
      const type = isCallerRef.current ? 'offer' : 'answer';
      await pushIceCandidate(db, bookingId, type, candidate);
    },
    onIceStateChange: (state) => {
      if ((state === 'disconnected' || state === 'failed') && isCallerRef.current && currentBookingRef.current) {
        webRtc.scheduleIceRestart(async (offer) => {
          if (!offer || !currentBookingRef.current) return;
          await patchCallSession(db, currentBookingRef.current.id, {
            offer,
            lastSignalingAt: Date.now(),
            updatedAt: Date.now()
          });
        });
      }
    }
  });

  const setError = useCallback((message: string) => {
    setPermissionError(message);
    onError?.(message);
  }, [onError]);

  const stopRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const stopAttentionEffects = useCallback(() => {
    ringtoneRef.current.stop();
    stopIncomingCallVibration();
  }, []);

  const clearCandidateSubscription = useCallback(() => {
    if (candidateUnsubscribeRef.current) {
      candidateUnsubscribeRef.current();
      candidateUnsubscribeRef.current = null;
    }
  }, []);

  const cleanupLocalCallState = useCallback(() => {
    stopRingTimeout();
    stopAttentionEffects();
    clearCandidateSubscription();
    callStartedAtRef.current = null;
    currentSessionRef.current = null;
    currentBookingRef.current = null;
    setCurrentSession(null);
    setCurrentBooking(null);
    setUiState('idle');
    setTimerLabel('00:00');
    webRtc.reset();
  }, [clearCandidateSubscription, stopAttentionEffects, stopRingTimeout, webRtc]);

  const subscribeCandidatesForCurrentCall = useCallback((bookingId: string, expectType: 'offer' | 'answer') => {
    clearCandidateSubscription();
    candidateUnsubscribeRef.current = subscribeToRemoteIceCandidates(db, bookingId, expectType, async (candidate) => {
      try {
        await webRtc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('[VoiceCall] Failed to apply ICE candidate:', error);
      }
    });
  }, [clearCandidateSubscription, webRtc]);

  const syncUserPresence = useCallback(async (payload: Record<string, unknown>) => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...payload,
        lastSeenAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.warn('[VoiceCall] Failed to sync user presence:', error);
    }
  }, [user?.uid]);

  const setInCallPresence = useCallback(async (status: 'idle' | 'ringing' | 'in-call', bookingId?: string | null) => {
    await syncUserPresence({
      presenceStatus: 'online',
      callStatus: status,
      currentCallBookingId: bookingId || null
    });
  }, [syncUserPresence]);

  const appendCallMessage = useCallback(async (booking: BookingItem, status: CallSessionDoc['status'], actorName: string) => {
    if (!user?.uid) return;

    const text = buildCallEventMessage(status, actorName);
    await addDoc(collection(db, 'bookings', booking.id, 'messages'), {
      bookingId: booking.id,
      senderUid: user.uid,
      patientUid: booking.patientUid,
      doctorUid: booking.doctorUid,
      text,
      kind: 'call-event',
      callStatus: status,
      createdAt: Date.now()
    });

    await updateDoc(doc(db, 'bookings', booking.id), {
      lastMessageAt: Date.now(),
      lastMessageText: text,
      lastMessageSenderId: user.uid
    } as Record<string, unknown>);
  }, [user?.uid]);

  const finalizeTerminalSession = useCallback(async (session: CallSessionDoc, booking: BookingItem) => {
    if (currentSessionRef.current?.callId !== session.callId) return;
    await setInCallPresence('idle', null);
    cleanupLocalCallState();
    if (session.status === 'missed' || session.status === 'declined' || session.status === 'busy') {
      setError(buildCallEventMessage(session.status, session.calleeName));
    }
  }, [cleanupLocalCallState, setError, setInCallPresence]);

  const handleAcceptedSession = useCallback(async (session: CallSessionDoc, booking: BookingItem) => {
    if (!callStartedAtRef.current) {
      callStartedAtRef.current = session.acceptedAt || Date.now();
    }
    setCurrentSession(session);
    currentSessionRef.current = session;
    currentBookingRef.current = booking;
    setCurrentBooking(booking);
    setUiState('active');
    stopAttentionEffects();
    stopRingTimeout();
    await setInCallPresence('in-call', booking.id);

    if (isCallerRef.current && session.answer) {
      await webRtc.applyAnswer(session.answer);
    }

    if (!isCallerRef.current && session.offer) {
      const answer = await webRtc.handleRemoteOffer(session.offer);
      if (answer) {
        await patchCallSession(db, booking.id, {
          answer,
          updatedAt: Date.now(),
          acceptedAt: session.acceptedAt || Date.now(),
          status: 'accepted'
        });
      }
    }
  }, [setInCallPresence, stopAttentionEffects, stopRingTimeout, webRtc]);

  const handleSessionUpdate = useCallback(async (booking: BookingItem, session: CallSessionDoc | null) => {
    if (!user?.uid || !session) return;
    const isParticipant = session.callerUid === user.uid || session.calleeUid === user.uid;
    if (!isParticipant) return;

    const anotherCallIsActive =
      currentSessionRef.current &&
      currentSessionRef.current.callId !== session.callId &&
      !isTerminalCallStatus(currentSessionRef.current.status);

    if (session.status === 'ringing' && session.calleeUid === user.uid && anotherCallIsActive) {
      await patchCallSession(db, booking.id, {
        status: 'busy',
        updatedAt: Date.now(),
        endedAt: Date.now(),
        endedByUid: user.uid,
        endReason: 'User is already on another call.'
      });
      await appendCallMessage(booking, 'busy', booking.patientUid === user.uid ? booking.patientName : booking.doctorName);
      return;
    }

    if (currentSessionRef.current?.callId === session.callId) {
      setCurrentSession(session);
      currentSessionRef.current = session;
      if (session.answer && isCallerRef.current) {
        await webRtc.applyAnswer(session.answer);
      }
      if (session.status === 'accepted') {
        await handleAcceptedSession(session, booking);
      }
      if (isTerminalCallStatus(session.status)) {
        await finalizeTerminalSession(session, booking);
      }
      return;
    }

    if (!isCallSessionActive(session)) return;

    if (session.status === 'ringing' && session.calleeUid === user.uid) {
      currentSessionRef.current = session;
      currentBookingRef.current = booking;
      setCurrentSession(session);
      setCurrentBooking(booking);
      setUiState('incoming');
      ringtoneRef.current.start();
      triggerIncomingCallVibration();
      await setInCallPresence('ringing', booking.id);
      return;
    }
  }, [appendCallMessage, finalizeTerminalSession, handleAcceptedSession, setInCallPresence, user?.uid, webRtc]);

  const rejectIncomingCall = useCallback(async (status: 'declined' | 'missed' = 'declined') => {
    const booking = currentBookingRef.current;
    const session = currentSessionRef.current;
    if (!booking || !session || !user?.uid) return;

    await patchCallSession(db, booking.id, {
      status,
      updatedAt: Date.now(),
      endedAt: Date.now(),
      endedByUid: user.uid,
      endReason: status === 'missed' ? 'Call was not answered in time.' : 'Call was declined.'
    });
    await appendCallMessage(booking, status, getCurrentParticipant(booking, user).name);
    await setInCallPresence('idle', null);
    cleanupLocalCallState();
  }, [appendCallMessage, cleanupLocalCallState, setInCallPresence, user]);

  const acceptIncomingCall = useCallback(async () => {
    const booking = currentBookingRef.current;
    const session = currentSessionRef.current;
    if (!booking || !session || !session.offer || !user) return;

    const permissions = await requestVoicePermissions();
    if (permissions.microphone !== 'granted') {
      setError(permissions.error || 'Microphone permission is required for voice calls.');
      return;
    }

    try {
      isCallerRef.current = false;
      subscribeCandidatesForCurrentCall(booking.id, 'offer');
      const answer = await webRtc.handleRemoteOffer(session.offer, permissions.stream);
      const acceptedAt = Date.now();
      await patchCallSession(db, booking.id, {
        status: 'accepted',
        answer,
        acceptedAt,
        updatedAt: acceptedAt,
        lastSignalingAt: acceptedAt
      });
      callStartedAtRef.current = acceptedAt;
      await handleAcceptedSession({ ...session, status: 'accepted', answer, acceptedAt, updatedAt: acceptedAt }, booking);
    } catch (error) {
      console.error('[VoiceCall] Failed to accept call:', error);
      setError(error instanceof Error ? error.message : 'Unable to connect the call.');
      await rejectIncomingCall('missed');
    }
  }, [handleAcceptedSession, rejectIncomingCall, setError, subscribeCandidatesForCurrentCall, user, webRtc]);

  const notifyIncomingCall = useCallback(async (booking: BookingItem) => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    try {
      const result = await fetchApiJson<{ success?: boolean; error?: string }>(
        '/api/calls/notify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ bookingId: booking.id })
        },
        {
          preferredBase: apiBaseRef.current,
          featureLabel: 'call server'
        }
      );
      apiBaseRef.current = result.base;
      if (!result.response.ok || result.data?.success === false) {
        throw new Error(result.data?.error || 'Failed to notify the other participant.');
      }
    } catch (error) {
      console.warn('[VoiceCall] Failed to trigger incoming call push:', error);
    }
  }, []);

  const validateBookingOnServer = useCallback(async (booking: BookingItem) => {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    if (!token) return true;

    try {
      const result = await fetchApiJson<{ allowed?: boolean; error?: string }>(
        '/api/calls/validate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ bookingId: booking.id })
        },
        {
          preferredBase: apiBaseRef.current,
          featureLabel: 'call server'
        }
      );
      apiBaseRef.current = result.base;

      if (!result.response.ok) {
        throw new Error(result.data?.error || 'Server validation failed.');
      }

      const payload = result.data;
      if (!payload?.allowed) {
        throw new Error(payload?.error || 'Call is not allowed for this booking.');
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server validation failed.';
      if (isServerReachabilityError(message)) {
        console.warn('[VoiceCall] Call server unavailable, falling back to local booking validation:', message);
        return true;
      }
      setError(message);
      return false;
    }
  }, [setError, user?.uid]);

  const startCall = useCallback(async (booking: BookingItem) => {
    if (!user?.uid) return;
    if (!isSecureCallContext()) {
      setError('Voice calls require HTTPS on mobile browsers. Open the app over https:// (or use the native build) and try again.');
      return;
    }

    const isValidOnServer = await validateBookingOnServer(booking);
    if (!isValidOnServer) return;

    if (currentSessionRef.current && !isTerminalCallStatus(currentSessionRef.current.status)) {
      setError('Finish the current call before starting another one.');
      return;
    }

    const permissions = await requestVoicePermissions();
    if (permissions.microphone !== 'granted') {
      setError(permissions.error || 'Microphone permission is required for voice calls.');
      return;
    }

    const caller = getCurrentParticipant(booking, user);
    const callee = getOtherParticipant(booking, user);
    const createdAt = Date.now();
    const session: CallSessionDoc = {
      callId: makeCallId(),
      bookingId: booking.id,
      status: 'ringing',
      callerUid: caller.uid,
      calleeUid: callee.uid,
      callerName: caller.name,
      calleeName: callee.name,
      callerRole: caller.role,
      calleeRole: callee.role,
      startedByUid: caller.uid,
      createdAt,
      updatedAt: createdAt,
      expiresAt: createdAt + CALL_RING_TIMEOUT_MS,
      lastSignalingAt: createdAt
    };

    try {
      isCallerRef.current = true;
      currentSessionRef.current = session;
      currentBookingRef.current = booking;
      setCurrentSession(session);
      setCurrentBooking(booking);
      setUiState('outgoing');
      await setInCallPresence('ringing', booking.id);
      await createCallSession(db, booking.id, session);
      subscribeCandidatesForCurrentCall(booking.id, 'answer');
      const offer = await webRtc.createOffer(permissions.stream);
      await patchCallSession(db, booking.id, {
        offer,
        updatedAt: Date.now(),
        lastSignalingAt: Date.now()
      });
      await notifyIncomingCall(booking);

      stopRingTimeout();
      ringTimeoutRef.current = window.setTimeout(async () => {
        const liveSession = currentSessionRef.current;
        if (!liveSession || liveSession.bookingId !== booking.id || liveSession.status !== 'ringing') return;
        await patchCallSession(db, booking.id, {
          status: 'missed',
          updatedAt: Date.now(),
          endedAt: Date.now(),
          endReason: 'Call timed out without answer.',
          endedByUid: user.uid
        });
        await appendCallMessage(booking, 'missed', callee.name);
        await setInCallPresence('idle', null);
        cleanupLocalCallState();
      }, CALL_RING_TIMEOUT_MS);
    } catch (error) {
      console.error('[VoiceCall] Failed to start call:', error);
      setError(error instanceof Error ? error.message : 'Unable to start the call.');
      await setInCallPresence('idle', null);
      cleanupLocalCallState();
    }
  }, [appendCallMessage, cleanupLocalCallState, notifyIncomingCall, setError, setInCallPresence, stopRingTimeout, subscribeCandidatesForCurrentCall, user, validateBookingOnServer, webRtc]);

  const endCall = useCallback(async () => {
    const booking = currentBookingRef.current;
    const session = currentSessionRef.current;
    if (!booking || !session || !user?.uid) {
      cleanupLocalCallState();
      return;
    }

    const nextStatus = session.status === 'ringing' ? 'ended' : 'ended';
    try {
      await patchCallSession(db, booking.id, {
        status: nextStatus,
        updatedAt: Date.now(),
        endedAt: Date.now(),
        endedByUid: user.uid,
        endReason: 'Call ended by participant.'
      });
    } finally {
      await setInCallPresence('idle', null);
      cleanupLocalCallState();
    }
  }, [cleanupLocalCallState, setInCallPresence, user?.uid]);

  const getBookingCallAccess = useCallback((booking: BookingItem): BookingCallAccess => {
    if (!user?.uid) {
      return { canCall: false, reason: 'Sign in to place a call.' };
    }
    if (!isSecureCallContext()) {
      return { canCall: false, reason: 'Voice calls require HTTPS on mobile browsers.' };
    }
    if (currentSessionRef.current && currentSessionRef.current.bookingId !== booking.id && !isTerminalCallStatus(currentSessionRef.current.status)) {
      return { canCall: false, reason: 'Another call is already in progress.' };
    }
    return { canCall: true };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    bookings.forEach((booking) => {
      if (sessionUnsubsRef.current.has(booking.id)) return;
      const unsubscribe = subscribeToCallSession(db, booking.id, (session) => {
        void handleSessionUpdate(booking, session);
      });
      sessionUnsubsRef.current.set(booking.id, unsubscribe);
    });

    Array.from(sessionUnsubsRef.current.entries()).forEach(([bookingId, unsubscribe]) => {
      if (bookings.some((booking) => booking.id === bookingId)) return;
      unsubscribe();
      sessionUnsubsRef.current.delete(bookingId);
    });

    return () => {
      Array.from(sessionUnsubsRef.current.values()).forEach((unsubscribe) => unsubscribe());
      sessionUnsubsRef.current.clear();
    };
  }, [bookings, handleSessionUpdate, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const markOnline = () => {
      void syncUserPresence({
        presenceStatus: document.visibilityState === 'visible' ? 'online' : 'away'
      });
    };

    markOnline();
    const interval = window.setInterval(markOnline, 20_000);
    document.addEventListener('visibilitychange', markOnline);
    window.addEventListener('beforeunload', markOnline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', markOnline);
      window.removeEventListener('beforeunload', markOnline);
    };
  }, [syncUserPresence, user?.uid]);

  useEffect(() => {
    if (uiState !== 'active' || !callStartedAtRef.current) return;
    const tick = () => {
      const diff = Math.max(0, Date.now() - (callStartedAtRef.current || Date.now()));
      const minutes = String(Math.floor(diff / 60_000)).padStart(2, '0');
      const seconds = String(Math.floor((diff % 60_000) / 1000)).padStart(2, '0');
      setTimerLabel(`${minutes}:${seconds}`);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [uiState]);

  useEffect(() => () => cleanupLocalCallState(), [cleanupLocalCallState]);

  return useMemo(() => ({
    uiState,
    currentBooking,
    currentSession,
    timerLabel,
    permissionError,
    connectionState: webRtc.connectionState,
    networkQuality: webRtc.networkQuality,
    isMuted: webRtc.isMuted,
    isSpeakerOn: webRtc.isSpeakerOn,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute: webRtc.toggleMute,
    toggleSpeaker: webRtc.toggleSpeaker,
    getBookingCallAccess
  }), [
    acceptIncomingCall,
    currentBooking,
    currentSession,
    endCall,
    getBookingCallAccess,
    permissionError,
    rejectIncomingCall,
    startCall,
    timerLabel,
    uiState,
    webRtc.connectionState,
    webRtc.isMuted,
    webRtc.isSpeakerOn,
    webRtc.networkQuality,
    webRtc.toggleMute,
    webRtc.toggleSpeaker
  ]);
}
