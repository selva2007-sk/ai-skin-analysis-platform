import { type FormEvent, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, Phone, User } from 'lucide-react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { UserProfile } from '../app/types';
import { bloodGroups, genders } from '../app/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { BrandLockup } from '../components/Branding';

type UserRole = 'patient' | 'doctor';

type LoginProps = {
  role: UserRole;
  onLoginSuccess: () => void; // No arguments needed, onAuthStateChanged will handle state
};

type ProfileForm = {
  fullName: string;
  age: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  emergencyContact: string;
  allergies: string;
  address: string;
  specialization: string;
  hospital: string;
  consultationFee: string;
  licenseNumber: string;
  experienceYears: string;
  consultationMode: string;
};

const initialProfileForm: ProfileForm = {
  fullName: '',
  age: '',
  gender: '',
  bloodGroup: '',
  phone: '',
  emergencyContact: '',
  allergies: '',
  address: '',
  specialization: '',
  hospital: '',
  consultationFee: '500',
  licenseNumber: '',
  experienceYears: '',
  consultationMode: 'Online + In-person'
};

const roleTheme = {
  patient: {
    shell: 'bg-[radial-gradient(circle_at_top,_rgba(42,127,255,0.14),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#f8fafc_100%)]',
    card: 'from-[#0f172a] via-[#1d4ed8] to-[#38bdf8]',
    button: 'bg-[#2A7FFF] shadow-lg shadow-[#2A7FFF]/20 hover:bg-[#1f6de0]',
    label: 'Patient Login',
    eyebrow: 'Patient Portal',
    subtitle: 'Use the patient account to access your dashboard, profile, medical history, and disease details.'
  },
  doctor: {
    shell: 'bg-[radial-gradient(circle_at_top,_rgba(0,168,126,0.16),_transparent_28%),linear-gradient(180deg,#f5fffb_0%,#eafbf5_48%,#f8fafc_100%)]',
    card: 'from-[#052e2b] via-[#0f766e] to-[#34d399]',
    button: 'bg-[#00A87E] shadow-lg shadow-[#00A87E]/20 hover:bg-[#008d69]',
    label: 'Doctor Login',
    eyebrow: 'Doctor Portal',
    subtitle: 'Doctor should only see the patient details list, diseases the patient has, and the full patient details.'
  }
} as const;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const sanitizePhoneNumber = (value: string) => digitsOnly(value).slice(0, 10);
const sanitizeAge = (value: string) => digitsOnly(value).slice(0, 3);
const sanitizeFee = (value: string) => digitsOnly(value).slice(0, 5);
const sanitizeExperience = (value: string) => digitsOnly(value).slice(0, 2);

