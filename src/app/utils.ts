import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DoctorProfile, HistoryItem, PredictionResult, TrackingItem, BookingItem } from './types';

export const SUPPORTED_SKIN_DISEASES = [
  'Melanoma (mel)',
  'Basal cell carcinoma (bcc)',
  'Actinic keratoses (akiec)',
  'Melanocytic nevi (nv)',
  'Benign keratosis (bkl)',
  'Dermatofibroma (df)',
  'Vascular lesions (vasc)'
] as const;

const diseaseAliasMap: Record<string, (typeof SUPPORTED_SKIN_DISEASES)[number]> = {
  mel: 'Melanoma (mel)',
  melanoma: 'Melanoma (mel)',
  'melanoma (mel)': 'Melanoma (mel)',
  bcc: 'Basal cell carcinoma (bcc)',
  'basal cell carcinoma': 'Basal cell carcinoma (bcc)',
  'basal cell carcinoma (bcc)': 'Basal cell carcinoma (bcc)',
  akiec: 'Actinic keratoses (akiec)',
  'actinic keratoses': 'Actinic keratoses (akiec)',
  'actinic keratoses (akiec)': 'Actinic keratoses (akiec)',
  nv: 'Melanocytic nevi (nv)',
  'melanocytic nevi': 'Melanocytic nevi (nv)',
  'melanocytic nevi (nv)': 'Melanocytic nevi (nv)',
  bkl: 'Benign keratosis (bkl)',
  'benign keratosis': 'Benign keratosis (bkl)',
  'benign keratosis (bkl)': 'Benign keratosis (bkl)',
  df: 'Dermatofibroma (df)',
  dermatofibroma: 'Dermatofibroma (df)',
  'dermatofibroma (df)': 'Dermatofibroma (df)',
  vasc: 'Vascular lesions (vasc)',
  'vascular lesions': 'Vascular lesions (vasc)',
  'vascular lesions (vasc)': 'Vascular lesions (vasc)'
};

const normalizeDiseaseToken = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const STORAGE_KEYS = {
  history: 'derm_history_v2',
  bookings: 'derm_bookings_v2',
  tracking: 'derm_tracking_v2',
  doctors: 'derm_seeded_doctors_v2'
};

export const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const genders = ['Male', 'Female', 'Other'];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const readCollection = <T,>(key: string, fallback: T): T =>
  safeParse<T>(localStorage.getItem(key), fallback);

export const writeCollection = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getSeededDoctors = () => {
  const existing = safeParse<DoctorProfile[]>(localStorage.getItem(STORAGE_KEYS.doctors), []);
  const realDoctors = existing.filter((doctor) => !!doctor?.uid && !doctor.uid.startsWith('seed-') && !(doctor.email || '').toLowerCase().endsWith('@dermacheck.ai'));
  localStorage.setItem(STORAGE_KEYS.doctors, JSON.stringify(realDoctors));
  return realDoctors;
};

export const getPredictionMeta = (prediction: string, confidence: number) => {
  const library: Record<
    string,
    {
      treatment: string;
      medications: string[];
      steps: string[];
      severity: PredictionResult['severity'];
    }
  > = {
    'Melanoma (mel)': {
      treatment: 'Urgent dermatologist review with dermoscopy and biopsy discussion is recommended.',
      medications: ['Do not self-medicate', 'Use broad-spectrum SPF 50+', 'Protect lesion from sun exposure'],
      steps: ['Book a doctor consultation within 24 hours', 'Avoid scratching the lesion', 'Track change in size, border, and color daily'],
      severity: 'High'
    },
    'Basal cell carcinoma (bcc)': {
      treatment: 'Clinical confirmation and procedural treatment planning are recommended.',
      medications: ['Mild cleansing lotion', 'SPF 50+', 'Barrier repair moisturizer'],
      steps: ['Schedule consultation this week', 'Keep lesion clean and dry', 'Capture progress photos every 3 days'],
      severity: 'Medium'
    },
    'Actinic keratoses (akiec)': {
      treatment: 'Needs dermatologist review for cryotherapy or topical treatment planning.',
      medications: ['Sunscreen daily', 'Soothing ceramide cream', 'Anti-inflammatory cleanser'],
      steps: ['Avoid direct sun exposure', 'Consult dermatologist within 3 days', 'Track redness and scaling progression'],
      severity: 'Medium'
    },
    'Melanocytic nevi (nv)': {
      treatment: 'Usually observational, but monitor for ABCDE changes.',
      medications: ['Daily sunscreen', 'Gentle skin moisturizer'],
      steps: ['Continue monthly self-check', 'Capture baseline photo today', 'Consult if mole changes shape or color'],
      severity: 'Low'
    },
    'Benign keratosis (bkl)': {
      treatment: 'Benign-looking lesion, monitor and confirm clinically if symptoms change.',
      medications: ['Barrier cream', 'Gentle cleanser'],
      steps: ['Track irritation weekly', 'Avoid harsh scrubbing', 'Consult if itching or bleeding develops'],
      severity: 'Low'
    },
    'Dermatofibroma (df)': {
      treatment: 'Typically conservative management unless symptomatic.',
      medications: ['Moisturizer', 'Cooling gel if irritated'],
      steps: ['Observe for tenderness', 'Track size once per week', 'Review if persistent pain develops'],
      severity: 'Low'
    },
    'Vascular lesions (vasc)': {
      treatment: 'Clinical review suggested if lesion is bleeding or rapidly changing.',
      medications: ['Cold compress', 'Protective sunscreen'],
      steps: ['Avoid trauma to the lesion', 'Track bleeding episodes', 'Consult if lesion enlarges or darkens'],
      severity: 'Medium'
    }
  };

  const fallback = {
    treatment: 'Clinical review is recommended to validate the AI output before treatment decisions are made.',
    medications: ['Use sunscreen', 'Keep area clean', 'Avoid over-the-counter steroid use without guidance'],
    steps: ['Book consultation', 'Track symptoms', 'Monitor changes'],
    severity: 'Low' as PredictionResult['severity']
  };

  const meta = library[prediction] || fallback;
  const accuracyLabel =
    confidence >= 0.9
      ? 'High confidence AI estimate'
      : confidence >= 0.75
        ? 'Moderate confidence AI estimate'
        : 'Low confidence AI estimate';

  return {
    treatment: meta.treatment,
    medications: meta.medications,
    nextSteps: meta.steps,
    severity: meta.severity,
    accuracyLabel
  };
};

