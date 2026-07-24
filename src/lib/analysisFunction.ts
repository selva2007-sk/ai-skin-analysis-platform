import { Capacitor } from '@capacitor/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { PredictionResult } from '../app/types';

type PatientInfo = PredictionResult['patientInfo'];

type AnalyzeLesionRequest = {
  image: string;
  patientInfo?: PatientInfo;
};

type AnalyzeLesionResponse = Record<string, unknown>;

const analyzeLesionCallable = httpsCallable<AnalyzeLesionRequest, AnalyzeLesionResponse>(
  functions,
  'analyzeLesion'
);

async function analyzeLesionWithServer(image: string, patientInfo?: PatientInfo) {
  const base = String((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const url = `${base}/api/analyze`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, patientInfo: patientInfo || undefined }),
      signal: controller.signal
    });

    const payloadText = await response.text();
    const payload = payloadText ? JSON.parse(payloadText) : null;

    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && 'message' in payload && typeof (payload as any).message === 'string')
          ? String((payload as any).message)
          : `Server analysis failed with status ${response.status}.`;
      throw new Error(message);
    }

    return payload as AnalyzeLesionResponse;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function analyzeLesionWithFirebase(image: string, patientInfo?: PatientInfo) {
  const response = await analyzeLesionCallable({
    image,
    patientInfo: patientInfo || undefined
  });

  return response.data;
}

// Native mobile devices often cannot reach a local /api server directly,
// so prefer Firebase there. Web can still try the local/server route first.
export async function analyzeLesion(image: string, patientInfo?: PatientInfo) {
  if (Capacitor.isNativePlatform()) {
    try {
      return await analyzeLesionWithFirebase(image, patientInfo);
    } catch {
      return await analyzeLesionWithServer(image, patientInfo);
    }
  }

  try {
    return await analyzeLesionWithServer(image, patientInfo);
  } catch {
    return await analyzeLesionWithFirebase(image, patientInfo);
  }
}
