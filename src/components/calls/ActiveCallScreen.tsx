import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Wifi, WifiLow, WifiZero } from 'lucide-react';
import { NetworkQuality } from '../../lib/voiceCallTypes';

type ActiveCallScreenProps = {
  name: string;
  timerLabel: string;
  networkQuality: NetworkQuality;
  isMuted: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEnd: () => void;
};

const qualityMeta: Record<NetworkQuality, { label: string; icon: typeof Wifi }> = {
  excellent: { label: 'Excellent', icon: Wifi },
  good: { label: 'Good', icon: Wifi },
  poor: { label: 'Weak', icon: WifiLow },
  reconnecting: { label: 'Reconnecting', icon: WifiZero },
  unknown: { label: 'Checking', icon: WifiLow }
};

export default function ActiveCallScreen({
  name,
  timerLabel,
  networkQuality,
  isMuted,
  isSpeakerOn,
  onToggleMute,
  onToggleSpeaker,
  onEnd
}: ActiveCallScreenProps) {
  const network = qualityMeta[networkQuality];
  const NetworkIcon = network.icon;

  return (
    <div className="fixed inset-0 z-[670] flex items-center justify-center bg-slate-950/95 px-4 py-8 text-white">
      <div className="flex h-full w-full max-w-md flex-col justify-between rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-white/50">Voice call</p>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/75">
              <NetworkIcon className="h-4 w-4" />
              {network.label}
            </span>
          </div>
          <div className="mt-14 text-center">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-black">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <h2 className="mt-6 text-3xl font-black">{name}</h2>
            <p className="mt-2 text-xl text-white/70">{timerLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button type="button" onClick={onToggleMute} className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-black uppercase tracking-[0.18em] text-white/80">
            {isMuted ? <MicOff className="mb-2 h-6 w-6" /> : <Mic className="mb-2 h-6 w-6" />}
            {isMuted ? 'Muted' : 'Mute'}
          </button>
          <button type="button" onClick={onToggleSpeaker} className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-black uppercase tracking-[0.18em] text-white/80">
            {isSpeakerOn ? <Volume2 className="mb-2 h-6 w-6" /> : <VolumeX className="mb-2 h-6 w-6" />}
            {isSpeakerOn ? 'Speaker' : 'Earpiece'}
          </button>
          <button type="button" onClick={onEnd} className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-red-500 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-red-950/35">
            <PhoneOff className="mb-2 h-6 w-6" />
            End
          </button>
        </div>
      </div>
    </div>
  );
}