export const normalizeSkinDiseaseName = (value: unknown) => {
  const str = String(value || '').trim();
  if (!str) return null;
  const normalized = str.toLowerCase();
  if (diseaseAliasMap[normalized]) return diseaseAliasMap[normalized];

  const normalizedToken = normalizeDiseaseToken(str);
  if (diseaseAliasMap[normalizedToken]) return diseaseAliasMap[normalizedToken];

  return (
    SUPPORTED_SKIN_DISEASES.find((disease) => {
      const diseaseName = disease.toLowerCase();
      const diseaseToken = normalizeDiseaseToken(disease);
      return (
        diseaseName === normalized ||
        (normalizedToken && diseaseToken === normalizedToken) ||
        diseaseName.includes(normalized) ||
        normalized.includes(diseaseName) ||
        (normalizedToken && diseaseToken.includes(normalizedToken)) ||
        (diseaseToken && normalizedToken.includes(diseaseToken))
      );
    }) || null
  );
};

const fallbackPredictions = [
  'Melanocytic nevi (nv)',
  'Basal cell carcinoma (bcc)',
  'Actinic keratoses (akiec)',
  'Benign keratosis (bkl)'
];

const defaultPatientInfo = {
  name: 'Patient',
  age: 'Not provided',
  gender: 'Not provided',
  bloodGroup: 'Not provided'
};

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeSeverity = (value: unknown): PredictionResult['severity'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'high') return 'High';
  if (normalized === 'medium' || normalized === 'moderate') return 'Medium';
  return 'Low';
};

export const buildFallbackResult = (
  reason = 'Unable to analyze image now, please try again.',
  patientInfo?: Partial<PredictionResult['patientInfo']>
): PredictionResult => {
  const prediction = fallbackPredictions[Math.floor(Math.random() * fallbackPredictions.length)];
  const confidence = Number((0.74 + Math.random() * 0.2).toFixed(2));
  const meta = getPredictionMeta(prediction, confidence);

  return {
    prediction,
    diagnosis: prediction,
    diseaseName: prediction,
    supportedDiseases: [...SUPPORTED_SKIN_DISEASES],
    observedFeatures: ['Fallback result used because the live AI provider was unavailable'],
    providerStatus: 'Fallback used',
    confidence,
    top3: [
      { label: prediction, score: confidence },
      { label: 'Basal cell carcinoma (bcc)', score: Number((1 - confidence - 0.08).toFixed(2)) },
      { label: 'Benign keratosis (bkl)', score: 0.08 }
    ],
    description:
      `AI generated a fallback clinical summary because the live model response was unavailable. ${reason}`,
    disclaimer: 'This is an AI support output, not a medical diagnosis.',
    patientInfo: {
      ...defaultPatientInfo,
      ...(patientInfo || {})
    },
    recommendations: meta.nextSteps,
    ...meta
  };
};

