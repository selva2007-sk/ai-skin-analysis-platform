import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Firestore
} from 'firebase/firestore';
import { CallSessionDoc, SerializedIceCandidate } from './voiceCallTypes';

const ACTIVE_CALL_DOC_ID = 'active_session';

export function getActiveCallDocRef(db: Firestore, bookingId: string) {
  return doc(db, 'bookings', bookingId, 'calls', ACTIVE_CALL_DOC_ID);
}

export function getOfferCandidatesCollection(db: Firestore, bookingId: string) {
  return collection(db, 'bookings', bookingId, 'calls', ACTIVE_CALL_DOC_ID, 'offerCandidates');
}

export function getAnswerCandidatesCollection(db: Firestore, bookingId: string) {
  return collection(db, 'bookings', bookingId, 'calls', ACTIVE_CALL_DOC_ID, 'answerCandidates');
}

export async function createCallSession(db: Firestore, bookingId: string, payload: CallSessionDoc) {
  await setDoc(getActiveCallDocRef(db, bookingId), payload);
}

export async function patchCallSession(db: Firestore, bookingId: string, updates: Partial<CallSessionDoc>) {
  await updateDoc(getActiveCallDocRef(db, bookingId), updates as Record<string, unknown>);
}

export function subscribeToCallSession(
  db: Firestore,
  bookingId: string,
  callback: (session: CallSessionDoc | null) => void
) {
  return onSnapshot(getActiveCallDocRef(db, bookingId), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as CallSessionDoc) : null);
  });
}

export async function pushIceCandidate(
  db: Firestore,
  bookingId: string,
  type: 'offer' | 'answer',
  candidate: SerializedIceCandidate
) {
  const target = type === 'offer'
    ? getOfferCandidatesCollection(db, bookingId)
    : getAnswerCandidatesCollection(db, bookingId);

  await addDoc(target, {
    ...candidate,
    createdAt: Date.now()
  });
}

export function subscribeToRemoteIceCandidates(
  db: Firestore,
  bookingId: string,
  type: 'offer' | 'answer',
  onCandidate: (candidate: SerializedIceCandidate) => void
) {
  const seen = new Set<string>();
  const target = type === 'offer'
    ? getOfferCandidatesCollection(db, bookingId)
    : getAnswerCandidatesCollection(db, bookingId);

  return onSnapshot(target, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;
      if (seen.has(change.doc.id)) return;
      seen.add(change.doc.id);
      onCandidate(change.doc.data() as SerializedIceCandidate);
    });
  });
}
