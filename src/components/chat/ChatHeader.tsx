import { Phone, Wifi, WifiOff, X } from 'lucide-react';
import { cn } from '../../app/utils';

type ChatHeaderProps = {
  title: string;
  subtitle?: string;
  isOnline: boolean;
  canCall: boolean;
  callDisabledReason?: string;
  onStartCall?: () => void;
  onClose: () => void;
};

export default function ChatHeader({
  title,
  subtitle,
  isOnline,
  canCall,
  callDisabledReason,
  onStartCall,
  onClose
}: ChatHeaderProps) {
  const isCallEnabled = Boolean(canCall && onStartCall);
  return (
    <div className="flex min-h-[calc(7rem+env(safe-area-inset-top))] items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:min-h-[7rem] sm:px-6 sm:py-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="min-w-0 flex-1 self-center">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{subtitle || 'Secure Chat'}</p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <h3 className="min-w-0 truncate text-xl font-black text-slate-900 dark:text-white sm:text-[1.4rem]">{title}</h3>
          <span className={cn(
            'shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em]',
            isOnline
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'bg-slate-300/20 text-slate-500 dark:text-slate-400'
          )}>
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2 self-center">
        {!isCallEnabled && callDisabledReason && (
          <p className="max-w-[16rem] text-right text-[10px] font-bold leading-4 text-slate-400 dark:text-slate-500">
            {callDisabledReason}
          </p>
        )}
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStartCall}
          disabled={!isCallEnabled}
          title={isCallEnabled ? 'Start voice call' : (callDisabledReason || 'Voice call unavailable')}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 transition-colors',
            isCallEnabled
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
          )}
        >
          <Phone className="h-5 w-5" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">Call</span>
        </button>
        <button onClick={onClose} className="rounded-full bg-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
          <X className="h-5 w-5" />
        </button>
        </div>
      </div>
    </div>
  );
}
