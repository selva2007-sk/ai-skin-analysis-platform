import { AppUser, BookingItem, DoctorProfile, UserProfile } from '../../app/types';
import { getDoctorPatientRoute, navigateTo } from '../../router/router';

export const DoctorHomePage = ({
  user,
  profile,
  patients
}: {
  user: AppUser;
  profile: UserProfile | null;
  patients: BookingItem[];
}) => {
  const doctor = profile as DoctorProfile | null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#052e2b_0%,#0f766e_55%,#34d399_100%)] p-8 text-white shadow-2xl shadow-emerald-500/20">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-100">Doctor Home Dashboard</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Welcome, {doctor?.fullName || user.email}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85">This doctor module only shows patient records. Open any patient to review full information, diseases, and medical records.</p>
      </div>

      <div className="mt-6 grid gap-4">
        {patients.length === 0 ? (
          <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No patients assigned to this doctor yet.
          </div>
        ) : patients.map((patient) => (
          <button
            key={patient.id}
            onClick={() => navigateTo(getDoctorPatientRoute(patient.id))}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 text-left shadow-lg shadow-slate-200/60 transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"
          >
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.7fr]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Patient</p>
                <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{patient.patientName}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.patientEmail}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.patientAge} years • {patient.patientGender}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Disease / Condition</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{patient.prediction}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Severity: {patient.severity}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Confidence: {Math.round(patient.confidence * 100)}%</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Medical Record</p>
                <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{new Date(patient.date).toDateString()}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.time}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const DoctorPatientDetailsPage = ({
  patient
}: {
  patient: BookingItem | null;
}) => {
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
      <button onClick={() => navigateTo('/doctor/home')} className="mb-6 text-sm font-black text-emerald-700 dark:text-emerald-300">Back to patient list</button>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Full Patient Information</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{patient.patientName}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
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
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Diseases / Conditions</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{patient.prediction}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-[#2A7FFF]/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2A7FFF]">Confidence</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{Math.round(patient.confidence * 100)}%</p></div>
            <div className="rounded-3xl bg-red-500/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500">Severity</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{patient.severity}</p></div>
            <div className="rounded-3xl bg-emerald-500/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Medical Record</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{new Date(patient.date).toDateString()}</p></div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Condition Summary</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.caseDescription}</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Treatment Guidance</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.treatment}</p></div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Medical Records</p><p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.medications.join(', ')}</p><p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{patient.nextSteps.join(', ')}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DoctorProfilePage = ({
  profile
}: {
  profile: UserProfile | null;
}) => {
  const doctor = profile as DoctorProfile | null;
  if (!doctor) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Doctor Profile Page</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{doctor.fullName}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ['Email', doctor.email],
            ['Phone', doctor.phone],
            ['Specialization', doctor.specialization],
            ['Hospital', doctor.hospital],
            ['Consultation Fee', `Rs. ${doctor.consultationFee}`],
            ['License Number', doctor.licenseNumber],
            ['Experience', `${doctor.experienceYears || '0'} years`],
            ['Consultation Mode', doctor.consultationMode]
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-base font-black text-slate-900 dark:text-white">{value || 'Not provided'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
