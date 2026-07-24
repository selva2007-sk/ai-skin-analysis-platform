import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLocale = 'en' | 'hi' | 'ta';

type SettingsContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  isOnline: boolean;
};

const STORAGE_KEY = 'derm_app_settings';

const labels = {
  en: {
    brand: 'Dermacheck',
    workspacePatient: 'Patient Module',
    workspaceDoctor: 'Doctor Module',
    home: 'Home',
    appointments: 'Appointments',
    history: 'History',
    profile: 'Profile',
    patients: 'Patients',
    settings: 'Settings',
    language: 'Language',
    motion: 'Motion',
    reducedMotion: 'Reduce motion',
    logout: 'Logout',
    loadingApp: 'Loading application...',
    loadingAnalysis: 'Processing lesion image',
    analysisSubtitle: 'Generating severity, confidence, treatment, and medication guidance...',
    secureChat: 'Secure Chat',
    noMessages: 'No messages yet. Say hello!',
    typeMessage: 'Type a message...',
    offline: 'You are offline. Real-time updates may pause until the connection returns.'
  },
  hi: {
    brand: 'Dermacheck',
    workspacePatient: 'Rogi Module',
    workspaceDoctor: 'Doctor Module',
    home: 'Home',
    appointments: 'Appointments',
    history: 'History',
    profile: 'Profile',
    patients: 'Patients',
    settings: 'Settings',
    language: 'Bhasha',
    motion: 'Motion',
    reducedMotion: 'Animation kam karein',
    logout: 'Logout',
    loadingApp: 'Application load ho rahi hai...',
    loadingAnalysis: 'Skin analysis process ho raha hai',
    analysisSubtitle: 'Severity, confidence, treatment aur medicine guidance taiyar ki ja rahi hai...',
    secureChat: 'Secure Chat',
    noMessages: 'Abhi koi message nahin hai. Hello kahiye!',
    typeMessage: 'Message likhiye...',
    offline: 'Aap offline hain. Connection wapas aane tak real-time updates ruk sakte hain.'
  },
  ta: {
    brand: 'Dermacheck',
    workspacePatient: 'Noyaalar Paguthi',
    workspaceDoctor: 'Maruththuvar Paguthi',
    home: 'Mugappu',
    appointments: 'Niyamanangal',
    history: 'Varalaru',
    profile: 'Suyavivaram',
    patients: 'Noyaaligal',
    settings: 'Amaippugal',
    language: 'Mozhi',
    motion: 'Asaivu',
    reducedMotion: 'Asaivugalai kuraikkavum',
    logout: 'Veliyeru',
    loadingApp: 'Payanpaadu aetrappadugiradhu...',
    loadingAnalysis: 'Skin analysis nadandhu kondirukkiradhu',
    analysisSubtitle: 'Severity, confidence, treatment, medicine guidance uruvaakkappadugiradhu...',
    secureChat: 'Secure Chat',
    noMessages: 'Innum message illai. Oru hello sollunga!',
    typeMessage: 'Message ezhudhunga...',
    offline: 'Neengal offline-il ullirgal. Connection thirumbi varum varai real-time updates nirkkalaam.'
  }
} as const;

type StoredSettings = {
  locale?: AppLocale;
  reducedMotion?: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const readStoredSettings = (): StoredSettings => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as StoredSettings;
  } catch {
    return {};
  }
};

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const stored = typeof window !== 'undefined' ? readStoredSettings() : {};

  const [locale, setLocale] = useState<AppLocale>(stored.locale || 'en');
  const [reducedMotion, setReducedMotion] = useState<boolean>(stored.reducedMotion ?? prefersReducedMotion);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locale, reducedMotion }));
    document.documentElement.lang = locale;
  }, [locale, reducedMotion]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = useMemo(() => ({
    locale,
    setLocale,
    reducedMotion,
    setReducedMotion,
    isOnline
  }), [locale, reducedMotion, isOnline]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }
  return context;
}

export function useI18n() {
  const { locale } = useAppSettings();
  return labels[locale];
}
