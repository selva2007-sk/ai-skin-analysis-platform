import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Brain, Calendar, ClipboardList, History, Home, LogOut, Moon, Sun, User, WifiOff } from 'lucide-react';

import { AppUser } from './types';
import { cn } from './utils';
import { BrandMark } from '../components/Branding';
import { useAppSettings, useI18n } from './settings';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: boolean;
};

export const AppNavbar = ({
  path,
  darkMode,
  toggleDarkMode,
  user,
  onLogout,
  hasNewHistory
}: {
  path: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
  user: AppUser | null;
  onLogout: () => void;
  hasNewHistory?: boolean;
}) => {
  const navigate = useNavigate();
  const { isOnline } = useAppSettings();
  const i18n = useI18n();

  const items: NavItem[] = user?.role === 'doctor'
    ? [
        { href: '/doctor/home', label: i18n.patients, icon: ClipboardList }
      ]
    : [
        { href: '/patient/home', label: i18n.home, icon: Home },
        { href: '/patient/appointments', label: i18n.appointments, icon: Calendar },
        { href: '/patient/history', label: i18n.history, icon: History, badge: hasNewHistory },
        { href: '/patient/profile', label: i18n.profile, icon: User }
      ];

  const homePath = user?.role === 'doctor' ? '/doctor/home' : '/patient/home';

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex min-h-[5rem] max-w-7xl items-center justify-between px-4 py-2 sm:min-h-[5.5rem] sm:px-6 lg:px-8">
          <button className="flex items-center gap-3" onClick={() => navigate(homePath)}>
            <BrandMark className="h-10 w-10 p-1.5 shadow-lg shadow-blue-200/60" />
            <div className="text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#2563eb]">{i18n.brand}</p>
              <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{user?.role === 'doctor' ? i18n.workspaceDoctor : i18n.workspacePatient}</p>
            </div>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {items.map((item) => {
              const active = path === item.href || (item.href === '/doctor/home' && path.startsWith('/doctor/patient/'));
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  )}
                >
                  <div className="relative">
                    <item.icon className="h-4 w-4" />
                    {item.badge && <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />}
                  </div>
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={onLogout} className="rounded-full p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" aria-label={i18n.logout}>
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {!isOnline && (
        <div className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+5.75rem)] z-40 mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg shadow-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-100 sm:top-[calc(env(safe-area-inset-top)+6.25rem)]">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{i18n.offline}</span>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (App-like for APK) */}
      {user && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200/80 bg-white/90 px-2 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-slate-950/90 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {items.map((item) => {
            const active = path === item.href || (item.href === '/doctor/home' && path.startsWith('/doctor/patient/'));
            return (
              <button
                key={`mobile-${item.href}`}
                onClick={() => navigate(item.href)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 rounded-xl p-2 text-[10px] font-bold transition-all',
                  active ? 'text-[#2A7FFF] dark:text-[#2A7FFF]' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                )}
              >
                <div className="relative">
                  <item.icon className="h-4 w-4" />
                  {item.badge && <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />}
                </div>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const { reducedMotion } = useAppSettings();
  const i18n = useI18n();

  useEffect(() => {
    const timer = setTimeout(onComplete, reducedMotion ? 1200 : 4000);
    return () => clearTimeout(timer);
  }, [onComplete, reducedMotion]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-slate-950 px-4 text-white">
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.24, 0.4, 0.24] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-[90px] sm:h-[460px] sm:w-[460px] sm:blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.18, 0.3, 0.18] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        className="absolute h-[200px] w-[200px] rounded-full border border-blue-200/10 bg-cyan-400/10 blur-[30px] sm:h-[260px] sm:w-[260px] sm:blur-[40px]"
      />
      <div className="relative flex max-w-md flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
          className="text-xs font-semibold uppercase tracking-[0.34em] text-blue-100/80"
        >
          {i18n.brand}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.5 }}
          className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl"
        >
          Skin Intelligence
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.95 }}
          className="mt-3 text-sm leading-6 text-blue-100/80"
        >
          Professional dermatology support for patients and clinicians.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 1.35 }}
          className="mt-8"
        >
          <BrandMark light className="h-24 w-24 p-3 shadow-[0_20px_60px_rgba(59,130,246,0.25)] sm:h-28 sm:w-28 sm:p-3.5" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 1.7 }}
          className="mt-8 flex items-center gap-2"
        >
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              animate={{ y: [0, -8, 0], opacity: [0.35, 1, 0.35], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.05, repeat: Infinity, delay: index * 0.16, ease: 'easeInOut' }}
              className="h-2.5 w-2.5 rounded-full bg-white"
            />
          ))}
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.95 }}
          className="mt-4 text-sm font-medium text-blue-100/85"
        >
          {i18n.loadingApp}
        </motion.p>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-[2.5rem] bg-white p-6 shadow-2xl dark:bg-slate-900 sm:max-h-[calc(100dvh-2rem)] sm:p-8">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{message}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-black text-slate-900 dark:bg-slate-800 dark:text-white">Cancel</button>
            <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white">Confirm</button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const LoadingOverlay = () => {
  const { reducedMotion } = useAppSettings();
  const i18n = useI18n();
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => setProgress((value) => (value < 94 ? value + Math.random() * 8 : value)), 280);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xl sm:p-4">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <motion.div
            animate={reducedMotion ? { opacity: 1 } : { y: [0, -6, 0], rotate: [0, -2, 0, 2, 0] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BrandMark className="h-16 w-16 p-2.5 shadow-lg shadow-blue-200/60" />
          </motion.div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#2563eb]">{i18n.brand}</p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{i18n.loadingAnalysis}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{i18n.analysisSubtitle}</p>
        </div>
        <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-[#2A7FFF] to-[#00C896]" style={{ width: `${progress}%` }} /></div>
        <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <Brain className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.24em]">AI Analysis</span>
        </div>
      </div>
    </div>
  );
};
