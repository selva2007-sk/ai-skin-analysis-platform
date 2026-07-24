import { AppUser, BookingItem } from '../app/types';
import { CallParticipantSummary, CallSessionDoc, CallStatus } from './voiceCallTypes';

export const CALL_RING_TIMEOUT_MS = 35_000;
export const CALL_RECONNECT_DEBOUNCE_MS = 4_000;
export const CALL_STALE_MS = 90_000;
export const PRESENCE_STALE_MS = 45_000;

export const TERMINAL_CALL_STATES: CallStatus[] = ['declined', 'busy', 'missed', 'ended', 'failed'];

export function getCallStatusLabel(status: CallStatus) {
  switch (status) {
    case 'ringing':
      return 'Calling...';
    case 'accepted':
      return 'Connected';
    case 'declined':
      return 'Declined';
    case 'busy':
      return 'Busy';
    case 'missed':
      return 'Missed call';
    case 'ended':
      return 'Call ended';
    case 'failed':
      return 'Connection failed';
    default:
      return 'Ready';
  }
}

export function getOtherParticipant(booking: BookingItem, currentUser: AppUser): CallParticipantSummary {
  if (currentUser.role === 'patient') {
    return {
      uid: booking.doctorUid,
      name: booking.doctorName,
      role: 'doctor'
    };
  }

  return {
    uid: booking.patientUid,
    name: booking.patientName,
    role: 'patient'
  };
}

export function getCurrentParticipant(booking: BookingItem, currentUser: AppUser): CallParticipantSummary {
  if (currentUser.role === 'patient') {
    return {
      uid: booking.patientUid,
      name: booking.patientName || currentUser.email,
      role: 'patient'
    };
  }

  return {
    uid: booking.doctorUid,
    name: booking.doctorName || currentUser.email,
    role: 'doctor'
  };
}

export function isTerminalCallStatus(status?: string | null): status is CallStatus {
  return TERMINAL_CALL_STATES.includes((status || 'idle') as CallStatus);
}

export function buildCallEventMessage(status: CallStatus, actorName: string) {
  switch (status) {
    case 'missed':
      return `${actorName} missed the voice call.`;
    case 'declined':
      return `${actorName} declined the voice call.`;
    case 'busy':
      return `${actorName} was busy on another call.`;
    default:
      return `${actorName} ended the voice call.`;
  }
}

export function isCallSessionActive(session?: Pick<CallSessionDoc, 'status' | 'updatedAt'> | null) {
  if (!session) return false;
  if (isTerminalCallStatus(session.status)) return false;
  return Date.now() - (session.updatedAt || 0) < CALL_STALE_MS;
}
