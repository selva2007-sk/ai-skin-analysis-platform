import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { AppUser, BookingItem, DoctorProfile, UserProfile } from '../../app/types';

export const DoctorHomePage = ({
  user,
  profile,
  patients,
  onPatientClick,
  onApproveBooking,
  onRejectBooking
}: {
  user: AppUser;
  profile: UserProfile | null;
  patients: BookingItem[];
  onPatientClick?: (id: string) => void;
  onApproveBooking?: (id: string) => void;
  onRejectBooking?: (id: string, reason?: string) => void;
}) => {
  const navigate = useNavigate();
  const doctor = profile as DoctorProfile | null;
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#052e2b_0%,#0f766e_55%,#34d399_100%)] p-8 text-white shadow-2xl shadow-emerald-500/20">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">Doctor Dashboard</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Patient List</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85">Doctors can only view assigned patients. Open a patient record to review full personal information, medical history, diseases, and health records.</p>
        <div className="mt-6 flex flex-wrap gap-4">
          <button onClick={() => navigate('/doctor/profile')} className="rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-emerald-900 shadow-lg transition-transform hover:scale-[1.02]">Edit Profile & Availability</button>
        </div>
        <p className="mt-4 text-sm font-bold text-white/80">Signed in as {doctor?.fullName || user.email}</p>
      </div>

      <div className="mt-6 grid gap-4">
        {patients.length === 0 ? (
          <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No patients assigned to this doctor yet.
          </div>
        ) : patients.map((patient) => (
          <div
            key={patient.id}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 text-left shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
          >
            <div className="grid items-center gap-4 md:grid-cols-4">
              <div className="md:col-span-3 grid cursor-pointer gap-4 md:grid-cols-3" onClick={() => onPatientClick ? onPatientClick(patient.id) : navigate(`/doctor/patient/${patient.id}`)}>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Patient</p>
                  <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{patient.patientName}</p>
                  <p className={`mt-1 text-xs font-bold uppercase tracking-wider ${patient.status === 'Pending' ? 'text-amber-500' : (patient.status as string) === 'Rejected' ? 'text-red-500' : patient.status === 'Approved' ? 'text-blue-500' : 'text-emerald-500'}`}>
                    {patient.status} {patient.paymentStatus === 'Paid' ? '(Paid)' : patient.status === 'Approved' ? '(Unpaid)' : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Appointment Time</p>
                  <p className="mt-2 text-base font-black text-slate-900 dark:text-white">{new Date(patient.date).toLocaleDateString()}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.time}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Current Condition</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{patient.prediction}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.patientAge} years old, {patient.patientGender}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {patient.status === 'Pending' && onApproveBooking && onRejectBooking ? (
                  <>
                    <button onClick={() => onApproveBooking(patient.id)} className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors">Approve</button>
                    <button onClick={() => setRejectingId(patient.id)} className="w-full rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-500 transition-colors hover:bg-red-500 hover:text-white">Reject</button>
                  </>
                ) : (
                    <button onClick={() => onPatientClick ? onPatientClick(patient.id) : navigate(`/doctor/patient/${patient.id}`)} className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">View Details</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setRejectingId(null); setRejectReason(''); }} />
          <div className="relative w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl dark:bg-slate-900">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Reject Appointment</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">Please provide a brief reason for rejecting this appointment request. This will be visible to the patient.</p>
            <textarea 
              value={rejectReason} 
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., I am out of office this week. Please book for next week."
              className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              rows={3}
            />
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setRejectingId(null); setRejectReason(''); }} className="flex-1 rounded-2xl bg-slate-100 px-5 py-3.5 text-sm font-black text-slate-900 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">Cancel</button>
              <button onClick={() => { 
                if(onRejectBooking) onRejectBooking(rejectingId, rejectReason || 'Doctor is currently unavailable for this slot.'); 
                setRejectingId(null); 
                setRejectReason(''); 
              }} className="flex-1 rounded-2xl bg-red-500 px-5 py-3.5 text-sm font-black text-white transition-colors hover:bg-red-600">Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DoctorProfilePage = ({
  user,
  profile,
  onSave,
  isSaving
}: {
  user: AppUser;
  profile: UserProfile | null;
  onSave: (next: UserProfile) => Promise<void> | void;
  isSaving: boolean;
}) => {
  const navigate = useNavigate();
  const doctor = profile as DoctorProfile | null;
  
  const [formData, setFormData] = useState({
    fullName: doctor?.fullName || '',
    phone: doctor?.phone || '',
    specialization: doctor?.specialization || '',
    hospital: doctor?.hospital || '',
    consultationFee: doctor?.consultationFee || 500,
    licenseNumber: doctor?.licenseNumber || '',
    experienceYears: doctor?.experienceYears || '',
    consultationMode: doctor?.consultationMode || 'Online + In-person'
  });

  const [availableDates, setAvailableDates] = useState<any[]>(
    Array.isArray(doctor?.availableDates) ? doctor.availableDates : []
  );
  const [newSlot, setNewSlot] = useState('');

  // Sync the local form state when the real profile data arrives from Firestore
  useEffect(() => {
    if (doctor) {
      setFormData({
        fullName: doctor.fullName || '',
        phone: doctor.phone || '',
        specialization: doctor.specialization || '',
        hospital: doctor.hospital || '',
        consultationFee: doctor.consultationFee || 500,
        licenseNumber: doctor.licenseNumber || '',
        experienceYears: doctor.experienceYears || '',
        consultationMode: doctor.consultationMode || 'Online + In-person'
      });
      setAvailableDates(Array.isArray(doctor.availableDates) ? doctor.availableDates : []);
    }
  }, [doctor]);

  if (!doctor) return null;

  const handleAddSlot = () => {
    if (newSlot.trim() && !availableDates.includes(newSlot.trim())) {
      setAvailableDates([newSlot.trim(), ...availableDates]);
      setNewSlot('');
    }
  };

  const handleRemoveSlot = (slot: any) => {
    setAvailableDates(availableDates.filter(d => d !== slot));
  };

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave({ 
      ...doctor, 
      ...formData,
      consultationFee: Number(formData.consultationFee),
      availableDates: availableDates as any 
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
      <button onClick={() => navigate('/doctor/home')} className="mb-6 text-sm font-black text-emerald-700 dark:text-emerald-300">Back to dashboard</button>
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Doctor Profile</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{formData.fullName || doctor?.fullName}</h2>
        
        <div className="mt-6 mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Full Name</label>
            <input value={formData.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Email (Read Only)</label>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{doctor.email}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Phone</label>
            <input value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Specialization</label>
            <input value={formData.specialization} onChange={(e) => handleChange('specialization', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Hospital / Clinic</label>
            <input value={formData.hospital} onChange={(e) => handleChange('hospital', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Consultation Fee (Rs.)</label>
            <input type="number" value={formData.consultationFee} onChange={(e) => handleChange('consultationFee', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">License Number</label>
            <input value={formData.licenseNumber} onChange={(e) => handleChange('licenseNumber', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Experience (Years)</label>
            <input type="number" value={formData.experienceYears} onChange={(e) => handleChange('experienceYears', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800 md:col-span-2">
            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Consultation Mode</label>
            <select value={formData.consultationMode} onChange={(e) => handleChange('consultationMode', e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="Online + In-person">Online + In-person</option>
              <option value="In-person only">In-person only</option>
              <option value="Online only">Online only</option>
            </select>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8 dark:border-slate-800">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Availability Management</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">Update the dates and times you are available for patient consultations. These slots will be visible to patients when they book an appointment.</p>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Add New Available Slot</label>
          <div className="mt-2 flex gap-3">
            <input 
              value={newSlot} 
              onChange={(e) => setNewSlot(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAddSlot()}
              placeholder="e.g., Monday 10:00 AM - 2:00 PM or Oct 25, 3:00 PM" 
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" 
            />
            <button onClick={handleAddSlot} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700">Add Slot</button>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Current Availability</p>
          {availableDates.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">No availability set. Patients won't be able to book you.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {availableDates.map(slot => (
                <li key={typeof slot === 'string' ? slot : slot.date} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {typeof slot === 'string' ? slot : slot.date ? `${slot.date} (${slot.slots?.filter((s:any)=>s.available).length || 0} slots available)` : JSON.stringify(slot)}
                  </span>
                  <button onClick={() => handleRemoveSlot(slot)} className="text-sm font-bold text-red-500 transition-colors hover:text-red-600">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10 flex justify-end border-t border-slate-100 pt-6 dark:border-slate-800">
          <button onClick={handleSave} disabled={isSaving} className="rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:opacity-70 dark:bg-white dark:text-slate-900">
            {isSaving ? 'Saving...' : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const DoctorPatientDetailsPage = ({
  patient,
  onBack,
  onApproveBooking,
  onOpenChat,
  onStartCall,
  getCallAccess
}: {
  patient: BookingItem | null;
  onBack?: () => void;
  onApproveBooking?: (id: string) => void;
  onOpenChat?: (patient: BookingItem) => void;
  onStartCall?: (patient: BookingItem) => void;
  getCallAccess?: (patient: BookingItem) => { canCall: boolean; reason?: string };
}) => {
  const navigate = useNavigate();

  if (!patient) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
        <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Patient record not found.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <button onClick={() => onBack ? onBack() : navigate('/doctor/home')} className="mb-6 text-sm font-black text-emerald-700 dark:text-emerald-300">Back to patient list</button>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Personal Information</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{patient.patientName}</h2>
              <p className={`mt-1 text-sm font-bold uppercase tracking-wider ${patient.status === 'Pending' ? 'text-amber-500' : (patient.status as string) === 'Rejected' ? 'text-red-500' : patient.status === 'Approved' ? 'text-blue-500' : 'text-emerald-500'}`}>{patient.status} {patient.paymentStatus === 'Paid' ? '(Paid)' : patient.status === 'Approved' ? '(Unpaid)' : ''}</p>
            </div>
            <div className="flex gap-2">
              {onStartCall && getCallAccess && (
                <button
                  onClick={() => onStartCall(patient)}
                  disabled={!getCallAccess(patient).canCall}
                  title={getCallAccess(patient).canCall ? 'Start voice call' : (getCallAccess(patient).reason || 'Voice call unavailable')}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black shadow-lg transition-colors ${
                    getCallAccess(patient).canCall
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  Call
                </button>
              )}
              <button onClick={() => onOpenChat?.(patient)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-lg dark:bg-white dark:text-slate-900 hover:opacity-80">Chat</button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['Patient ID', patient.id],
              ['Email', patient.patientEmail],
              ['Phone', patient.patientPhone],
              ['Age', patient.patientAge],
              ['Gender', patient.patientGender],
              ['Blood Group', patient.patientBloodGroup],
              ['Emergency Contact', patient.patientEmergencyContact],
              ['Allergies', patient.patientAllergies],
              ['Address', patient.patientAddress]
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{value || 'Not provided'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Medical History And Health Records</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{patient.prediction}</h2>
          {patient.prediction === 'General Consultation' || patient.confidence === 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-100 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Consultation Type</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">General Visit</p></div>
              <div className="rounded-3xl bg-emerald-500/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Record Date</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{new Date(patient.date).toDateString()}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.time}</p></div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-[#2A7FFF]/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2A7FFF]">Confidence</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{Math.round(patient.confidence * 100)}%</p></div>
              <div className="rounded-3xl bg-red-500/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500">Severity</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{patient.severity}</p></div>
              <div className="rounded-3xl bg-emerald-500/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Record Date</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{new Date(patient.date).toDateString()}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.time}</p></div>
            </div>
          )}
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Current Disease / Condition</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.caseDescription || 'No description available.'}</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Treatment Guidance</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.treatment || 'No specific treatment guidance recorded.'}</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Medication Records</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.medications?.length ? patient.medications.join(', ') : 'No medications recorded.'}</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Follow-up Health Records</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.nextSteps?.length ? patient.nextSteps.join(', ') : 'No follow-up steps recorded.'}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};
