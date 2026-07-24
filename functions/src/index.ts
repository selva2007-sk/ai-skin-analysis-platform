import dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = process.env.FUNCTIONS_REGION || 'us-central1';
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || '').trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS || 25000);
const SUPPORTED_SKIN_DISEASES = [
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

type PatientInfo = {
  name?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
};

type AnalyzeLesionRequest = {
  image?: string;
  patientInfo?: PatientInfo;
};

function normalizeSkinDiseaseName(value: unknown) {
  const str = String(value || '').trim();
  if (!str) return null;
  const normalized = str.toLowerCase();
  if (diseaseAliasMap[normalized]) return diseaseAliasMap[normalized];

  const normalizedToken = str
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (diseaseAliasMap[normalizedToken]) return diseaseAliasMap[normalizedToken];

  return (
    SUPPORTED_SKIN_DISEASES.find((disease) => {
      const diseaseName = disease.toLowerCase();
      const diseaseToken = diseaseName
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
}

function buildServerFallbackResult(reason?: string, patientInfo: PatientInfo = {}) {
  const prediction = 'Melanocytic nevi (nv)';
  const recommendations = [
    'Continue monthly self-check',
    'Capture baseline photo today',
    'Consult if mole changes shape or color'
  ];

  return {
    diagnosis: prediction,
    diseaseName: prediction,
    supportedDiseases: [...SUPPORTED_SKIN_DISEASES],
    observedFeatures: ['Fallback result used because the live AI provider was unavailable'],
    prediction,
    confidence: 0.88,
    top3: [
      { label: prediction, score: 0.88 },
      { label: 'Basal cell carcinoma (bcc)', score: 0.04 },
      { label: 'Benign keratosis (bkl)', score: 0.08 }
    ],
    description: `Dermacheck generated a safe fallback summary because the live AI response was unavailable. ${reason || 'Unable to analyze image now, please try again.'}`,
    disclaimer: 'This is an AI support output, not a medical diagnosis.',
    treatment: 'Usually observational, but monitor for ABCDE changes.',
    medications: ['Daily sunscreen', 'Gentle skin moisturizer'],
    nextSteps: recommendations,
    recommendations,
    severity: 'Low',
    accuracyLabel: 'Moderate confidence AI estimate',
    patientInfo: {
      name: patientInfo.name || 'Patient',
      age: patientInfo.age || 'Not provided',
      gender: patientInfo.gender || 'Not provided',
      bloodGroup: patientInfo.bloodGroup || 'Not provided'
    },
    providerStatus: reason ? `Fallback used: ${reason}` : 'Fallback used: provider unavailable'
  };
}

function normalizeSeverity(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'high') return 'High';
  if (normalized === 'medium' || normalized === 'moderate') return 'Medium';
  return 'Low';
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseDataUrlImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image data format.');
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

function normalizeResult(raw: unknown, patientInfo: PatientInfo, reason?: string) {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallback = buildServerFallbackResult(reason, patientInfo);
  const entries = Object.entries(source);

  const getProp = (keys: string[]) => {
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      let val = source[key];
      if (val === undefined) {
        val = entries.find(([k]) => k.toLowerCase() === lowerKey)?.[1];
      }
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nested = (val as Record<string, unknown>).label ||
          (val as Record<string, unknown>).name ||
          (val as Record<string, unknown>).value ||
          (val as Record<string, unknown>).prediction;
        if (typeof nested === 'string' && nested.trim()) return nested.trim();
      }
    }

    for (const [k, v] of entries) {
      if (['label', 'class', 'prediction', 'diagnosis', 'disease'].some((lk) => k.toLowerCase().includes(lk))) {
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }

    return '';
  };

  const rawLabel = getProp(['diseaseName', 'prediction', 'diagnosis', 'label', 'result', 'diagnosis_name', 'class_name']);
  const normalizedDiseaseName = normalizeSkinDiseaseName(rawLabel);
  const prediction = normalizedDiseaseName || rawLabel || fallback.prediction;
  const confidence = Math.min(1, Math.max(0, toNumber(source.confidence, fallback.confidence)));
  const top3 = Array.isArray(source.top3)
    ? source.top3
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const rawTopLabel =
            typeof entry?.label === 'string' ? entry.label :
            typeof entry?.prediction === 'string' ? entry.prediction :
            typeof entry?.diseaseName === 'string' ? entry.diseaseName :
            '';
          const label = normalizeSkinDiseaseName(rawTopLabel) || rawTopLabel || null;
          const score = Math.min(1, Math.max(0, toNumber(entry?.score, 0)));
          return label ? { label, score } : null;
        })
        .filter(Boolean)
    : fallback.top3;

  return {
    diagnosis: prediction,
    diseaseName: prediction,
    supportedDiseases: [...SUPPORTED_SKIN_DISEASES],
    observedFeatures: Array.isArray(source.observedFeatures) && source.observedFeatures.length
      ? source.observedFeatures.map((item) => String(item).trim()).filter(Boolean)
      : fallback.observedFeatures,
    prediction,
    confidence,
    top3: top3.length ? top3 : fallback.top3,
    description:
      typeof source.description === 'string' && source.description.trim()
        ? source.description.trim()
        : fallback.description,
    disclaimer:
      typeof source.disclaimer === 'string' && source.disclaimer.trim()
        ? source.disclaimer.trim()
        : fallback.disclaimer,
    treatment:
      typeof source.treatment === 'string' && source.treatment.trim()
        ? source.treatment.trim()
        : fallback.treatment,
    medications: Array.isArray(source.medications) && source.medications.length
      ? source.medications.map((item) => String(item).trim()).filter(Boolean)
      : fallback.medications,
    nextSteps: Array.isArray(source.nextSteps) && source.nextSteps.length
      ? source.nextSteps.map((item) => String(item).trim()).filter(Boolean)
      : Array.isArray(source.recommendations) && source.recommendations.length
        ? source.recommendations.map((item) => String(item).trim()).filter(Boolean)
        : fallback.nextSteps,
    recommendations: Array.isArray(source.recommendations) && source.recommendations.length
      ? source.recommendations.map((item) => String(item).trim()).filter(Boolean)
      : Array.isArray(source.nextSteps) && source.nextSteps.length
        ? source.nextSteps.map((item) => String(item).trim()).filter(Boolean)
        : fallback.recommendations,
    severity: normalizeSeverity(source.severity || fallback.severity),
    accuracyLabel:
      typeof source.accuracyLabel === 'string' && source.accuracyLabel.trim()
        ? source.accuracyLabel.trim()
        : fallback.accuracyLabel,
    patientInfo: {
      name: typeof (source.patientInfo as PatientInfo | undefined)?.name === 'string' ? (source.patientInfo as PatientInfo).name : fallback.patientInfo.name,
      age: typeof (source.patientInfo as PatientInfo | undefined)?.age === 'string' ? (source.patientInfo as PatientInfo).age : fallback.patientInfo.age,
      gender: typeof (source.patientInfo as PatientInfo | undefined)?.gender === 'string' ? (source.patientInfo as PatientInfo).gender : fallback.patientInfo.gender,
      bloodGroup: typeof (source.patientInfo as PatientInfo | undefined)?.bloodGroup === 'string' ? (source.patientInfo as PatientInfo).bloodGroup : fallback.patientInfo.bloodGroup
    },
    providerStatus:
      typeof source.providerStatus === 'string' && source.providerStatus.trim()
        ? source.providerStatus.trim()
        : fallback.providerStatus
  };
}

async function requestModelAnalysis(image: string, patientInfo: PatientInfo) {
  if (!GEMINI_API_KEY) {
    return buildServerFallbackResult('Missing GEMINI_API_KEY.', patientInfo);
  }

  const { mimeType, data } = parseDataUrlImage(image);
  const analysisPrompt = `Analyze this skin lesion image for a patient.
Return only a valid JSON object with these fields:
diseaseName (string),
supportedDiseases (array of strings),
observedFeatures (array of short strings),
prediction (string),
confidence (number 0-1),
top3 (array of {label, score}),
description (string),
treatment (string),
medications (array of strings),
nextSteps (array of strings),
severity (High/Medium/Low),
accuracyLabel (string),
disclaimer (string),
patientInfo (object with optional name, age, gender, bloodGroup),
providerStatus (string).

Patient context:
- age: ${patientInfo.age || 'unknown'}
- gender: ${patientInfo.gender || 'unknown'}
- bloodGroup: ${patientInfo.bloodGroup || 'unknown'}
- name: ${patientInfo.name || 'unknown'}

First decide whether the image is actually a close-up skin lesion photo with enough detail to analyze.
Compare the lesion against the supported classes using visible morphology such as asymmetry, border, color variation, texture, scale, crusting, ulceration, and vascular pattern.
Keep confidence conservative. If the image is blurry, zoomed out, shadowed, overexposed, or not clearly a skin lesion, confidence must stay low.
Only analyze skin disease visible in the image. Choose diseaseName, prediction, and every top3 label only from this supported list:
${SUPPORTED_SKIN_DISEASES.join(', ')}.
If the image is not a skin lesion, is unrelated to skin disease, or is too unclear, use "Melanocytic nevi (nv)" with low confidence and explain that clinical review is needed.
Always include the full supportedDiseases array exactly as listed above.
Make top3 scores realistic, sorted highest to lowest, and roughly summing to 1.
providerStatus should mention the model/provider used for this analysis.
Always return a disease name from the supported list. Never return null or markdown.`;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Analysis timed out after ${ANALYSIS_TIMEOUT_MS}ms.`)), ANALYSIS_TIMEOUT_MS);
  });

  const requestPromise = fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: analysisPrompt },
              {
                inlineData: {
                  mimeType,
                  data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    }
  ).then(async (response) => {
    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : null;
    if (!response.ok) {
      const message =
        (payload as { error?: { message?: string } } | null)?.error?.message ||
        `Gemini API request failed with status ${response.status}.`;
      throw new Error(message);
    }
    return payload;
  });

  const geminiResponse: any = await Promise.race([requestPromise, timeoutPromise]);
  const rawContent = geminiResponse?.candidates?.[0]?.content?.parts
    ?.map((part: Record<string, unknown>) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  if (!rawContent) {
    throw new Error('Gemini returned an empty response content.');
  }

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : rawContent;
  return normalizeResult(JSON.parse(jsonString), patientInfo, 'AI returned incomplete analysis.');
}

export const analyzeLesion = onCall({ region: REGION, cors: true }, async (request) => {
  const payload = (request.data || {}) as AnalyzeLesionRequest;
  const image = String(payload.image || '').trim();
  const patientInfo = payload.patientInfo || {};

  if (!image || !image.startsWith('data:image/')) {
    throw new HttpsError('invalid-argument', 'A valid lesion image is required.');
  }

  if (image.length > 4_500_000) {
    throw new HttpsError('invalid-argument', 'The compressed image is too large for function transport.');
  }

  try {
    return await requestModelAnalysis(image, patientInfo);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildServerFallbackResult(reason, patientInfo);
  }
});
