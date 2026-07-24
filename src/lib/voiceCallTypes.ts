export type CallStatus =
  | 'idle'
  | 'ringing'
  | 'accepted'
  | 'declined'
  | 'busy'
  | 'missed'
  | 'ended'
  | 'failed';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'reconnecting' | 'unknown';

export type SerializedSessionDescription = {
  type: RTCSdpType;
  sdp: string;
};

export type SerializedIceCandidate = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export type CallParticipantSummary = {
  uid: string;
  name: string;
  role: 'patient' | 'doctor';
};

export type CallSessionDoc = {
  callId: string;
  bookingId: string;
  status: CallStatus;
  callerUid: string;
  calleeUid: string;
  callerName: string;
  calleeName: string;
  callerRole: 'patient' | 'doctor';
  calleeRole: 'patient' | 'doctor';
  startedByUid: string;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number | null;
  endedAt?: number | null;
  expiresAt?: number | null;
  lastSignalingAt?: number | null;
  endedByUid?: string | null;
  endReason?: string | null;
  offer?: SerializedSessionDescription | null;
  answer?: SerializedSessionDescription | null;
};

export type CallUiState = 'idle' | 'outgoing' | 'incoming' | 'active';
