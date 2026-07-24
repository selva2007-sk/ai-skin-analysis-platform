import { useEffect, useMemo, useState, useRef, ReactNode, lazy, Suspense } from 'react';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { Routes, Route, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

import { auth, db } from './firebase';
import { AppUser, BookingItem, DoctorProfile, HistoryItem, PatientProfile, PaymentMethod, PredictionResult, TrackingItem, UserProfile } from './app/types';
import { addHistoryItem, addTrackingItem, buildFallbackResult, getSeededDoctors, normalizePredictionResult, readCollection, safeParse, STORAGE_KEYS, writeCollection } from './app/utils';
import { AppNavbar, ConfirmModal, LoadingOverlay, SplashScreen } from './app/chrome';
import { MessageCircle, X, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useAppSettings } from './app/settings';
import { analyzeLesion } from './lib/analysisFunction';
import { registerPushToken, subscribeToForegroundMessages } from './lib/pushNotifications';
import { useVoiceCallManager } from './hooks/useVoiceCallManager';

const PortalLogin = lazy(() => import('./auth/PortalLogin'));
const ChatModal = lazy(() => import('./components/ChatModal'));
const BookingView = lazy(async () => ({ default: (await import('./app/bookingViews')).BookingView }));
const AppointmentsView = lazy(async () => ({ default: (await import('./app/bookingViews')).AppointmentsView }));
const PatientHomePage = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).PatientHomePage }));
const PatientProfilePage = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).PatientProfilePage }));
const ResultView = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).ResultView }));
const TrackingView = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).TrackingView }));
const UploadSection = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).UploadSection }));
const HistoryView = lazy(async () => ({ default: (await import('./modules/patient/PatientPages')).HistoryView }));
const DoctorHomePage = lazy(async () => ({ default: (await import('./modules/doctor/DoctorModulePages')).DoctorHomePage }));
const DoctorPatientDetailsPage = lazy(async () => ({ default: (await import('./modules/doctor/DoctorModulePages')).DoctorPatientDetailsPage }));
const DoctorProfilePage = lazy(async () => ({ default: (await import('./modules/doctor/DoctorModulePages')).DoctorProfilePage }));

const isScanHistoryItem = (item: HistoryItem): item is Extract<HistoryItem, { kind?: 'scan' }> =>
  item.kind !== 'appointment';

function buildDefaultProfile(uid: string, email: string, role: AppUser['role']): UserProfile {
  const fullName = email.split('@')[0] || (role === 'doctor' ? 'Doctor' : 'Patient');

  if (role === 'doctor') {
    return {
      uid,
      email,
      role: 'doctor',
      fullName,
      specialization: 'Dermatologist',
      hospital: 'Skin AI Clinic',
      phone: '',
      consultationFee: 500,
      licenseNumber: '',
      experienceYears: '',
      consultationMode: 'Online + In-person',
      availableDates: []
    };
  }

  return {
    uid,
    email,
    role: 'patient',
    fullName,
    age: '',
    gender: 'Male',
    bloodGroup: 'O+',
    phone: '',
    emergencyContact: '',
    allergies: '',
    address: ''
  };
}

function hydrateUserProfile(
  firestoreProfile: Partial<UserProfile> | null | undefined,
  localProfile: Partial<UserProfile> | null | undefined,
  firebaseUser: Pick<FirebaseUser, 'uid' | 'email'>,
  role: AppUser['role']
): UserProfile {
  const defaultProfile = buildDefaultProfile(firebaseUser.uid, firebaseUser.email || '', role);

  // Combine profiles with a clear precedence: firestore > local > default
  const combined = {
    ...defaultProfile,
    ...(localProfile || {}),
    ...(firestoreProfile || {}),
  };

  // Ensure core properties are always from the auth user, and role is correct
  combined.uid = firebaseUser.uid;
  combined.email = firebaseUser.email || '';
  combined.role = role;

  // Handle specific complex merge logic like for 'availableDates'
  if (role === 'doctor') {
    const doctorFirestore = firestoreProfile as Partial<DoctorProfile> | undefined;
    const doctorLocal = localProfile as Partial<DoctorProfile> | undefined;
    const doctorDefault = defaultProfile as DoctorProfile;

    (combined as DoctorProfile).availableDates =
      Array.isArray(doctorFirestore?.availableDates) ? doctorFirestore.availableDates :
      Array.isArray(doctorLocal?.availableDates) ? doctorLocal.availableDates :
      doctorDefault.availableDates;
  }

  return combined as UserProfile;
}

async function saveUserProfile(profile: UserProfile) {
  if (!auth.currentUser?.uid) throw new Error('No authenticated user found.');
  const payload = { ...profile, updatedAt: new Date().toISOString() };
  await setDoc(doc(db, 'users', auth.currentUser.uid), payload, { merge: true });
  localStorage.setItem(`derm_profile_${auth.currentUser.uid}`, JSON.stringify(payload));
  return payload;
}

