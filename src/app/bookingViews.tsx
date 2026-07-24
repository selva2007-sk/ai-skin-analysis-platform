﻿﻿﻿﻿﻿﻿﻿﻿﻿import * as React from 'react';
import { CreditCard, Phone, Trash2, Wallet } from 'lucide-react';
import { cn } from './utils';
import { AppUser, BookingItem, DoctorProfile, PatientProfile, PaymentMethod, PredictionResult } from './types';

const getDoctorMatchScore = (doctor: DoctorProfile, result: PredictionResult | null) => {
  const specialization = doctor.specialization.toLowerCase();
  const prediction = result?.prediction.toLowerCase() || '';

  if (prediction.includes('melanoma') || prediction.includes('basal cell carcinoma') || prediction.includes('actinic keratoses')) {
    if (specialization.includes('dermatologist')) return 3;
    if (specialization.includes('cosmetic')) return 1;
  }

  if (prediction.includes('melanocytic nevi') || prediction.includes('benign keratosis') || prediction.includes('dermatofibroma') || prediction.includes('vascular lesions')) {
    if (specialization.includes('cosmetic')) return 3;
    if (specialization.includes('dermatologist')) return 2;
  }

  if (specialization.includes('dermatologist')) return 2;
  return 1;
};

const getDoctorMatchLabel = (doctor: DoctorProfile, result: PredictionResult | null) => {
  const score = getDoctorMatchScore(doctor, result);
  if (!result) return 'Available doctor';
  if (score >= 3) return 'Best match for this disease';
  if (score == 2) return 'Good match for this disease';
  return 'General consultation option';
};

