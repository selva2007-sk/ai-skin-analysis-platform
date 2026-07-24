import { Capacitor } from '@capacitor/core';

function normalizeApiBase(rawBase: string) {
  const trimmed = rawBase.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function joinApiUrl(apiBase: string, pathname: string) {
  return apiBase ? `${apiBase}${pathname}` : pathname;
}

export function getApiBaseCandidates(preferredBase = '') {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const isDevBuild = Boolean(import.meta.env?.DEV);
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
  addCandidate(isNative ? import.meta.env.VITE_API_URL_MOBILE : '');
  addCandidate(import.meta.env.VITE_API_URL);
  addCandidate((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL);

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

export async function readJsonSafely(response: Response) {
  const responseText = await response.text();
  const trimmed = responseText.trim();
  const contentType = response.headers.get('content-type') || '';
  const isHtml =
    /text\/html/i.test(contentType) ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    (trimmed.startsWith('<') && !trimmed.startsWith('{') && !trimmed.startsWith('['));

  if (!responseText) {
    return { data: null, text: responseText, isHtml: false };
  }

  try {
    return { data: JSON.parse(responseText), text: responseText, isHtml };
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return { data: JSON.parse(jsonMatch[0]), text: responseText, isHtml };
      } catch {
        // Fall through and return null.
      }
    }

    return { data: null, text: responseText, isHtml };
  }
}

function buildApiUnavailableMessage(featureLabel: string) {
  return Capacitor.isNativePlatform()
    ? `Unable to reach the ${featureLabel}. Set VITE_API_URL_MOBILE to your deployed server URL and try again.`
    : `Unable to reach the ${featureLabel}. Start the local server or set VITE_API_URL and try again.`;
}

type FetchApiJsonOptions = {
  preferredBase?: string;
  featureLabel?: string;
};

export async function fetchApiJson<T>(
  pathname: string,
  init: RequestInit,
  options: FetchApiJsonOptions = {}
) {
  const { preferredBase = '', featureLabel = 'server' } = options;
  const candidates = getApiBaseCandidates(preferredBase);
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const url = joinApiUrl(candidate, pathname);

    try {
      const response = await fetch(url, init);
      const parsed = await readJsonSafely(response);

      if (parsed.isHtml) {
        lastError = new Error(buildApiUnavailableMessage(featureLabel));
        continue;
      }

      return {
        base: candidate,
        response,
        data: parsed.data as T | null,
        text: parsed.text
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(buildApiUnavailableMessage(featureLabel));
    }
  }

  throw lastError || new Error(buildApiUnavailableMessage(featureLabel));
}
