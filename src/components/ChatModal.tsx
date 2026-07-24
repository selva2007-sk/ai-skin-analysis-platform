import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { PhoneMissed, Send } from 'lucide-react';
import { db } from '../firebase';
import { AppUser, BookingItem } from '../app/types';
import { useI18n } from '../app/settings';
import ChatHeader from './chat/ChatHeader';
import { PRESENCE_STALE_MS } from '../lib/voiceCallUtils';

interface Message {
  id: string;
  bookingId: string;
  senderUid: string;
  patientUid: string;
  doctorUid: string;
  text: string;
  createdAt: number;
  kind?: 'text' | 'call-event';
  callStatus?: string;
}

export default function ChatModal({
  booking,
  currentUser,
  canCall,
  callDisabledReason,
  onStartCall,
  onClose
}: {
  booking: BookingItem;
  currentUser: AppUser;
  canCall: boolean;
  callDisabledReason?: string;
  onStartCall: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const i18n = useI18n();
  const quickEmojis = ['👍', '🙏', '🙂', '✅', '❤️'];
  const otherPersonName = currentUser.role === 'patient' ? booking.doctorName : booking.patientName;
  const otherPersonUid = currentUser.role === 'patient' ? booking.doctorUid : booking.patientUid;

  useEffect(() => {
    const messagesRef = collection(db, 'bookings', booking.id, 'messages');
    const unsubscribe = onSnapshot(query(messagesRef), (snapshot) => {
      const fetchedMessages = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as Message));
      fetchedMessages.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(fetchedMessages);
      window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error('Chat sync error:', error);
    });

    return () => unsubscribe();
  }, [booking.id]);

  useEffect(() => {
    if (!otherPersonUid) return;

    const unsubscribe = onSnapshot(doc(db, 'bookings', booking.id, 'presence', otherPersonUid), (snapshot) => {
      const payload = snapshot.data() as { presenceStatus?: string; lastSeenAt?: number } | undefined;
      const lastSeenAt = Number(payload?.lastSeenAt || 0);
      const isOnline =
        String(payload?.presenceStatus || '').toLowerCase() === 'online' &&
        Date.now() - lastSeenAt < PRESENCE_STALE_MS;
      setIsOtherUserOnline(isOnline);
    });

    return () => unsubscribe();
  }, [booking.id, otherPersonUid]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim()) return;

    const text = newMessage.trim();
    setNewMessage('');

    await addDoc(collection(db, 'bookings', booking.id, 'messages'), {
      bookingId: booking.id,
      senderUid: currentUser.uid,
      patientUid: currentUser.role === 'patient' ? currentUser.uid : booking.patientUid,
      doctorUid: currentUser.role === 'doctor' ? currentUser.uid : booking.doctorUid,
      text,
      kind: 'text',
      createdAt: Date.now()
    });

    await updateDoc(doc(db, 'bookings', booking.id), {
      lastMessageAt: Date.now(),
      lastMessageText: text,
      lastMessageSenderId: currentUser.uid
    } as Record<string, unknown>);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-none bg-white shadow-2xl dark:bg-slate-900 sm:h-[85vh] sm:max-h-[600px] sm:rounded-[2.5rem]">
        <ChatHeader
          title={otherPersonName}
          subtitle={i18n.secureChat}
          isOnline={isOtherUserOnline}
          canCall={canCall}
          callDisabledReason={callDisabledReason}
          onStartCall={onStartCall}
          onClose={onClose}
        />

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && <p className="mt-10 text-center text-sm text-slate-400">{i18n.noMessages}</p>}
          {messages.map((msg) => {
            const isMine = msg.senderUid === currentUser.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {msg.kind === 'call-event' ? (
                  <div className="flex max-w-[88%] items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/40">
                    <PhoneMissed className="h-4 w-4 shrink-0" />
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm sm:max-w-[80%] sm:px-5 ${isMine ? 'rounded-tr-sm bg-[#2A7FFF] text-white' : 'rounded-tl-sm bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-100 bg-white px-3 pt-3 dark:border-slate-800 dark:bg-slate-900 sm:px-4">
          <div className="mb-3 flex flex-wrap gap-2 overflow-x-auto pb-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setNewMessage((prev) => `${prev}${emoji}`)}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:gap-3 sm:p-4">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={i18n.typeMessage}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#2A7FFF] dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:px-5"
          />
          <button type="submit" disabled={!newMessage.trim()} className="flex items-center justify-center rounded-2xl bg-[#2A7FFF] px-4 py-3 text-white disabled:opacity-50 sm:px-5">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