export const AppointmentsView = ({ bookings, currentUser, onPayBooking, onOpenChat, onStartCall, getCallAccess, onBookNew, onDeleteBooking }: {
  bookings: BookingItem[];
  currentUser: AppUser;
  onPayBooking?: (bookingId: string) => void;
  onOpenChat?: (booking: BookingItem) => void;
  onStartCall?: (booking: BookingItem) => void;
  getCallAccess?: (booking: BookingItem) => { canCall: boolean; reason?: string };
  onBookNew?: () => void;
  onDeleteBooking?: (bookingId: string) => void;
}) => {
  const myBookings = bookings.filter((item) => item.patientUid === currentUser.uid || item.patientEmail === currentUser.email);
  
  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Consultations</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Your Appointments</h2>
        </div>
        <button onClick={onBookNew} className="rounded-xl bg-[#2A7FFF] px-5 py-3 text-sm font-black text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20">Book New Appointment</button>
      </div>
      <div className="space-y-4">
        {myBookings.length === 0 ? (
          <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No appointments yet.
          </div>
        ) : myBookings.map((booking) => (
          <div key={booking.id} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
            {onDeleteBooking && (
              <button onClick={() => onDeleteBooking(booking.id)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            <div className="pr-10 md:pr-0">
              <p className="text-lg font-black text-slate-900 dark:text-white">Dr. {booking.doctorName}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{new Date(booking.date).toDateString()} • {booking.time}</p>
              <p className={cn("mt-1 text-sm font-bold", (booking.status as string) === 'Rejected' ? 'text-red-500' : 'text-[#2A7FFF]')}>Status: {booking.status}</p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              {booking.status === 'Pending' && <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Waiting for Doctor</span>}
              {(booking.status as string) === 'Rejected' && (
                <div className="flex flex-col items-start md:items-end gap-1">
                  <span className="rounded-full bg-red-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">Doctor Unavailable</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Please apply again for a different time.</p>
                  {(booking as any).rejectionReason && <p className="mt-1 max-w-sm text-left md:text-right text-xs font-medium italic text-slate-600 dark:text-slate-400">Note: {(booking as any).rejectionReason}</p>}
                </div>
              )}
              {booking.status === 'Approved' && booking.paymentStatus === 'Unpaid' && (
                <button onClick={() => onPayBooking?.(booking.id)} className="rounded-xl bg-[#00C896] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#00C896]/20 transition-transform hover:scale-105">
                  Pay Rs. {booking.amount} to Confirm
                </button>
              )}
              {(booking.paymentStatus === 'Paid' || booking.status === 'Approved' || (booking.status as string) === 'Confirmed') && (
                <div className="flex flex-wrap gap-2">
                  {onStartCall && getCallAccess && (
                    <button
                      onClick={() => onStartCall(booking)}
                      disabled={!getCallAccess(booking).canCall}
                      title={getCallAccess(booking).canCall ? 'Start voice call' : (getCallAccess(booking).reason || 'Voice call unavailable')}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black shadow-lg transition-colors',
                        getCallAccess(booking).canCall
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                      )}
                    >
                      <Phone className="h-5 w-5" />
                      Call
                    </button>
                  )}
                  <button onClick={() => onOpenChat?.(booking)} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg dark:bg-white dark:text-slate-900 hover:opacity-80">Chat</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BookingView = ({ doctors, result, bookings, currentUser, patientProfile, selectedDoctorEmail, setSelectedDoctorEmail, selectedDate, setSelectedDate, selectedTime, setSelectedTime, paymentMethod, setPaymentMethod, onConfirmBooking, onPayBooking, onOpenChat }: {
  doctors: DoctorProfile[];
  result: PredictionResult | null;
  bookings: BookingItem[];
  currentUser: AppUser;
  patientProfile: PatientProfile | null;
  selectedDoctorEmail: string;
  setSelectedDoctorEmail: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  selectedTime: string;
  setSelectedTime: (value: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  onConfirmBooking: () => void;
  onPayBooking?: (bookingId: string) => void;
  onOpenChat?: (booking: BookingItem) => void;
}) => {
  const consultationDoctors = [...doctors].sort((a, b) => getDoctorMatchScore(b, result) - getDoctorMatchScore(a, result));
  const hasDoctors = consultationDoctors.length > 0;

  React.useEffect(() => {
    if (!consultationDoctors.length) return;

    if (!selectedDoctorEmail || !consultationDoctors.some((doctor) => doctor.email === selectedDoctorEmail)) {
      setSelectedDoctorEmail(consultationDoctors[0].email);
      setSelectedDate('');
      setSelectedTime('');
    }
  }, [consultationDoctors, selectedDoctorEmail, setSelectedDoctorEmail, setSelectedDate, setSelectedTime]);

  const selectedDoctor = consultationDoctors.find((doctor) => doctor.email === selectedDoctorEmail) || consultationDoctors[0];
  const selectedAvailability = selectedDoctor?.availableDates?.find((item) => {
    if (typeof item === 'string') return item === selectedDate;
    return item.date === selectedDate;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Doctor Consultation</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Choose doctor, date, slot, and payment</h2>
        {result && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Consultation is being booked for: {result.prediction} with severity {result.severity}. All doctor suggestions are ranked for this disease.</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">1. Select doctor</h3>
            <div className="mt-6 grid gap-4">
              {!hasDoctors && (
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  No active doctor accounts are available right now. Ask doctor to sign up/login in live system, then refresh this page.
                </div>
              )}
              {consultationDoctors.map((doctor, index) => (
                <button key={doctor.email} onClick={() => { setSelectedDoctorEmail(doctor.email); setSelectedDate(''); setSelectedTime(''); }} className={cn('rounded-[2rem] border p-5 text-left transition-all', selectedDoctorEmail === doctor.email ? 'border-[#2A7FFF] bg-[#2A7FFF]/5' : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800')}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{doctor.fullName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{doctor.specialization} • {doctor.hospital}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{doctor.consultationMode || 'Online + In-person'} • {doctor.experienceYears || '0'} years</p>
                      {result && (
                        <p className={cn('mt-2 text-xs font-black uppercase tracking-[0.2em]', index === 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400')}>{getDoctorMatchLabel(doctor, result)}</p>
                      )}
                    </div>
                    <div className="self-start sm:self-auto rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-900">Rs. {doctor.consultationFee}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">2. Choose date</h3>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(selectedDoctor?.availableDates || []).map((day) => {
              const isString = typeof day === 'string';
              const dateVal = isString ? day : day.date;
              const isAvailable = isString ? true : day.available;
              return (
                <button key={dateVal} onClick={() => {
                  if (isAvailable) {
                    setSelectedDate(dateVal);
                    if (isString) setSelectedTime('Time included in slot');
                    else setSelectedTime('');
                  }
                }} className={cn('rounded-3xl border p-4 text-left transition-all', !isAvailable && 'cursor-not-allowed border-red-200 bg-red-50 text-red-500 dark:border-red-900/40 dark:bg-red-950/30', isAvailable && selectedDate !== dateVal && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300', selectedDate === dateVal && 'border-[#2A7FFF] bg-[#2A7FFF] text-white')}>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]">{isAvailable ? 'Available' : 'Unavailable'}</p>
                  <p className="mt-2 text-sm font-black">{isString ? dateVal : new Date(dateVal).toLocaleDateString()}</p>
                </button>
              );
            })}
            </div>
          </div>

        {typeof selectedAvailability !== 'string' && (
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">3. Choose time slot</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {((selectedAvailability as any)?.slots || []).map((slot: any) => (
                <button key={slot.time} onClick={() => slot.available && setSelectedTime(slot.time)} className={cn('rounded-3xl border px-4 py-4 text-sm font-black transition-all', !slot.available && 'cursor-not-allowed border-red-200 bg-red-50 text-red-500 dark:border-red-900/40 dark:bg-red-950/30', slot.available && selectedTime !== slot.time && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300', selectedTime === slot.time && 'border-[#2A7FFF] bg-[#2A7FFF] text-white')}>
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-300/20">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Review</p>
            <h3 className="mt-3 text-3xl font-black">4. Request Appointment</h3>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black text-white">Patient</p>
                <p className="mt-2">{patientProfile?.fullName || currentUser.email}</p>
                <p>{patientProfile?.bloodGroup || 'Blood group not set'}</p>
                <p>{patientProfile?.emergencyContact || 'Emergency contact not added'}</p>
              </div>
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black text-white">Selected doctor</p>
                <p className="mt-2">{selectedDoctor?.fullName || 'No active doctor selected'}</p>
                <p>{selectedDoctor?.specialization || 'N/A'}</p>
                <p>{selectedDoctor?.consultationMode || 'Online + In-person'}</p>
                {result && selectedDoctor && <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{getDoctorMatchLabel(selectedDoctor, result)}</p>}
              </div>
              <div className="rounded-3xl bg-white/10 p-5">
                <p className="font-black text-white">Slot summary</p>
              <p className="mt-2">{selectedDate ? (typeof selectedAvailability === 'string' ? selectedDate : new Date(selectedDate).toDateString()) : 'Choose a date'}</p>
                <p>{selectedTime || 'Choose a time slot'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Preferred Payment Method</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You will be asked to pay only after the doctor approves your request.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {(['UPI', 'Card', 'Cash'] as PaymentMethod[]).map((method) => (
                <button key={method} onClick={() => setPaymentMethod(method)} className={cn('rounded-3xl border p-4 text-sm font-black transition-all', paymentMethod === method ? 'border-[#2A7FFF] bg-[#2A7FFF] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300')}>
                  {method === 'UPI' ? <Wallet className="mx-auto mb-2 h-5 w-5" /> : <CreditCard className="mx-auto mb-2 h-5 w-5" />}
                  {method}
                </button>
              ))}
            </div>
            <button disabled={!hasDoctors} onClick={onConfirmBooking} className="mt-8 w-full rounded-2xl bg-[#00C896] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#00C896]/20 disabled:cursor-not-allowed disabled:opacity-50">
              Request Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