async function saveAppointmentHistoryEvent(booking: BookingItem, status: BookingItem['status'], paymentStatus: BookingItem['paymentStatus']) {
  const safeStatus = status.toLowerCase();
  const safePayment = paymentStatus.toLowerCase();
  const historyId = `booking_${booking.id}_${safeStatus}_${safePayment}`;
  const note =
    status === 'Pending'
      ? `Appointment requested with Dr. ${booking.doctorName}.`
      : status === 'Approved'
        ? `Appointment approved by Dr. ${booking.doctorName}.`
        : (status as string) === 'Rejected'
          ? `Appointment rejected by Dr. ${booking.doctorName}.`
          : paymentStatus === 'Paid'
            ? `Appointment payment completed for Dr. ${booking.doctorName}.`
            : `Appointment updated with Dr. ${booking.doctorName}.`;

  await setDoc(doc(db, 'appointment', historyId), {
    id: historyId,
    kind: 'appointment',
    uid: booking.patientUid,
    timestamp: Date.now(),
    bookingId: booking.id,
    doctorUid: booking.doctorUid,
    doctorName: booking.doctorName,
    doctorEmail: booking.doctorEmail,
    date: booking.date,
    time: booking.time,
    status,
    paymentStatus,
    amount: booking.amount,
    note
  }, { merge: true });
}

function mergeDoctorDirectories(seedList: DoctorProfile[], firestoreList: DoctorProfile[]) {
  const merged = new Map<string, DoctorProfile>();

  seedList.forEach((doctor) => {
    merged.set(doctor.email, doctor);
  });

  firestoreList.forEach((doctor) => {
    const existing = merged.get(doctor.email);
    merged.set(doctor.email, {
      ...(existing || {}),
      ...doctor,
      role: 'doctor'
    });
  });

  return Array.from(merged.values());
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function shrinkImageForAnalysis(file: File): Promise<string> {
  const originalDataUrl = await fileToDataUrl(file);

  if (!file.type.startsWith('image/')) {
    return originalDataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Unable to process the selected image.'));
    img.onload = () => resolve(img);
    img.src = originalDataUrl;
  });

  const maxDimension = 1400;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const qualitySteps = [0.82, 0.72, 0.62, 0.52];
  for (const quality of qualitySteps) {
    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= 3_800_000) {
      return compressed;
    }
  }

  return canvas.toDataURL('image/jpeg', 0.45);
}

function dataUrlToFile(dataUrl: string, filename = 'lesion-image.jpg') {
  const [header, base64 = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mimeType });
}

function normalizeApiBase(rawBase: string) {
  const trimmed = rawBase.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function joinApiUrl(apiBase: string, pathname: string) {
  return apiBase ? `${apiBase}${pathname}` : pathname;
}

function getApiBaseCandidates(preferredBase = '') {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const isDevBuild = Boolean((import.meta as any).env?.DEV || (process as any).env?.NODE_ENV === 'development');
  const isNative = Capacitor.isNativePlatform();
  const addCandidate = (value: string | null | undefined) => {
    if (value == null) return;
    const trimmed = String(value).trim();
    const normalized = trimmed ? normalizeApiBase(trimmed) : '';
    if (normalized === null) return;
    const key = normalized || '__same_origin__';
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  };

  addCandidate(preferredBase);
  addCandidate(isNative ? (import.meta as any).env?.VITE_API_URL_MOBILE : '');
  addCandidate((import.meta as any).env?.VITE_API_URL);

  if (typeof window !== 'undefined') {
    if (!isNative && /^https?:/i.test(window.location.origin)) {
      addCandidate('');
    }

    if (isDevBuild) {
      const { hostname, protocol } = window.location;
      if (hostname) {
        const httpProtocol = /^https?:$/i.test(protocol) ? protocol : 'http:';
        addCandidate(`${httpProtocol}//${hostname}:3000`);
      }
    }
  }

  if (isDevBuild) {
    addCandidate('http://localhost:3000');
    addCandidate('http://127.0.0.1:3000');

    if (Capacitor.getPlatform() === 'android') {
      addCandidate('http://10.0.2.2:3000');
    }
  }

  return candidates;
}

async function findReachableApiBase(preferredBase = '', signal?: AbortSignal) {
  const candidates = getApiBaseCandidates(preferredBase);
  const isNative = Capacitor.isNativePlatform();

  for (const candidate of candidates) {
    try {
      const response = await fetch(joinApiUrl(candidate, '/api/health'), {
        method: 'GET',
        signal
      });
      if (response.ok) {
        return { ok: true as const, base: candidate };
      }
    } catch {
      // Try the next candidate until one responds.
    }
  }

  return {
    ok: false as const,
    message: isNative
      ? 'Unable to reach the analysis server. Set VITE_API_URL_MOBILE to your deployed server URL and try again.'
      : 'Unable to reach the analysis server. Start the local server (or set VITE_API_URL) and try again.'
  };
}

async function readJsonSafely(response: Response) {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit, retries = 1) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
      await delay(500 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed.');
}

function getAnalysisFailureMessage(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Analysis is taking longer than expected. Please try again.';
  }

  const message = error instanceof Error ? error.message : '';
  if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
    return 'Unable to reach the analysis server. Check your connection and try again.';
  }
  if (/offline/i.test(message)) {
    return 'You are offline. Connect to the internet and try again.';
  }

  return 'Unable to analyze image now, please try again.';
}