export default function PortalLogin({ role, onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(initialProfileForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();
  const theme = roleTheme[role];

  const pageContent = useMemo(() => {
    if (view === 'forgot') {
      return {
        title: 'Reset Password',
        helper: "Enter your account's email address and we'll send you a link to reset your password."
      };
    }
    return {
      title: view === 'signup' ? `Create ${theme.label}` : theme.label,
      helper: view === 'signup' ? 'Create this role-specific account once and keep the right dashboard ready every time you sign in.' : theme.subtitle
    };
  }, [view, theme]);

  const updateProfile = (field: keyof ProfileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveRoleLocally = (nextRole: UserRole) => {
    localStorage.setItem('derm_user_role', nextRole);
  };

  const saveProfileLocally = (uid: string, profile: Record<string, unknown>) => {
    localStorage.setItem(`derm_profile_${uid}`, JSON.stringify(profile));
  };

  const buildProfilePayload = (uid: string, userEmail: string | null) => {
    const base = {
      uid,
      email: userEmail,
      role,
      fullName: profileForm.fullName || userEmail?.split('@')[0] || role,
      phone: profileForm.phone,
      updatedAt: new Date().toISOString()
    };

    if (role === 'patient') {
      return {
        ...base,
        age: profileForm.age,
        gender: profileForm.gender,
        bloodGroup: profileForm.bloodGroup,
        emergencyContact: profileForm.emergencyContact,
        allergies: profileForm.allergies,
        address: profileForm.address,
        createdAt: new Date().toISOString()
      };
    }

    return {
      ...base,
      specialization: profileForm.specialization || 'Dermatologist',
      hospital: profileForm.hospital || 'Skin AI Clinic',
      consultationFee: Number(profileForm.consultationFee || '500'),
      licenseNumber: profileForm.licenseNumber,
      experienceYears: profileForm.experienceYears,
      consultationMode: profileForm.consultationMode || 'Online + In-person',
      availableDates: [],
      createdAt: new Date().toISOString()
    };
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) nextErrors.email = 'Email is required';
    else if (!emailRegex.test(email)) nextErrors.email = 'Enter a valid email address';

    if (!password) nextErrors.password = 'Password is required';
    else if (password.length < 6) nextErrors.password = 'Password must be at least 6 characters';

    if (view === 'signup') {
      if (!profileForm.fullName.trim()) nextErrors.fullName = 'Full name is required';
      if (profileForm.phone && profileForm.phone.length !== 10) nextErrors.phone = 'Phone number must be 10 digits';

      if (role === 'patient') {
        if (!profileForm.age.trim()) nextErrors.age = 'Age is required';
        else if (Number(profileForm.age) < 1 || Number(profileForm.age) > 120) nextErrors.age = 'Age must be between 1 and 120';
        if (!profileForm.gender) nextErrors.gender = 'Gender is required';
        if (!profileForm.bloodGroup) nextErrors.bloodGroup = 'Blood group is required';
        if (!profileForm.emergencyContact.trim()) nextErrors.emergencyContact = 'Emergency contact is required';
        else if (profileForm.emergencyContact.length !== 10) nextErrors.emergencyContact = 'Emergency contact must be 10 digits';
      } else {
        if (!profileForm.specialization.trim()) nextErrors.specialization = 'Specialization is required';
        if (!profileForm.hospital.trim()) nextErrors.hospital = 'Hospital or clinic is required';
        if (!profileForm.licenseNumber.trim()) nextErrors.licenseNumber = 'License number is required';
        if (!profileForm.consultationFee.trim()) nextErrors.consultationFee = 'Consultation fee is required';
        else if (Number(profileForm.consultationFee) < 100) nextErrors.consultationFee = 'Consultation fee must be at least 100';
        if (profileForm.experienceYears && Number(profileForm.experienceYears) > 60) nextErrors.experienceYears = 'Experience must be 60 years or less';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setIsLoading(true);
    setErrors({});

    if (view === 'forgot') {
      if (!email.trim()) {
        setErrors({ email: 'Please enter your email address.' });
        setIsLoading(false);
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        setErrors({ generalSuccess: 'Password reset email sent! Please check your inbox and follow the instructions.' });
      } catch (error: any) {
        let message = 'Failed to send password reset email. Please try again.';
        if (error.code === 'auth/user-not-found') {
          message = 'No account found for this email address.';
        }
        setErrors({ general: message });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!validateForm()) { setIsLoading(false); return; }

    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      if (view === 'signup') {
        saveRoleLocally(role);
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const payload = buildProfilePayload(credential.user.uid, credential.user.email);

        try {
          await setDoc(doc(db, 'users', credential.user.uid), payload, { merge: true });
        } catch (dbError) {
          // If creating the profile doc fails, we must clean up the auth user.
          try {
            await credential.user.delete();
          } catch (deleteError) {
            console.error("Failed to clean up orphaned auth user:", deleteError);
          }
          handleFirestoreError(dbError, OperationType.WRITE, `users/${credential.user.uid}`);
          // Re-throw a user-friendly error to be caught by the outer catch block.
          throw new Error('Failed to create user profile. Your registration was not completed. Please try again.');
        }

        saveProfileLocally(credential.user.uid, payload);
        onLoginSuccess(); // Just trigger the success, RootApp's listener will pick it up
        return;
      }

      // --- REVISED LOGIN LOGIC ---
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // 1. Fetch user profile from Firestore without creating it.
      const userRef = doc(db, 'users', credential.user.uid);
      const userDoc = await getDoc(userRef);

      // 2. Check if profile exists and has a role.
      if (!userDoc.exists() || !userDoc.data()?.role) {
        await signOut(auth);
        setErrors({ general: 'This account does not have a valid profile. Please sign up first or contact support.' });
        return;
      }

      const userData = userDoc.data();
      const resolvedRole = userData.role as UserRole;

      // 3. Check if the stored role matches the login portal's role.
      if (resolvedRole !== role) {
        await signOut(auth);
        setErrors({ general: `This is a ${resolvedRole} account. Please use the ${resolvedRole} login page.` });
        return;
      }

      // 4. If all checks pass, proceed with login.
      saveRoleLocally(resolvedRole);
      saveProfileLocally(credential.user.uid, userData);
      onLoginSuccess(); // Just trigger the success, RootApp's listener will pick it up
    } catch (error: any) {
      if (error.message && error.message.startsWith('{')) return;

      let message = 'Unable to continue right now. Please try again.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') message = 'Email or password is incorrect.';
      else if (error.code === 'auth/user-not-found') message = 'No account found for this email. Please sign up.';
      else if (error.code === 'auth/email-already-in-use') message = 'This email is already registered. Please try logging in, or use the correct login page if you signed up with a different role.';
      else if (error.code === 'auth/network-request-failed') message = 'Network issue detected. Check internet and try again.';

      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen px-4 py-8 ${theme.shell}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl sm:items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full overflow-hidden">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8 md:rounded-[2.5rem] md:p-10">
            <div className="mb-6">
              <BrandLockup compact subtitle="Professional dermatology workflow with clear, accessible medical design." />
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{theme.eyebrow}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">{pageContent.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{pageContent.helper}</p>
            </div>

            {role === 'patient' ? (
              <div className="mb-6 flex gap-3 rounded-2xl bg-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="flex-1 rounded-xl bg-[#2A7FFF] px-4 py-3 text-sm font-black text-white shadow-lg shadow-[#2A7FFF]/20"
                >
                  Patient Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/doctor/login', { replace: true })}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-black text-slate-500 transition-all hover:bg-white"
                >
                  Doctor Login
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Patient Login
              </button>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {view === 'signup' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700">Full Name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input value={profileForm.fullName} onChange={(e) => updateProfile('fullName', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Enter your full name" />
                    </div>
                    {errors.fullName && <p className="text-xs font-bold text-red-500">{errors.fullName}</p>}
                  </div>

                  {role === 'patient' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Age</label>
                        <input value={profileForm.age} onChange={(e) => updateProfile('age', sanitizeAge(e.target.value))} inputMode="numeric" maxLength={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Age" />
                        {errors.age && <p className="text-xs font-bold text-red-500">{errors.age}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Gender</label>
                        <select value={profileForm.gender} onChange={(e) => updateProfile('gender', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white">
                          <option value="">Select gender</option>
                          {genders.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                        </select>
                        {errors.gender && <p className="text-xs font-bold text-red-500">{errors.gender}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Blood Group</label>
                        <select value={profileForm.bloodGroup} onChange={(e) => updateProfile('bloodGroup', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white">
                          <option value="">Select blood group</option>
                          {bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                        </select>
                        {errors.bloodGroup && <p className="text-xs font-bold text-red-500">{errors.bloodGroup}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Phone</label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input value={profileForm.phone} onChange={(e) => updateProfile('phone', sanitizePhoneNumber(e.target.value))} inputMode="numeric" maxLength={10} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="10-digit contact number" />
                        </div>
                        {errors.phone && <p className="text-xs font-bold text-red-500">{errors.phone}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Emergency Contact</label>
                        <input value={profileForm.emergencyContact} onChange={(e) => updateProfile('emergencyContact', sanitizePhoneNumber(e.target.value))} inputMode="numeric" maxLength={10} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="10-digit emergency number" />
                        {errors.emergencyContact && <p className="text-xs font-bold text-red-500">{errors.emergencyContact}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Allergies / Medical Notes</label>
                        <input value={profileForm.allergies} onChange={(e) => updateProfile('allergies', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Dust allergy, diabetes, etc." />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700">Address</label>
                        <input value={profileForm.address} onChange={(e) => updateProfile('address', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Enter patient address" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Specialization</label>
                        <input value={profileForm.specialization} onChange={(e) => updateProfile('specialization', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Dermatologist" />
                        {errors.specialization && <p className="text-xs font-bold text-red-500">{errors.specialization}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Hospital / Clinic</label>
                        <input value={profileForm.hospital} onChange={(e) => updateProfile('hospital', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Clinic name" />
                        {errors.hospital && <p className="text-xs font-bold text-red-500">{errors.hospital}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Consultation Fee</label>
                        <input value={profileForm.consultationFee} onChange={(e) => updateProfile('consultationFee', sanitizeFee(e.target.value))} inputMode="numeric" maxLength={5} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="500" />
                        {errors.consultationFee && <p className="text-xs font-bold text-red-500">{errors.consultationFee}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">License Number</label>
                        <input value={profileForm.licenseNumber} onChange={(e) => updateProfile('licenseNumber', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Medical council registration" />
                        {errors.licenseNumber && <p className="text-xs font-bold text-red-500">{errors.licenseNumber}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Experience</label>
                        <input value={profileForm.experienceYears} onChange={(e) => updateProfile('experienceYears', sanitizeExperience(e.target.value))} inputMode="numeric" maxLength={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Years of experience" />
                        {errors.experienceYears && <p className="text-xs font-bold text-red-500">{errors.experienceYears}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Phone</label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input value={profileForm.phone} onChange={(e) => updateProfile('phone', sanitizePhoneNumber(e.target.value))} inputMode="numeric" maxLength={10} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="10-digit contact number" />
                        </div>
                        {errors.phone && <p className="text-xs font-bold text-red-500">{errors.phone}</p>}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700">Consultation Mode</label>
                        <select value={profileForm.consultationMode} onChange={(e) => updateProfile('consultationMode', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white">
                          <option value="Online + In-person">Online + In-person</option>
                          <option value="In-person only">In-person only</option>
                          <option value="Online only">Online only</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="name@example.com" />
                </div>
                {errors.email && <p className="text-xs font-bold text-red-500">{errors.email}</p>}
              </div>

              {view !== 'forgot' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 font-medium outline-none transition-all focus:border-slate-400 focus:bg-white" placeholder="Enter password" />
                    <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs font-bold text-red-500">{errors.password}</p>}
                </div>
              )}

              {view === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 text-sm font-bold text-slate-500">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-slate-900" />
                    Remember me
                  </label>
                  <button type="button" onClick={() => { setView('forgot'); setErrors({}); }} className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-900">
                    Forgot Password?
                  </button>
                </div>
              )}

              {errors.general && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}
              {errors.generalSuccess && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-600">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{errors.generalSuccess}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading} className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-black text-white transition-all ${theme.button} disabled:cursor-not-allowed disabled:bg-slate-400`}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : view === 'signup' ? (
                  `Create ${theme.label}`
                ) : view === 'forgot' ? (
                  'Send Reset Link'
                ) : (
                  theme.label
                )}
              </button>
            </form>

            <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              {view !== 'forgot' ? (
                <p className="font-bold text-slate-700">
                  {view === 'signup' ? 'Already have an account?' : `New ${role} here?`}
                  <button type="button" onClick={() => { setView(view === 'signup' ? 'login' : 'signup'); setErrors({}); }} className="ml-2 font-black text-slate-900 underline underline-offset-4">
                    {view === 'signup' ? 'Login now' : 'Create account'}
                  </button>
                </p>
              ) : (
                <p className="font-bold text-slate-700">
                  Remembered your password?
                  <button type="button" onClick={() => { setView('login'); setErrors({}); }} className="ml-2 font-black text-slate-900 underline underline-offset-4">
                    Back to Login
                  </button>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
