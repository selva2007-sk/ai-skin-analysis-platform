import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, History, Home, LogOut, Moon, Sun, User } from 'lucide-react';
import { cn } from './utils';
import { ActiveTab, AppUser, DoctorProfile, PatientProfile, UserProfile } from './types';
import { BrandMark } from '../components/Branding';

export const Navbar = ({ activeTab, setActiveTab, darkMode, toggleDarkMode, user, onLogout }: {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  user: AppUser | null;
  onLogout: () => void;
}) => {
  const items = user?.role === 'doctor'
    ? [
        { id: 'bookings', label: 'Patients', icon: User }
      ]
    : [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'history', label: 'History', icon: History },
        { id: 'profile', label: 'Profile', icon: User }
      ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button className="flex items-center gap-3" onClick={() => setActiveTab(user?.role === 'doctor' ? 'bookings' : 'home')}>
          <BrandMark className="h-10 w-10 p-1.5 shadow-lg shadow-blue-200/60" />
          <div className="text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#2563eb]">Dermacheck</p>
            <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{user?.role === 'doctor' ? 'Doctor Workspace' : 'Patient Workspace'}</p>
          </div>
        </button>

        <div className="hidden items-center gap-2 md:flex">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={cn(
                'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all',
                activeTab === item.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleDarkMode} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button onClick={onLogout} className="rounded-full p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export const HomeView = ({ user, profile, onStart, bookingCount, trackingCount }: {
  user: AppUser;
  profile: UserProfile | null;
  onStart: () => void;
  bookingCount: number;
  trackingCount: number;
}) => {

  const patient = profile as PatientProfile | null;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_50%,#10b981_100%)] p-8 text-white shadow-2xl shadow-cyan-500/20">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-100">Patient Portal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Hello, {patient?.fullName || user.email}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85">Profile, lesion analysis, consultation booking, and recovery tracking stay in one dashboard.</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button onClick={onStart} className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-900 transition-transform hover:scale-[1.02]">Start New Scan</button>
            <div className="rounded-2xl border border-white/20 px-6 py-4 text-sm font-bold text-white/90">Blood Group: {patient?.bloodGroup || 'Not set'}</div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[
            { label: 'Bookings', value: bookingCount, helper: 'Confirmed consultations' },
            { label: 'Tracking Plans', value: trackingCount, helper: 'Follow-up routines active' },
            { label: 'Profile Ready', value: patient?.fullName ? 'Yes' : 'Pending', helper: 'Patient details stored for faster scans' }
          ].map((card) => (
            <div key={card.label} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{card.value}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.helper}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Emergency Contact</p>
          <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{patient?.emergencyContact || 'Not added'}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Allergies</p>
          <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{patient?.allergies || 'None shared'}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Address</p>
          <p className="mt-3 text-base font-black text-slate-900 dark:text-white">{patient?.address || 'Not added'}</p>
        </div>
      </div>
    </div>
  );
};

export const ProfileView = ({ user, profile, onChange, onSave, isSaving = false }: {
  user: AppUser;
  profile: UserProfile | null;
  onChange: (next: UserProfile) => void;
  onSave: (next: UserProfile) => Promise<void> | void;
  isSaving?: boolean;
}) => {
  if (!profile) return null;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const updateDraft = (next: UserProfile) => {
    setDraft(next);
    onChange(next);
  };

  const patientDraft = draft as PatientProfile;
  const inputClassName = `w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-medium outline-none transition-all dark:border-slate-700 dark:text-white ${
    isEditing
      ? 'bg-slate-50 focus:border-slate-400 focus:bg-white dark:bg-slate-800'
      : 'bg-slate-100 text-slate-500 dark:bg-slate-800/70 dark:text-slate-300'
  }`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-24">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Profile</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{draft.fullName || user.email}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isEditing
                ? 'Update your saved account details below.'
                : 'This page shows your login information and saved profile details.'}
            </p>
          </div>
          <div className="flex gap-3">
            {isEditing && (
              <button
                onClick={() => { setDraft(profile); onChange(profile); setIsEditing(false); }}
                className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-900 dark:bg-slate-800 dark:text-white"
              >
                Cancel
              </button>
            )}
            <button
              onClick={async () => {
                if (isEditing) {
                  await onSave(draft);
                  setIsEditing(false);
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-900"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save Profile' : 'Edit Profile'}
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Login Email</p>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{user.email}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Account Type</p>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{user.role === 'doctor' ? 'Doctor' : 'Patient'}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{isEditing ? 'Editing' : 'Saved'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">Full Name<input value={draft.fullName} disabled={!isEditing || isSaving} onChange={(e) => updateDraft({ ...draft, fullName: e.target.value } as UserProfile)} className={inputClassName} /></label>
          <label className="space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">Phone<input value={draft.phone} disabled={!isEditing || isSaving} onChange={(e) => updateDraft({ ...draft, phone: e.target.value } as UserProfile)} className={inputClassName} /></label>
          <label className="space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">Age<input value={patientDraft.age} disabled={!isEditing || isSaving} onChange={(e) => updateDraft({ ...patientDraft, age: e.target.value } as UserProfile)} className={inputClassName} /></label>
          <label className="space-y-2 text-sm font-bold text-slate-700 dark:text-slate-300">Blood Group<select value={patientDraft.bloodGroup} disabled={!isEditing || isSaving} onChange={(e) => updateDraft({ ...patientDraft, bloodGroup: e.target.value } as UserProfile)} className={inputClassName}><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></label>
        </div>
      </div>
    </div>
  );
};

export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-slate-950 text-white">
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.24, 0.4, 0.24] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute h-[460px] w-[460px] rounded-full bg-blue-500/20 blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.18, 0.3, 0.18] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        className="absolute h-[260px] w-[260px] rounded-full border border-blue-200/10 bg-cyan-400/10 blur-[40px]"
      />
      <div className="relative flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
          className="text-xs font-semibold uppercase tracking-[0.34em] text-blue-100/80"
        >
          Dermacheck
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.5 }}
          className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white"
        >
          Skin Intelligence
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.95 }}
          className="mt-3 max-w-md text-sm leading-6 text-blue-100/80"
        >
          Modern skin disease detection with clean, high-readability medical UI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 1.35 }}
          className="mt-8"
        >
          <BrandMark light className="h-28 w-28 p-3.5 shadow-[0_20px_60px_rgba(59,130,246,0.25)]" />
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
          Loading application...
        </motion.p>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl dark:bg-slate-900">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{message}</p>
          <div className="mt-8 flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-2xl bg-slate-100 px-5 py-4 text-sm font-black text-slate-900 dark:bg-slate-800 dark:text-white">Cancel</button>
            <button onClick={() => { onConfirm(); onClose(); }} className="flex-1 rounded-2xl bg-red-500 px-5 py-4 text-sm font-black text-white">Confirm</button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const LoadingOverlay = () => {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const timer = setInterval(() => setProgress((value) => (value < 94 ? value + Math.random() * 8 : value)), 280);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-xl">
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2A7FFF] to-[#00C896] text-white"><Brain className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">AI Analysis</p><p className="text-lg font-black text-slate-900 dark:text-white">Processing lesion image</p></div></div>
        <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-[#2A7FFF] to-[#00C896]" style={{ width: `${progress}%` }} /></div>
        <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">Generating severity, confidence, treatment, and medication guidance...</p>
      </div>
    </div>
  );
};