export default function RootApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useAppSettings();
  const routeState = location.state as { returnTo?: string; backgroundLocation?: typeof location } | null;
  const backgroundLocation = routeState?.backgroundLocation;
  const [showSplash, setShowSplash] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisServerState, setAnalysisServerState] = useState<'checking' | 'online' | 'offline'>('checking');
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [trackingItems, setTrackingItems] = useState<TrackingItem[]>([]);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedDoctorEmail, setSelectedDoctorEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [activeChatBooking, setActiveChatBooking] = useState<BookingItem | null>(null);
  const [lastViewedHistoryTime, setLastViewedHistoryTime] = useState(0);
  const prevMessageTimestamps = useRef<Record<string, number>>({});
  const analysisInFlightRef = useRef(false);
  const [chatToast, setChatToast] = useState<{booking: BookingItem, text: string} | null>(null);
  const { isOnline } = useAppSettings();
  const [apiBase, setApiBase] = useState('');
  const apiBaseRef = useRef('');

  const voiceCall = useVoiceCallManager({
    user,
    bookings,
    apiBase,
    onError: (msg) => setErrorMessage(msg)
  });

  useEffect(() => {
    setHistory(readCollection<HistoryItem[]>(STORAGE_KEYS.history, []));
    setBookings(readCollection<BookingItem[]>(STORAGE_KEYS.bookings, []));
    setTrackingItems(readCollection<TrackingItem[]>(STORAGE_KEYS.tracking, []));
    setDarkMode(safeParse<boolean>(localStorage.getItem('derm_dark_mode'), false));
    setLastViewedHistoryTime(safeParse<number>(localStorage.getItem('derm_last_history_time'), 0));
    setDoctors(getSeededDoctors());
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    const seededDoctors = getSeededDoctors();
    if (!user) {
      setDoctors(seededDoctors);
      return;
    }

    const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsubscribe = onSnapshot(doctorsQuery, (snapshot) => {
      const firestoreDoctors = snapshot.docs.map((doc) =>
        hydrateUserProfile(doc.data() as Partial<UserProfile>, null, { uid: doc.id, email: doc.data().email || '' }, 'doctor') as DoctorProfile
      );
      const mergedDoctors = mergeDoctorDirectories(seededDoctors, firestoreDoctors);
      setDoctors(mergedDoctors);
      writeCollection(STORAGE_KEYS.doctors, mergedDoctors);
    }, (error) => {
      console.error('Error loading doctors directory', error);
      setDoctors(seededDoctors);
    });

    return () => unsubscribe();
  }, [isAuthLoading, user]); // Depend on isAuthLoading AND user to trigger after auth state is known

  useEffect(() => { document.documentElement.classList.toggle('dark', darkMode); localStorage.setItem('derm_dark_mode', JSON.stringify(darkMode)); }, [darkMode]);
  useEffect(() => {
    document.title = locale === 'hi'
      ? 'Dermacheck | Twacha Care'
      : locale === 'ta'
        ? 'Dermacheck | Thol Care'
        : 'Dermacheck | Skin Intelligence';
    const themeColor = darkMode ? '#020617' : '#f8fafc';
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', themeColor);
  }, [darkMode, locale]);
  useEffect(() => { writeCollection(STORAGE_KEYS.history, history); }, [history]);
  useEffect(() => { writeCollection(STORAGE_KEYS.bookings, bookings); }, [bookings]);
  useEffect(() => { writeCollection(STORAGE_KEYS.tracking, trackingItems); }, [trackingItems]);

  // Real-time listener: Syncs bookings between Patients and Doctors instantly
  useEffect(() => {
    if (!user) return;
    
    const field = user.role === 'doctor' ? 'doctorUid' : 'patientUid';
    const q = query(collection(db, 'bookings'), where(field, '==', user.uid));
    
    const unsubscribeBookings = onSnapshot(q, (snapshot) => {
      const fetchedBookings = snapshot.docs.map(doc => doc.data() as BookingItem);
      fetchedBookings.sort((a, b) => b.createdAt - a.createdAt);
      setBookings(fetchedBookings);
      writeCollection(STORAGE_KEYS.bookings, fetchedBookings);
      console.log(`[RootApp] Bookings updated for ${user.role}:`, fetchedBookings);
    }, (error) => {
      console.error(`Error fetching ${user.role} bookings:`, error);
    });

    let unsubscribeHistory = () => {};
    if (user.role === 'patient') {
      const hq = query(collection(db, 'history'), where('uid', '==', user.uid));
      unsubscribeHistory = onSnapshot(hq, (snapshot) => {
        const fetchedHistory = snapshot.docs.map(doc => doc.data() as HistoryItem).sort((a,b) => b.timestamp - a.timestamp);
        setHistory(fetchedHistory);
        writeCollection(STORAGE_KEYS.history, fetchedHistory);
      });
    }

    return () => { unsubscribeBookings(); unsubscribeHistory(); };
  }, [user]);

  // Listen for new chat messages on existing bookings
  useEffect(() => {
    bookings.forEach(booking => {
      const prevTime = prevMessageTimestamps.current[booking.id];
      const newTime = (booking as any).lastMessageAt || 0;
      if (prevTime !== undefined && newTime > prevTime && (booking as any).lastMessageSenderId !== user?.uid) {
        if (activeChatBooking?.id !== booking.id) {
          setChatToast({ booking, text: (booking as any).lastMessageText });
        }
      }
      prevMessageTimestamps.current[booking.id] = newTime;
    });
  }, [bookings, user?.uid, activeChatBooking?.id]);

  const liveActiveChatBooking = useMemo(
    () => bookings.find((booking) => booking.id === activeChatBooking?.id) || activeChatBooking,
    [activeChatBooking, bookings]
  );

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    try {
      if (Notification.permission === 'default') {
        return await Notification.requestPermission();
      }
      return Notification.permission;
    } catch {
      return Notification.permission;
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    void requestNotificationPermission();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    void registerPushToken().then(async (token) => {
      if (!token || cancelled) return;
      try {
        await setDoc(doc(db, 'users', user.uid!), {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          fcmTokenUpdatedAt: Date.now()
        }, { merge: true });
      } catch (error) {
        console.error('[RootApp] Failed to save push token:', error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    let unsubscribe = () => {};

    void subscribeToForegroundMessages((payload) => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try {
          const notification = new Notification(payload.notification?.title || 'Dermacheck', {
            body: payload.notification?.body || ''
          });
          notification.onclick = () => window.focus();
        } catch (error) {
          console.warn('[RootApp] Foreground notification failed:', error);
        }
      }
    }).then((dispose) => {
      unsubscribe = dispose;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setIsAuthLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists() || !userDoc.data()?.role) {
          console.error(`User ${firebaseUser.uid} has an invalid profile in Firestore. Forcing logout.`);
          await signOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsAuthLoading(false);
          return;
        }

        const firestoreProfile = userDoc.data() as UserProfile;
        const finalRole = firestoreProfile.role;

        // Set the definitive user state from Firestore, the source of truth
        setUser({ email: firebaseUser.email || '', role: finalRole, uid: firebaseUser.uid });
        localStorage.setItem('derm_user_role', finalRole);

        // Hydrate and set the complete profile state
        const localFallback = safeParse<UserProfile | null>(localStorage.getItem(`derm_profile_${firebaseUser.uid}`), null);
        const nextProfile = hydrateUserProfile(firestoreProfile, localFallback, firebaseUser, finalRole);
        setUserProfile(nextProfile);
        localStorage.setItem(`derm_profile_${firebaseUser.uid}`, JSON.stringify(nextProfile));
        await setDoc(doc(db, 'users', firebaseUser.uid), nextProfile, { merge: true });
      } catch (error) {
        console.error('Error processing auth state change:', error);
        await signOut(auth); // Log out on error to prevent inconsistent states
      } finally {
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // This effect handles redirection after a user logs in.
  useEffect(() => {
    if (user && (location.pathname === '/login' || location.pathname === '/doctor/login')) {
      navigate(`/${user.role}/home`, { replace: true });
    }
  }, [user, location.pathname, navigate]);

  // Calculate if there are new history items
  const latestHistoryTimestamp = history.reduce((max, item) => Math.max(max, item.timestamp), 0);
  const hasNewHistory = user?.role === 'patient' && latestHistoryTimestamp > lastViewedHistoryTime;

  useEffect(() => {
    if (location.pathname === '/patient/history' && latestHistoryTimestamp > lastViewedHistoryTime) {
      setLastViewedHistoryTime(latestHistoryTimestamp);
      localStorage.setItem('derm_last_history_time', JSON.stringify(latestHistoryTimestamp));
    }
  }, [location.pathname, latestHistoryTimestamp, lastViewedHistoryTime]);

  const effectiveUserProfile = useMemo(() => !user ? null : userProfile || buildDefaultProfile(user.uid || '', user.email, user.role), [user, userProfile]);
  const doctorProfiles = useMemo(() => {
    const base = [...doctors];
    if (user?.role === 'doctor' && effectiveUserProfile) {
      const currentDoctor = effectiveUserProfile as DoctorProfile;
      const index = base.findIndex((doctor) => doctor.email === currentDoctor.email);
      if (index >= 0) base[index] = currentDoctor; else base.unshift(currentDoctor);
    }
    return base;
  }, [doctors, user, effectiveUserProfile]);

  const doctorPatients = useMemo(() => {
    if (!user || user.role !== 'doctor') return [];
    return bookings.filter((booking) => booking.doctorUid === user.uid);
  }, [bookings, user]);

  const selectedPatientId = location.pathname.startsWith('/doctor/patient/') ? location.pathname.replace('/doctor/patient/', '') : '';
  const selectedPatient = doctorPatients.find((item) => item.id === selectedPatientId) || null;

  useEffect(() => {
    if (!isOnline) {
      setAnalysisServerState('offline');
      return;
    }

    const controller = new AbortController();
    const runHealthCheck = async () => {
      setAnalysisServerState('checking');
      const resolved = await findReachableApiBase(apiBaseRef.current, controller.signal);
      if (resolved.ok) {
        apiBaseRef.current = resolved.base;
        setApiBase(resolved.base);
        setAnalysisServerState('online');
      } else {
        setAnalysisServerState('offline');
      }
    };

    void runHealthCheck();
    return () => controller.abort();
  }, [isOnline]);

  const handleUpload = async (input: File | string, patientInfo: PredictionResult['patientInfo']) => {
    if (analysisInFlightRef.current) {
      console.warn('[RootApp] Ignoring duplicate analyze request (already running).');
      return;
    }

    analysisInFlightRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setAnalysisError(null);

    try {
      const processImage = async (base64Image: string, imageFile: File) => {
        setCurrentImage(base64Image);
        try {
          const saveAnalysisResult = async (analysisResult: PredictionResult) => {
            setResult(analysisResult);
            setAnalysisError(null);
            setAnalysisServerState('online');

            const historyId = Math.random().toString(36).slice(2, 10);
            const newHistoryItem: HistoryItem = {
              ...analysisResult,
              id: historyId,
              kind: 'scan',
              timestamp: Date.now(),
              image: base64Image,
              uid: user?.uid || ''
            };
            try {
              await setDoc(doc(db, 'history', historyId), newHistoryItem);
            } catch (e) {
              console.error('Failed to save history to cloud', e);
            }
            setHistory((prev) => addHistoryItem(prev, newHistoryItem));
            navigate('/patient/result');
          };

          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 30000);
          try {
            const apiResolution = await findReachableApiBase(apiBaseRef.current, controller.signal);
            if (!apiResolution.ok) {
              throw new Error(apiResolution.message);
            }
            const apiBase = apiResolution.base;
            apiBaseRef.current = apiBase;

            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('patientInfo', JSON.stringify(patientInfo || {}));

            console.log('[RootApp] Sending lesion analysis request', {
              url: joinApiUrl(apiBase, '/api/analyze'),
              fileName: imageFile.name,
              fileType: imageFile.type,
              fileSize: imageFile.size,
              patientInfo
            });

            const response = await fetchWithRetry(joinApiUrl(apiBase, '/api/analyze'), {
              method: 'POST',
              body: formData,
              signal: controller.signal
            }, 1);

            const analysis = await readJsonSafely(response);

            if (!response.ok) {
              const serverMessage =
                (analysis as { message?: string; details?: string } | null)?.message ||
                (analysis as { message?: string; details?: string } | null)?.details ||
                'Unable to analyze image now, please try again.';
              throw new Error(response.status === 404 ? 'Unable to reach the analysis server. Check your connection and try again.' : serverMessage);
            }

            const fullResult = normalizePredictionResult(
              analysis,
              patientInfo,
              'Unable to analyze image now, please try again.'
            );

            console.log('[RootApp] Analysis response received', fullResult);
            await saveAnalysisResult(fullResult);
          } finally {
            window.clearTimeout(timeoutId);
          }
        } catch (error) {
          console.error("Analysis Error:", error);
          try {
            console.log('[RootApp] Falling back to Firebase analysis');
            const fallbackAnalysis = await analyzeLesion(base64Image, patientInfo || undefined);
            const fallbackResult = normalizePredictionResult(
              fallbackAnalysis,
              patientInfo,
              'Unable to analyze image now, please try again.'
            );
            setResult(fallbackResult);
            setAnalysisError(null);
            setAnalysisServerState('online');

            const historyId = Math.random().toString(36).slice(2, 10);
            const newHistoryItem: HistoryItem = {
              ...fallbackResult,
              id: historyId,
              kind: 'scan',
              timestamp: Date.now(),
              image: base64Image,
              uid: user?.uid || ''
            };
            try {
              await setDoc(doc(db, 'history', historyId), newHistoryItem);
            } catch (e) {
              console.error('Failed to save history to cloud', e);
            }
            setHistory((prev) => addHistoryItem(prev, newHistoryItem));
            navigate('/patient/result');
          } catch (fallbackError) {
            console.error('[RootApp] Firebase analysis fallback failed:', fallbackError);
            const msg = getAnalysisFailureMessage(error);
            setAnalysisServerState('offline');
            setAnalysisError(msg);
          }
        }
      };

      if (typeof input === 'string') {
        await processImage(input, dataUrlToFile(input));
      } else {
        const base64 = await shrinkImageForAnalysis(input);
        await processImage(base64, input);
      }
    } finally {
      analysisInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleStartTracking = () => {
    if (!result) return;
    setTrackingItems((prev) => addTrackingItem(prev, { id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), title: `${result.prediction} follow-up routine`, description: `Track lesion appearance, follow medication guidance, and re-check symptoms based on ${result.severity.toLowerCase()} severity output.`, frequency: result.severity === 'High' ? 'Daily review' : 'Every 2 days', status: 'Active', linkedPrediction: result.prediction }));
    navigate('/patient/tracking');
  };

  const handleUpdateBooking = async (bookingId: string, updates: Partial<BookingItem>) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), updates as any);
      const currentBooking = bookings.find((item) => item.id === bookingId);
      if (currentBooking?.patientUid) {
        const mergedBooking = { ...currentBooking, ...updates } as BookingItem;
        try {
          await saveAppointmentHistoryEvent(mergedBooking, mergedBooking.status, mergedBooking.paymentStatus);
        } catch (e) {
          console.error('Failed to save appointment event to history', e);
        }
      }
    } catch (error: any) {
      console.error("Error updating booking:", error);
      setErrorMessage(`Failed to update booking: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setBookings((prev) => prev.filter((item) => item.id !== bookingId));
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      setErrorMessage(`Failed to remove appointment: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedDoctorEmail || !selectedDate || !selectedTime || !user) { setErrorMessage('Choose doctor, date, and time before payment.'); return; }
    const doctor = doctorProfiles.find((item) => item.email === selectedDoctorEmail);
    if (!doctor) { setErrorMessage('Selected doctor is unavailable.'); return; }
    if (!doctor.uid || doctor.uid.startsWith('seed-')) {
      setErrorMessage('This is a demo doctor. Please select a real doctor account that has signed up to complete your booking.');
      return;
    }
    const patientProfile = effectiveUserProfile as PatientProfile | null;
    
    const bookingId = Math.random().toString(36).slice(2, 10);
    const newBooking = {
      id: bookingId,
      patientUid: user.uid || '',
      doctorUid: doctor.uid || '',
      patientEmail: user.email || 'No email provided',
      patientName: patientProfile?.fullName || result?.patientInfo?.name || user.email || 'Unknown Patient',
      patientAge: patientProfile?.age || result?.patientInfo?.age || 'Not provided',
      patientGender: patientProfile?.gender || result?.patientInfo?.gender || 'Not provided',
      patientBloodGroup: patientProfile?.bloodGroup || result?.patientInfo?.bloodGroup || 'N/A',
      patientPhone: patientProfile?.phone || 'Not provided',
      patientEmergencyContact: patientProfile?.emergencyContact || 'Not provided',
      patientAllergies: patientProfile?.allergies || 'None shared',
      patientAddress: patientProfile?.address || 'Not provided',
      doctorEmail: doctor.email || '',
      doctorName: doctor.fullName || 'Unknown Doctor',
      doctorSpecialization: doctor.specialization || 'Dermatologist',
      hospital: doctor.hospital || 'Skin AI Clinic',
      date: selectedDate,
      time: selectedTime,
      status: 'Pending',
      paymentMethod: paymentMethod || 'UPI',
      paymentStatus: 'Unpaid',
      amount: doctor.consultationFee || 500,
      prediction: result?.prediction || 'General Consultation',
      severity: result?.severity || 'N/A',
      confidence: result?.confidence || 0,
      caseDescription: result?.description || 'General consultation booked by patient.',
      treatment: result?.treatment || 'Pending doctor review.',
      medications: result?.medications || [],
      nextSteps: result?.nextSteps || [],
      createdAt: Date.now()
    };

    setIsLoading(true);
    try {
      // Save the booking to Firestore so the doctor receives it
      await setDoc(doc(db, 'bookings', bookingId), newBooking);
      try {
        await saveAppointmentHistoryEvent(newBooking as BookingItem, 'Pending', 'Unpaid');
      } catch (e) {
        console.error('Failed to save appointment request in history', e);
      }
      
      // Trigger Push Notification to Doctor
      fetch(joinApiUrl(apiBaseRef.current, '/api/notify-doctor'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorUid: doctor.uid,
          patientName: newBooking.patientName,
          date: newBooking.date,
          time: newBooking.time
        })
      }).catch(e => console.error('Failed to trigger notification', e));

      setSelectedDate('');
      setSelectedTime('');
      setErrorMessage('Appointment requested successfully! Waiting for doctor approval.');
      navigate('/patient/appointments');
    } catch (error: any) {
      console.error("Error saving booking:", error);
      setErrorMessage(`Failed to sync booking: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    navigate('/login', { replace: true });
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch(e) {
      console.error('Failed to delete from cloud', e);
    }
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveProfile = async (nextProfile: UserProfile) => {
    if (!nextProfile) return;
    try {
      setIsSavingProfile(true);
      const saved = await saveUserProfile(nextProfile);
      setUserProfile(saved);
      if (saved.role === 'doctor') {
        setDoctors((prev) => {
          const merged = mergeDoctorDirectories(prev, [saved as DoctorProfile]);
          writeCollection(STORAGE_KEYS.doctors, merged);
          return merged;
        });
      }
      setErrorMessage('Profile saved successfully.');
    } catch (error) {
      console.error(error);
      setErrorMessage('Unable to save profile right now.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLoginSuccess = () => {
    // The onAuthStateChanged listener will handle setting user and userProfile state
    // after successful Firebase authentication. No direct state updates needed here.
  };

  // --- Helper Components for Routing ---

  const Layout = () => {
    const patientProfile = effectiveUserProfile as PatientProfile | null;
    const latestScanHistory = history.find((item) => isScanHistoryItem(item)) as Extract<HistoryItem, { kind?: 'scan' }> | undefined;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white">
        <AppNavbar path={location.pathname} darkMode={darkMode} toggleDarkMode={() => setDarkMode((prev) => !prev)} user={user} onLogout={handleLogout} hasNewHistory={hasNewHistory} />
        <main className="min-h-screen pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+6.25rem)] md:pb-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet context={{ patientProfile, latestScanHistory }} />
          </div>
        </main>
        {liveActiveChatBooking && user && (
          <Suspense fallback={<LoadingOverlay />}>
            <ChatModal
              booking={liveActiveChatBooking}
              currentUser={user}
              canCall={voiceCall.getBookingCallAccess(liveActiveChatBooking).canCall}
              callDisabledReason={voiceCall.getBookingCallAccess(liveActiveChatBooking).reason}
              onStartCall={() => voiceCall.startCall(liveActiveChatBooking)}
              onClose={() => setActiveChatBooking(null)}
            />
          </Suspense>
        )}

        {chatToast && !liveActiveChatBooking && (
          <div className="fixed left-4 right-4 bottom-24 z-[550] mx-auto flex w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 transition-all hover:scale-105 sm:left-auto sm:right-8 sm:bottom-8 dark:bg-slate-800 dark:ring-slate-700">
            <div className="flex cursor-pointer items-center gap-4 p-4" onClick={() => { setActiveChatBooking(chatToast.booking); setChatToast(null); }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A7FFF]/10 text-[#2A7FFF]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">New Message</p>
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {chatToast.booking.patientUid === user?.uid ? `Dr. ${chatToast.booking.doctorName}` : chatToast.booking.patientName}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{chatToast.text}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setChatToast(null); }} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Full-Screen Call Overlay (Incoming/Outgoing) */}
        {(voiceCall.uiState === 'incoming' || voiceCall.uiState === 'outgoing') && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-sm rounded-[3.5rem] bg-white p-10 text-center shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-[12px] ring-emerald-500/5">
                <Phone className="h-12 w-12 animate-bounce" />
              </div>
              
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">
                {voiceCall.uiState === 'incoming' ? 'Incoming Voice Call' : 'Calling Participant...'}
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-900 dark:text-white">
                {voiceCall.currentBooking?.patientUid === user?.uid 
                  ? `Dr. ${voiceCall.currentBooking?.doctorName}` 
                  : voiceCall.currentBooking?.patientName}
              </h2>

              <div className="mt-12 flex items-center justify-center gap-6">
                <button 
                  onClick={() => voiceCall.rejectIncomingCall()} 
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/30 hover:bg-red-600 transition-all hover:scale-110 active:scale-95"
                >
                  <PhoneOff className="h-8 w-8" />
                </button>
                {voiceCall.uiState === 'incoming' && (
                  <button 
                    onClick={() => voiceCall.acceptIncomingCall()} 
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 transition-all hover:scale-110 animate-pulse active:scale-95"
                  >
                    <Phone className="h-8 w-8" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Persistent Call Bar (Active Call) - Allows navigating the app while talking */}
        {voiceCall.uiState === 'active' && (
          <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 z-[1000] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 animate-in slide-in-from-top-full duration-500">
            <div className="flex items-center gap-4 rounded-[2rem] bg-slate-900/90 p-3 pl-6 pr-4 text-white shadow-2xl backdrop-blur-md ring-1 ring-white/10 dark:bg-slate-800/95">
              <div className="flex flex-1 items-center gap-4 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-black">
                    {voiceCall.currentBooking?.patientUid === user?.uid 
                      ? `Dr. ${voiceCall.currentBooking?.doctorName}` 
                      : voiceCall.currentBooking?.patientName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-emerald-400">{voiceCall.timerLabel}</span>
                    {voiceCall.connectionState !== 'connected' && (
                      <span className="text-[10px] font-bold text-amber-400 animate-pulse uppercase tracking-wider">
                        {voiceCall.connectionState}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => voiceCall.toggleMute()} 
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${voiceCall.isMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
                  title={voiceCall.isMuted ? 'Unmute' : 'Mute'}
                >
                  {voiceCall.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button 
                  onClick={() => voiceCall.toggleSpeaker()} 
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${voiceCall.isSpeakerOn ? 'bg-emerald-500' : 'bg-white/10 hover:bg-white/20'}`}
                  title="Toggle Speaker"
                >
                  {voiceCall.isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button 
                  onClick={() => voiceCall.endCall()} 
                  className="flex h-10 w-14 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                  title="End Call"
                >
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && <LoadingOverlay />}
        {errorMessage && <div className="fixed bottom-24 left-1/2 z-[310] w-full max-w-[calc(100%-2rem)] sm:max-w-lg -translate-x-1/2 md:bottom-6"><div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl shadow-slate-300/20 dark:bg-white dark:text-slate-900"><span className="flex-1">{errorMessage}</span><button onClick={() => setErrorMessage(null)} className="text-xs uppercase tracking-[0.2em] opacity-70">Close</button></div></div>}
        <ConfirmModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={() => {
          history.forEach(item => deleteDoc(doc(db, 'history', item.id)).catch(() => {}));
          setHistory([]);
        }} title="Clear history" message="This removes your saved scan and appointment history from the cloud." />
      </div>
    );
  };

  const ProtectedRoute = ({ role, children }: { role: AppUser['role'], children: ReactNode }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (user.role !== role) {
      return <Navigate to={`/${user.role}/home`} replace />;
    }
    return <>{children}</>;
  };

  if (showSplash || isAuthLoading) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <Suspense fallback={<LoadingOverlay />}>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<PortalLogin role="patient" onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/doctor/login" element={<PortalLogin role="doctor" onLoginSuccess={handleLoginSuccess} />} />
        
        <Route path="/patient" element={<ProtectedRoute role="patient"><Layout /></ProtectedRoute>}>
          <Route path="home" element={<PatientHomePage user={user!} profile={effectiveUserProfile as PatientProfile} history={history} latestResult={result || history.find(isScanHistoryItem) as PredictionResult || null} bookingCount={bookings.filter((booking) => booking.patientUid === user?.uid || booking.patientEmail === user?.email).length} trackingCount={trackingItems.length} onStartScan={() => navigate('/patient/upload')} onViewAppointments={() => navigate('/patient/appointments')} />} />
          <Route path="upload" element={<UploadSection profile={effectiveUserProfile as PatientProfile} onUpload={handleUpload} isLoading={isLoading} analysisError={analysisError} serverStatus={analysisServerState} />} />
          <Route path="result" element={result && currentImage ? <ResultView result={result} image={currentImage} onReset={() => navigate('/patient/upload')} onBookConsultation={() => navigate('/patient/bookings')} onStartTracking={handleStartTracking} /> : <Navigate to="/patient/upload" replace />} />
          <Route path="bookings" element={<BookingView doctors={doctorProfiles} result={result} bookings={bookings} currentUser={user!} patientProfile={effectiveUserProfile as PatientProfile} selectedDoctorEmail={selectedDoctorEmail} setSelectedDoctorEmail={setSelectedDoctorEmail} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedTime={selectedTime} setSelectedTime={setSelectedTime} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onConfirmBooking={handleConfirmBooking} onPayBooking={(id) => handleUpdateBooking(id, { status: 'Confirmed', paymentStatus: 'Paid' })} onOpenChat={(booking) => setActiveChatBooking(booking)} />} />
          <Route path="appointments" element={<AppointmentsView bookings={bookings} currentUser={user!} onPayBooking={(id) => handleUpdateBooking(id, { status: 'Confirmed', paymentStatus: 'Paid' })} onOpenChat={(booking) => setActiveChatBooking(booking)} onBookNew={() => navigate('/patient/bookings')} onDeleteBooking={handleDeleteBooking} />} />
          <Route path="tracking" element={<TrackingView items={trackingItems} />} />
          <Route path="history" element={<HistoryView history={history} onDeleteItem={handleDeleteHistoryItem} onClear={() => setShowConfirm(true)} />} />
          <Route path="profile" element={<PatientProfilePage user={user!} profile={effectiveUserProfile} onChange={setUserProfile} onSave={handleSaveProfile} isSaving={isSavingProfile} />} />
        </Route>

        <Route path="/doctor" element={<ProtectedRoute role="doctor"><Layout /></ProtectedRoute>}>
          <Route path="home" element={<DoctorHomePage user={user!} profile={effectiveUserProfile} patients={doctorPatients} onApproveBooking={(id) => handleUpdateBooking(id, { status: 'Approved', doctorUid: user!.uid })} onRejectBooking={(id, reason) => handleUpdateBooking(id, { status: 'Rejected', rejectionReason: reason } as any)} />} />
          <Route path="profile" element={<DoctorProfilePage user={user!} profile={effectiveUserProfile} onSave={handleSaveProfile} isSaving={isSavingProfile} />} />
          <Route path="patient/:patientId" element={<DoctorPatientDetailsPage patient={selectedPatient} onApproveBooking={(id) => handleUpdateBooking(id, { status: 'Approved', doctorUid: user!.uid })} onOpenChat={(booking) => setActiveChatBooking(booking)} onStartCall={voiceCall.startCall} getCallAccess={voiceCall.getBookingCallAccess} />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? `/${user.role}/home` : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}
