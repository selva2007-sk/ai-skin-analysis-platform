import { Phone, PhoneOff } from 'lucide-react';

type IncomingCallScreenProps = {
  callerName: string;
  callerRoleLabel: string;
  onAccept: () => void;
  onReject: () => void;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export default function IncomingCallScreen({
  callerName,
  callerRoleLabel,
  onAccept,
  onReject
}: IncomingCallScreenProps) {
  return (
    <div className="fixed inset-0 z-[680] bg-slate-950 text-white">
      <div className="flex min-h-screen flex-col items-center justify-between px-6 py-12">
        <div className="w-full text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-white/50">Incoming voice call</p>
          <div className="mx-auto mt-14 flex h-36 w-36 items-center justify-center rounded-full bg-white/10 text-4xl font-black shadow-[0_0_0_16px_rgba(255,255,255,0.05),0_0_0_32px_rgba(42,127,255,0.14)]">
            {getInitials(callerName)}
          </div>
          <h2 className="mt-8 text-4xl font-black">{callerName}</h2>
          <p className="mt-3 text-base text-white/60">{callerRoleLabel}</p>
        </div>

        <div className="mb-8 flex w-full max-w-xs items-center justify-between">
          <button
            type="button"
            onClick={onReject}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-red-500 p-5 text-white shadow-lg shadow-red-950/35"
          >
            <PhoneOff className="h-8 w-8" />
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex h-18 w-18 items-center justify-center rounded-full bg-emerald-500 p-5 text-white shadow-lg shadow-emerald-950/35"
          >
            <Phone className="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
