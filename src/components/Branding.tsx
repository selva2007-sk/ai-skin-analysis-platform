type BrandProps = {
  compact?: boolean;
  subtitle?: string;
  light?: boolean;
  className?: string;
};

export function BrandMark({ className = '', light = false }: { className?: string; light?: boolean }) {
  const ring = light ? 'border-white/35 bg-white/8' : 'border-[#c8dcff] bg-white';
  const outline = light ? '#d6e8ff' : '#2563eb';
  const accent = light ? '#ffffff' : '#60a5fa';
  const tissue = light ? '#eff6ff' : '#dbeafe';
  const lesion = light ? '#f87171' : '#dc2626';

  return (
    <div className={`relative overflow-hidden rounded-[1.6rem] ${ring} ${className}`}>
      <svg viewBox="0 0 96 96" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="12" y="28" width="44" height="34" rx="7" fill={tissue} />
        <rect x="12" y="39" width="44" height="23" rx="7" fill={light ? '#dbeafe' : '#93c5fd'} />
        <path d="M12 38C20 34 29 34 37 38C45 42 50 42 56 38V42C50 46 45 46 37 42C29 38 20 38 12 42V38Z" fill={light ? '#bfdbfe' : '#60a5fa'} />
        <circle cx="53" cy="43" r="22" fill={light ? '#ffffff' : '#eff6ff'} stroke={outline} strokeWidth="4" />
        <circle cx="53" cy="43" r="18" fill={light ? '#fef2f2' : '#fee2e2'} stroke={accent} strokeWidth="2.5" />
        <path d="M46 45C46 39 50 34 56 34C60 34 64 37 65 42C69 43 71 47 70 51C69 56 64 59 58 58H50C46 58 43 55 43 51C43 48 44 46 46 45Z" fill={lesion} />
        <circle cx="48" cy="38" r="1.8" fill={light ? '#fecaca' : '#f87171'} />
        <circle cx="59" cy="49" r="2.2" fill={light ? '#fecaca' : '#fb7185'} />
        <circle cx="54" cy="39" r="1.5" fill={light ? '#fecaca' : '#f87171'} />
        <path d="M66 56L77 67" stroke={outline} strokeWidth="5" strokeLinecap="round" />
        <rect x="73" y="64" width="10" height="18" rx="4" transform="rotate(-42 73 64)" fill={accent} stroke={outline} strokeWidth="2.5" />
      </svg>
    </div>
  );
}

export function BrandLockup({ compact = false, subtitle, light = false, className = '' }: BrandProps) {
  const titleColor = light ? 'text-white' : 'text-slate-900';
  const subtitleColor = light ? 'text-blue-100/85' : 'text-slate-500';
  const eyebrowColor = light ? 'text-blue-100/80' : 'text-[#2563eb]';

  return (
    <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'} ${className}`}>
      <BrandMark light={light} className={compact ? 'h-11 w-11 p-1.5' : 'h-20 w-20 p-3'} />
      <div className="min-w-0">
        <p className={`font-semibold uppercase tracking-[0.28em] ${compact ? 'text-[10px]' : 'text-xs'} ${eyebrowColor}`}>
          Dermacheck
        </p>
        <h1 className={`font-semibold leading-none ${compact ? 'mt-1 text-lg tracking-[-0.03em]' : 'mt-2 text-4xl tracking-[-0.05em]'} ${titleColor}`}>
          Skin Intelligence
        </h1>
        {subtitle ? <p className={`mt-1.5 ${compact ? 'text-xs' : 'text-sm'} ${subtitleColor}`}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
