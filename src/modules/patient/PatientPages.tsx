import { AppUser, BookingItem, HistoryItem, PatientProfile, PredictionResult, TrackingItem, UserProfile } from '../../app/types';
import { HistoryView, ResultView, TrackingView, UploadSection } from '../../app/patientViews';

export const PatientHomePage = ({
  user,
  profile,
  history,
  latestResult,
  bookingCount,
  trackingCount,
  onStartScan,
  onViewAppointments
}: {
  user: AppUser;
  profile: PatientProfile | null;
  history: HistoryItem[];
  latestResult: PredictionResult | null;
  bookingCount: number;
  trackingCount: number;
  onStartScan: () => void;
  onViewAppointments: () => void;
}) => (
  <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_50%,#10b981_100%)] p-8 text-white shadow-2xl shadow-cyan-500/20">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-100">Patient Home Dashboard</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Hello, {profile?.fullName || user.email}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85">Your personal details, medical history, and disease summaries are kept together in this patient module.</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button onClick={onStartScan} className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-900 transition-transform hover:scale-[1.02]">Start New Scan</button>
          <div className="rounded-2xl border border-white/20 px-6 py-4 text-sm font-bold text-white/90">Blood Group: {profile?.bloodGroup || 'Not set'}</div>
        </div>
      </div>

      <div className="grid gap-4">
        {[
          { label: 'Medical History', value: history.length, helper: 'Saved reports and records' },
          { label: 'Appointments', value: bookingCount, helper: 'Consultation appointments', action: onViewAppointments },
          { label: 'Tracking Plans', value: trackingCount, helper: 'Follow-up routines active' }
        ].map((card) => (
          <div key={card.label} onClick={card.action} className={`rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none ${card.action ? 'cursor-pointer hover:border-[#2A7FFF]/40 transition-colors' : ''}`}>
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
        <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{profile?.emergencyContact || 'Not added'}</p>
      </div>
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Allergies</p>
        <p className="mt-3 text-xl font-black text-slate-900 dark:text-white">{profile?.allergies || 'None shared'}</p>
      </div>
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Address</p>
        <p className="mt-3 text-base font-black text-slate-900 dark:text-white">{profile?.address || 'Not added'}</p>
      </div>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Latest Disease Details</p>
        {latestResult ? (
          <>
            <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{latestResult.diseaseName || latestResult.prediction}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{latestResult.description}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-[#2A7FFF]/10 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2A7FFF]">Confidence</p><p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{Math.round(latestResult.confidence * 100)}%</p></div>
              <div className="rounded-3xl bg-red-500/10 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500">Severity</p><p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{latestResult.severity}</p></div>
              <div className="rounded-3xl bg-emerald-500/10 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Treatment</p><p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{latestResult.treatment}</p></div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">No disease details are available yet. Start a scan to generate your first medical record.</p>
        )}
      </div>

      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Recent Medical History</p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">No medical history saved yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {history.filter(item => 'prediction' in item).slice(0, 3).map((item: any) => (
              <div key={item.id} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
                <p className="text-sm font-black text-slate-900 dark:text-white">{item.diseaseName || item.prediction}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const PatientProfilePage = ({
  user,
  profile,
  onChange,
  onSave,
  isSaving
}: {
  user: AppUser;
  profile: UserProfile | null;
  onChange: (next: UserProfile) => void;
  onSave: (next: UserProfile) => Promise<void> | void;
  isSaving: boolean;
}) => {
  if (!profile) return null;
  const patient = profile as PatientProfile;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Patient Profile Page</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{patient.fullName || user.email}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">Full personal and health information for the patient module.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ['Full Name', patient.fullName],
            ['Email', patient.email],
            ['Phone', patient.phone],
            ['Age', patient.age],
            ['Gender', patient.gender],
            ['Blood Group', patient.bloodGroup],
            ['Emergency Contact', patient.emergencyContact],
            ['Allergies', patient.allergies],
            ['Address', patient.address]
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-800">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 text-base font-black text-slate-900 dark:text-white">{value || 'Not provided'}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-end">
          <button onClick={() => onSave(profile)} disabled={isSaving} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-900">
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export { UploadSection, ResultView, TrackingView, HistoryView };
