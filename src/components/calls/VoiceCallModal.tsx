import { PhoneOff } from 'lucide-react';
import { CallStatus } from '../../lib/voiceCallTypes';
import { getCallStatusLabel } from '../../lib/voiceCallUtils';

type VoiceCallModalProps = {
  name: string;
  status: CallStatus;
  roleLabel: string;
  onEnd: () => void;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export default function VoiceCallModal({ name, status, roleLabel, onEnd }: VoiceCallModalProps) {
  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center bg-slate-950/90 px-6">
      <div className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 px-8 py-12 text-center text-white shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(42,127,255,0.28),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.22),_transparent_45%)]" />
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/25" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-black tracking-[0.08em]">
            {getInitials(name)}
          </div>
        </div>
        <p className="relative mt-6 text-xs font-black uppercase tracking-[0.3em] text-white/55">{roleLabel}</p>
        <h2 className="relative mt-2 text-3xl font-black">{name}</h2>
        <p className="relative mt-2 text-base text-white/70">{getCallStatusLabel(status)}</p>
        <button
          type="button"
          onClick={onEnd}
          className="relative mt-10 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/35 transition-transform hover:scale-[1.03]"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
