import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, ChevronLeft, Pill, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import { bloodGroups, cn, genders } from './utils';
import { HistoryItem, PatientProfile, PredictionResult, TrackingItem } from './types';
import { useAppSettings } from './settings';

export const UploadSection = ({
  profile,
  onUpload,
  isLoading,
  analysisError,
  serverStatus
}: {
  profile: PatientProfile | null;
  onUpload: (input: File | string, patientInfo: PredictionResult['patientInfo']) => void;
  isLoading: boolean;
  analysisError?: string | null;
  serverStatus?: 'checking' | 'online' | 'offline';
}) => {
  const [patientName, setPatientName] = useState(profile?.fullName || '');
  const [patientAge, setPatientAge] = useState(profile?.age || '');
  const [patientGender, setPatientGender] = useState(profile?.gender || '');
  const [bloodGroup, setBloodGroup] = useState(profile?.bloodGroup || '');
  const [selectedFile, setSelectedFile] = useState<File | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useAppSettings();
  const analyzeInFlightRef = useRef(false);

  useEffect(() => {
    setPatientName(profile?.fullName || '');
    setPatientAge(profile?.age || '');
    setPatientGender(profile?.gender || '');
    setBloodGroup(profile?.bloodGroup || '');
  }, [profile]);

  useEffect(() => {
    if (!isLoading) {
      analyzeInFlightRef.current = false;
    }
  }, [isLoading]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false, disabled: isLoading });

  const handleAnalyze = () => {
    if (isLoading || analyzeInFlightRef.current) return;
    analyzeInFlightRef.current = true;

    if (!patientName.trim() || !patientAge.trim() || !patientGender || !bloodGroup) {
      setError('Please complete patient name, age, gender, and blood group before scanning.');
      analyzeInFlightRef.current = false;
      return;
    }
    if (!selectedFile) {
      setError('Please upload a lesion image first.');
      analyzeInFlightRef.current = false;
      return;
    }
    if (!isOnline) {
      setError('You are offline. Connect to the internet and try again.');
      analyzeInFlightRef.current = false;
      return;
    }
    onUpload(selectedFile, { name: patientName, age: patientAge, gender: patientGender, bloodGroup });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-24">
      <div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.35em] text-slate-400">Patient Scan</p><h2 className="mt-3 text-4xl font-black text-slate-900 dark:text-white">Capture profile and scan details together</h2></div>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Patient Details</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Age" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Select gender</option>{genders.map((gender) => <option key={gender}>{gender}</option>)}</select>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-medium outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Select blood group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select>
          </div>
          <div className="mt-8 rounded-[2rem] bg-slate-950 p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">What you get</p><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300"><li>Severity estimate and AI confidence</li><li>Treatment direction and medication suggestions</li><li>Doctor consultation booking and progress tracking</li></ul></div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Image Upload</p>
            <span className={cn(
              'rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]',
              serverStatus === 'online' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
              serverStatus === 'checking' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
              serverStatus === 'offline' && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
            )}>
              {serverStatus === 'online' ? 'Analysis ready' : serverStatus === 'checking' ? 'Checking connection' : 'Analysis unavailable'}
            </span>
          </div>
          <div {...getRootProps()} className={cn('relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-8 text-center transition-all', isDragActive ? 'border-[#2A7FFF] bg-[#2A7FFF]/5' : 'border-slate-300 bg-slate-50 hover:border-[#2A7FFF]/60 hover:bg-[#2A7FFF]/5 dark:border-slate-700 dark:bg-slate-800/50', isLoading && 'cursor-not-allowed opacity-60')}>
            <input {...getInputProps()} />
            {selectedFile ? (<div className="space-y-4">{typeof selectedFile === 'string' ? <img src={selectedFile} alt="Lesion preview" className="mx-auto h-40 w-40 rounded-3xl object-cover shadow-lg" /> : <CheckCircle2 className="mx-auto h-14 w-14 text-[#2A7FFF]" />}<p className="font-black text-slate-900 dark:text-white">{typeof selectedFile === 'string' ? 'Image ready for analysis' : selectedFile.name}</p></div>) : (<><Upload className="mb-4 h-10 w-10 text-[#2A7FFF]" /><p className="text-lg font-black text-slate-900 dark:text-white">Upload lesion image</p><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Tap to take a photo or browse gallery</p></>)}
          </div>
          {!isOnline && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              You are offline. Connect to the internet to analyze the lesion image.
            </div>
          )}
          {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 dark:border-red-900/40 dark:bg-red-950/40">{error}</div>}
          {analysisError && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{analysisError}</span>
              </div>
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button onClick={handleAnalyze} disabled={isLoading || !isOnline} className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{isLoading ? 'Analyzing...' : 'Analyze Lesion'}</button>
            <button onClick={handleAnalyze} disabled={isLoading || !selectedFile || serverStatus === 'checking'} className="w-full rounded-2xl border border-slate-300 px-5 py-4 text-sm font-black text-slate-900 transition-all hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">
              <span className="inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" />Retry Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ResultView = ({ result, image, onReset, onBookConsultation, onStartTracking }: { result: PredictionResult; image: string; onReset: () => void; onBookConsultation: () => void; onStartTracking: () => void; }) => {
  useEffect(() => {
    if (result.confidence > 0.8) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#2A7FFF', '#00C896', '#FFFFFF'] });
  }, [result]);

  const generatePDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(22); pdf.text('Skin Analysis Report', 20, 20);
    pdf.setFontSize(11); pdf.text(`Disease name: ${result.diseaseName || result.prediction}`, 20, 34); pdf.text(`Confidence: ${Math.round(result.confidence * 100)}%`, 20, 42); pdf.text(`Severity: ${result.severity}`, 20, 50); pdf.text(`Treatment: ${result.treatment}`, 20, 58, { maxWidth: 170 }); pdf.text(`Medications: ${result.medications.join(', ')}`, 20, 76, { maxWidth: 170 }); pdf.text(`Observed features: ${(result.observedFeatures || []).join(', ')}`, 20, 94, { maxWidth: 170 }); pdf.text(`Next steps: ${result.nextSteps.join(', ')}`, 20, 116, { maxWidth: 170 }); pdf.text(`Provider: ${result.providerStatus || 'AI analysis completed'}`, 20, 134, { maxWidth: 170 }); pdf.text(result.disclaimer, 20, 152, { maxWidth: 170 }); pdf.save('dermacheck-analysis.pdf');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-24">
      <button onClick={onReset} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"><ChevronLeft className="h-4 w-4" />Back to scan</button>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6"><div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"><img src={image} alt="Lesion" className="h-full w-full object-cover" /></div><div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Clinical summary</p><p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{result.description}</p></div></div>
        <div className="space-y-6">
          <div className="rounded-[2.5rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/20 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Detected skin disease</p><h2 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-4xl">{result.diseaseName || result.prediction}</h2><p className="mt-3 text-sm font-bold text-slate-300">Live AI image analysis compares the supported skin diseases and returns a conservative estimate, not a guaranteed diagnosis.</p></div><div className="w-full rounded-3xl bg-white/10 px-5 py-4 text-left sm:w-auto sm:text-right"><p className="text-3xl font-black">{Math.round(result.confidence * 100)}%</p><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Confidence</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-3xl bg-red-500/15 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-200">Severity</p><p className="mt-2 text-2xl font-black">{result.severity}</p></div><div className="rounded-3xl bg-cyan-500/15 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Accuracy</p><p className="mt-2 text-lg font-black">{result.accuracyLabel}</p></div><div className="rounded-3xl bg-emerald-500/15 p-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">Provider</p><p className="mt-2 text-sm font-black">{result.providerStatus || 'AI analysis completed'}</p></div></div></div>
          {result.observedFeatures && result.observedFeatures.length > 0 && <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-cyan-600" /><h3 className="text-lg font-black text-slate-900 dark:text-white">Observed Image Features</h3></div><div className="mt-4 flex flex-wrap gap-3">{result.observedFeatures.map((feature) => <span key={feature} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{feature}</span>)}</div></div>}
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><h3 className="text-lg font-black text-slate-900 dark:text-white">Treatment</h3></div><p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{result.treatment}</p></div><div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><Pill className="h-5 w-5 text-[#2A7FFF]" /><h3 className="text-lg font-black text-slate-900 dark:text-white">Medication Guidance</h3></div><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{result.medications.map((item) => <li key={item}>• {item}</li>)}</ul></div></div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-amber-500" /><h3 className="text-lg font-black text-slate-900 dark:text-white">What should happen next</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{result.nextSteps.map((step) => <div key={step} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{step}</div>)}</div></div>
          <div className="grid gap-4 sm:grid-cols-2"><button onClick={onBookConsultation} className="rounded-2xl bg-[#2A7FFF] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#2A7FFF]/20">Doctor Consultation</button><button onClick={onStartTracking} className="rounded-2xl bg-[#00C896] px-5 py-4 text-sm font-black text-white shadow-lg shadow-[#00C896]/20">Start Tracking</button><button onClick={generatePDF} className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-white">Download Report</button><button onClick={onReset} className="rounded-2xl border border-slate-300 px-5 py-4 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-white">New Scan</button></div>
        </div>
      </div>
    </div>
  );
};

export const TrackingView = ({ items }: { items: TrackingItem[] }) => (
  <div className="mx-auto max-w-5xl px-4 pb-12 pt-24"><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Tracking</p><h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Active skin recovery plans</h2></div>{items.length === 0 ? <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Start tracking from a result screen to create follow-up routines.</div> : <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <div key={item.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{item.status}</p><h3 className="mt-3 text-xl font-black text-slate-900 dark:text-white">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-500 dark:text-slate-400"><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-800">{item.frequency}</span><span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-800">Linked to {item.linkedPrediction}</span></div></div>)}</div>}</div>
);

export const HistoryView = ({ history, onDeleteItem, onClear }: { history: HistoryItem[]; onDeleteItem: (id: string) => void; onClear: () => void; }) => (
  <div className="mx-auto max-w-5xl px-4 pb-12 pt-24"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">History</p><h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Previous scan reports</h2></div>{history.length > 0 && <button onClick={onClear} className="text-sm font-black text-red-500">Clear all</button>}</div>{history.length === 0 ? <div className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">No scan history yet.</div> : <div className="grid gap-4 md:grid-cols-2">{history.filter(item => 'prediction' in item).map((item: any) => <div key={item.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none"><div className="flex h-36"><img src={item.image} alt={item.prediction} className="h-full w-32 object-cover" /><div className="flex-1 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black text-slate-900 dark:text-white">{item.prediction}</p><p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Severity {item.severity}</p></div><button onClick={() => onDeleteItem(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Confidence {Math.round(item.confidence * 100)}%</p><p className="mt-2 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</p></div></div></div>)}</div>}</div>
);