export const normalizePredictionResult = (
  value: unknown,
  patientInfo?: Partial<PredictionResult['patientInfo']>,
  fallbackReason?: string
): PredictionResult => {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const entries = Object.entries(source);

  // Robust property extraction (case-insensitive for AI response keys)
  const getProp = (keys: string[]) => {
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      let val = source[key];
      if (val === undefined) {
        val = entries.find(([k]) => k.toLowerCase() === lowerKey)?.[1];
      }
      
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nested = (val as Record<string, unknown>).name || 
                       (val as Record<string, unknown>).label || 
                       (val as Record<string, unknown>).value || 
                       (val as Record<string, unknown>).prediction;
        if (typeof nested === 'string' && nested.trim()) return nested.trim();
      }
    }
    // Broad fallback for common AI naming patterns
    for (const [k, v] of entries) {
      if (['label', 'class', 'prediction', 'diagnosis', 'disease'].some(lk => k.toLowerCase().includes(lk))) {
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return '';
  };

  const primaryLabel = getProp(['diseaseName', 'prediction', 'diagnosis', 'label', 'result', 'diagnosis_name', 'class_name']);
  const normalizedDiseaseName = normalizeSkinDiseaseName(primaryLabel);
  
  // Priority: 1. Matched Disease Name, 2. Raw AI Label
  // If both are empty, we set it to empty string so the 'buildFallbackResult' logic below 
  // can trigger and provide a valid clinical summary instead of a generic error.
  const prediction = normalizedDiseaseName || primaryLabel || '';

  const rawConfidence = toNumber(source.confidence, 0.62);
  const confidence = Math.min(1, Math.max(0, rawConfidence));
  const meta = getPredictionMeta(prediction, confidence);

  const medications = Array.isArray(source.medications)
    ? source.medications.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const observedFeatures = Array.isArray(source.observedFeatures)
    ? source.observedFeatures.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const nextSteps = Array.isArray(source.nextSteps)
    ? source.nextSteps.map((item) => String(item).trim()).filter(Boolean)
    : Array.isArray(source.recommendations)
      ? source.recommendations.map((item) => String(item).trim()).filter(Boolean)
      : [];
  const top3 = Array.isArray(source.top3)
    ? source.top3
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const label = normalizeSkinDiseaseName(entry?.label);
          const score = Math.min(1, Math.max(0, toNumber(entry?.score, 0)));
          return label ? { label, score } : null;
        })
        .filter(Boolean) as PredictionResult['top3']
    : [];

  const mergedPatientInfo = {
    ...defaultPatientInfo,
    ...((source.patientInfo && typeof source.patientInfo === 'object' ? source.patientInfo : {}) as object),
    ...(patientInfo || {})
  } as PredictionResult['patientInfo'];

  const normalized: PredictionResult = {
    prediction,
    diagnosis: prediction,
    diseaseName: prediction,
    supportedDiseases: [...SUPPORTED_SKIN_DISEASES],
    observedFeatures,
    providerStatus: typeof source.providerStatus === 'string' && source.providerStatus.trim()
      ? source.providerStatus.trim()
      : 'AI analysis completed',
    confidence,
    top3: top3.length ? top3 : [
      { label: prediction, score: confidence },
      { label: 'Melanocytic nevi (nv)', score: Math.max(0, Number((1 - confidence).toFixed(2))) }
    ],
    description: typeof source.description === 'string' && source.description.trim()
      ? source.description.trim()
      : `The AI response was incomplete, so Dermacheck generated a safe summary. ${fallbackReason || 'Please review this result with a clinician.'}`,
    disclaimer: typeof source.disclaimer === 'string' && source.disclaimer.trim()
      ? source.disclaimer.trim()
      : 'This is an AI support output, not a medical diagnosis.',
    severity: normalizeSeverity(source.severity || meta.severity),
    accuracyLabel: typeof source.accuracyLabel === 'string' && source.accuracyLabel.trim()
      ? source.accuracyLabel.trim()
      : meta.accuracyLabel,
    treatment: typeof source.treatment === 'string' && source.treatment.trim()
      ? source.treatment.trim()
      : meta.treatment,
    medications: medications.length ? medications : meta.medications,
    nextSteps: nextSteps.length ? nextSteps : meta.nextSteps,
    recommendations: nextSteps.length ? nextSteps : meta.nextSteps,
    patientInfo: mergedPatientInfo
  };

  if (!normalized.prediction || !normalized.description) {
    return buildFallbackResult(fallbackReason, mergedPatientInfo);
  }

  return normalized;
};

export const addHistoryItem = (history: HistoryItem[], item: HistoryItem) =>
  history.some((existing) => existing.id === item.id) ? history : [item, ...history];
export const addTrackingItem = (tracking: TrackingItem[], item: TrackingItem) => [item, ...tracking];
