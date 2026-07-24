import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import Busboy from "@fastify/busboy";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS || 25000);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_SKIN_DISEASES = [
  "Melanoma (mel)",
  "Basal cell carcinoma (bcc)",
  "Actinic keratoses (akiec)",
  "Melanocytic nevi (nv)",
  "Benign keratosis (bkl)",
  "Dermatofibroma (df)",
  "Vascular lesions (vasc)"
] as const;
const diseaseAliasMap: Record<string, (typeof SUPPORTED_SKIN_DISEASES)[number]> = {
  mel: "Melanoma (mel)",
  melanoma: "Melanoma (mel)",
  "melanoma (mel)": "Melanoma (mel)",
  bcc: "Basal cell carcinoma (bcc)",
  "basal cell carcinoma": "Basal cell carcinoma (bcc)",
  "basal cell carcinoma (bcc)": "Basal cell carcinoma (bcc)",
  akiec: "Actinic keratoses (akiec)",
  "actinic keratoses": "Actinic keratoses (akiec)",
  "actinic keratoses (akiec)": "Actinic keratoses (akiec)",
  nv: "Melanocytic nevi (nv)",
  "melanocytic nevi": "Melanocytic nevi (nv)",
  "melanocytic nevi (nv)": "Melanocytic nevi (nv)",
  bkl: "Benign keratosis (bkl)",
  "benign keratosis": "Benign keratosis (bkl)",
  "benign keratosis (bkl)": "Benign keratosis (bkl)",
  df: "Dermatofibroma (df)",
  dermatofibroma: "Dermatofibroma (df)",
  "dermatofibroma (df)": "Dermatofibroma (df)",
  vasc: "Vascular lesions (vasc)",
  "vascular lesions": "Vascular lesions (vasc)",
  "vascular lesions (vasc)": "Vascular lesions (vasc)"
};

function normalizeOriginValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^my_app_url$/i.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

const ALLOWED_ORIGINS = Array.from(
  new Set(
    [
      ...(process.env.ALLOWED_ORIGINS || "").split(","),
      process.env.APP_URL || "",
      "http://localhost",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "capacitor://localhost",
      "ionic://localhost"
    ]
      .map(normalizeOriginValue)
      .filter(Boolean) as string[]
  )
);

type PatientInfo = {
  name?: string;
  age?: string;
  gender?: string;
  bloodGroup?: string;
};

type AnalysisPayload = {
  image?: string;
  patientInfo?: PatientInfo;
};

function normalizeSkinDiseaseName(value: unknown) {
  const str = String(value || "").trim();
  if (!str) return null;
  const normalized = str.toLowerCase();
  if (diseaseAliasMap[normalized]) return diseaseAliasMap[normalized];

  const normalizedToken = str
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (diseaseAliasMap[normalizedToken]) return diseaseAliasMap[normalizedToken];

  return (
    SUPPORTED_SKIN_DISEASES.find((disease) => {
      const diseaseName = disease.toLowerCase();
      const diseaseToken = diseaseName
        .replace(/\([^)]*\)/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
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
  const prediction = "Melanocytic nevi (nv)";
  const recommendations = ["Continue monthly self-check", "Capture baseline photo today", "Consult if mole changes shape or color"];

  return {
    diagnosis: prediction,
    diseaseName: prediction,
    supportedDiseases: [...SUPPORTED_SKIN_DISEASES],
    observedFeatures: ["Fallback result used because the live AI provider was unavailable"],
    prediction,
    confidence: 0.88,
    top3: [
      { label: prediction, score: 0.88 },
      { label: "Basal cell carcinoma (bcc)", score: 0.04 },
      { label: "Benign keratosis (bkl)", score: 0.08 }
    ],
    description: `Dermacheck generated a safe fallback summary because the live AI response was unavailable. ${reason || "Unable to analyze image now, please try again."}`,
    disclaimer: "This is an AI support output, not a medical diagnosis.",
    treatment: "Usually observational, but monitor for ABCDE changes.",
    medications: ["Daily sunscreen", "Gentle skin moisturizer"],
    nextSteps: recommendations,
    recommendations,
    severity: "Low",
    accuracyLabel: "Moderate confidence AI estimate",
    patientInfo: {
      name: patientInfo.name || "Patient",
      age: patientInfo.age || "Not provided",
      gender: patientInfo.gender || "Not provided",
      bloodGroup: patientInfo.bloodGroup || "Not provided"
    },
    providerStatus: reason ? `Fallback used: ${reason}` : "Fallback used: provider unavailable"
  };
}

function normalizeSeverity(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium" || normalized === "moderate") return "Medium";
  return "Low";
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseDataUrlImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data format.");
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

function normalizeResult(raw: unknown, patientInfo: PatientInfo, reason?: string) {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fallback = buildServerFallbackResult(reason, patientInfo);
  const entries = Object.entries(source);

  // Robust property extraction (case-insensitive for AI response keys)
  const getProp = (keys: string[]) => {
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      let val = source[key];
      if (val === undefined) {
        val = entries.find(([k]) => k.toLowerCase() === lowerKey)?.[1];
      }
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const nested = (val as Record<string, any>).label || 
                       (val as Record<string, any>).name || 
                       (val as Record<string, any>).value ||
                       (val as Record<string, any>).prediction;
        if (typeof nested === "string" && nested.trim()) return nested.trim();
      }
    }
    for (const [k, v] of entries) {
      if (["label", "class", "prediction", "diagnosis", "disease"].some(lk => k.toLowerCase().includes(lk))) {
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
    return "";
  };

  const rawLabel = getProp(["diseaseName", "prediction", "diagnosis", "label", "result", "diagnosis_name", "class_name"]);
  const normalizedDiseaseName = normalizeSkinDiseaseName(rawLabel);
  // Fallback to the raw label from AI if normalization fails, instead of a generic result
  const prediction = normalizedDiseaseName || rawLabel || fallback.prediction;

  const confidence = Math.min(1, Math.max(0, toNumber(source.confidence, fallback.confidence)));
  const top3 = Array.isArray(source.top3)
    ? source.top3
        .map((item) => {
          const entry = item as Record<string, unknown>;
          const label = normalizeSkinDiseaseName(entry?.label);
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
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : fallback.description,
    disclaimer:
      typeof source.disclaimer === "string" && source.disclaimer.trim()
        ? source.disclaimer.trim()
        : fallback.disclaimer,
    treatment:
      typeof source.treatment === "string" && source.treatment.trim()
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
      typeof source.accuracyLabel === "string" && source.accuracyLabel.trim()
        ? source.accuracyLabel.trim()
        : fallback.accuracyLabel,
    patientInfo: {
      name: typeof (source.patientInfo as PatientInfo | undefined)?.name === "string" ? (source.patientInfo as PatientInfo).name : fallback.patientInfo.name,
      age: typeof (source.patientInfo as PatientInfo | undefined)?.age === "string" ? (source.patientInfo as PatientInfo).age : fallback.patientInfo.age,
      gender: typeof (source.patientInfo as PatientInfo | undefined)?.gender === "string" ? (source.patientInfo as PatientInfo).gender : fallback.patientInfo.gender,
      bloodGroup: typeof (source.patientInfo as PatientInfo | undefined)?.bloodGroup === "string" ? (source.patientInfo as PatientInfo).bloodGroup : fallback.patientInfo.bloodGroup
    },
    providerStatus:
      typeof source.providerStatus === "string" && source.providerStatus.trim()
        ? source.providerStatus.trim()
        : fallback.providerStatus
  };
}

function getServerUrls(port: number) {
  const interfaces = os.networkInterfaces();
  const networkAddresses = Array.from(
    new Set(
      Object.values(interfaces)
        .flat()
        .filter((details): details is NonNullable<typeof details> => Boolean(details))
        .filter((details) => details.family === "IPv4" && !details.internal)
        .map((details) => details.address)
    )
  );

  return {
    localhost: `http://localhost:${port}`,
    local: `http://127.0.0.1:${port}`,
    network: networkAddresses.map((address) => `http://${address}:${port}`)
  };
}

async function readMultipartRequest(req: express.Request): Promise<AnalysisPayload> {
  return await new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      resolve({});
      return;
    }

    const busboy = new Busboy({
      headers: {
        ...req.headers,
        "content-type": String(req.headers["content-type"] || "")
      },
      limits: {
        files: 1,
        fileSize: MAX_IMAGE_BYTES,
        fields: 8
      }
    });

    let image: string | undefined;
    let patientInfo: PatientInfo | undefined;
    let fileHandled = false;

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      if (fieldname !== "image") {
        file.resume();
        return;
      }

      fileHandled = true;
      const chunks: Buffer[] = [];

      file.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      file.on("limit", () => {
        reject(new Error("Uploaded image is too large."));
      });

      file.on("end", () => {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) {
          reject(new Error("Uploaded image is empty."));
          return;
        }
        image = `data:${mimetype || "image/jpeg"};base64,${buffer.toString("base64")}`;
        console.log("[analyze] multipart file parsed", {
          filename,
          mimetype,
          bytes: buffer.length,
          encoding
        });
      });
    });

    busboy.on("field", (fieldname, value) => {
      if (fieldname === "patientInfo") {
        try {
          patientInfo = JSON.parse(value);
        } catch {
          patientInfo = {};
        }
      }
    });

    busboy.on("finish", () => {
      if (!fileHandled) {
        reject(new Error("Lesion image file is required."));
        return;
      }
      resolve({ image, patientInfo });
    });

    busboy.on("error", (error) => reject(error));
    req.pipe(busboy);
  });
}

async function readAnalysisPayload(req: express.Request): Promise<AnalysisPayload> {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return await readMultipartRequest(req);
  }

  const body = (req.body || {}) as AnalysisPayload;
  return {
    image: body.image,
    patientInfo: body.patientInfo || {}
  };
}

async function requestModelAnalysis(image: string, patientInfo: PatientInfo) {
  if (!GEMINI_API_KEY) {
    return buildServerFallbackResult("Missing GEMINI_API_KEY.", patientInfo);
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
- age: ${patientInfo.age || "unknown"}
- gender: ${patientInfo.gender || "unknown"}
- bloodGroup: ${patientInfo.bloodGroup || "unknown"}
- name: ${patientInfo.name || "unknown"}

First decide whether the image is actually a close-up skin lesion photo with enough detail to analyze.
Compare the lesion against the supported classes using visible morphology such as asymmetry, border, color variation, texture, scale, crusting, ulceration, and vascular pattern.
Keep confidence conservative. If the image is blurry, zoomed out, shadowed, overexposed, or not clearly a skin lesion, confidence must stay low.
Only analyze skin disease visible in the image. Choose diseaseName, prediction, and every top3 label only from this supported list:
${SUPPORTED_SKIN_DISEASES.join(", ")}.
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
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
          responseMimeType: "application/json",
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
    ?.map((part: Record<string, unknown>) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  if (!rawContent) {
    throw new Error("Gemini returned an empty response content.");
  }

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : rawContent;
  return normalizeResult(JSON.parse(jsonString), patientInfo, "AI returned incomplete analysis.");
}

// Initialize Firebase Admin (Requires FIREBASE_SERVICE_ACCOUNT in env)
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

async function sendPushToUser(
  uid: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT.");
  }

  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  const rawTokens = userDoc.data()?.fcmTokens;
  const legacyToken = userDoc.data()?.fcmToken;
  const tokens = Array.from(
    new Set(
      [
        ...(Array.isArray(rawTokens) ? rawTokens : []),
        legacyToken
      ].filter((token): token is string => typeof token === "string" && token.trim().length > 0)
    )
  );

  if (!tokens.length) {
    return { delivered: 0, removed: 0 };
  }

  const responses = await Promise.all(
    tokens.map(async (token) => {
      try {
        await admin.messaging().send({
          token,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: payload.data,
          webpush: {
            notification: {
              title: payload.title,
              body: payload.body,
              requireInteraction: true
            },
            fcmOptions: {
              link: payload.data?.clickAction || "http://localhost:3000"
            }
          },
          android: {
            priority: "high",
            notification: {
              channelId: "calls",
              sound: "default"
            }
          },
          apns: {
            headers: {
              "apns-priority": "10"
            },
            payload: {
              aps: {
                sound: "default",
                contentAvailable: true
              }
            }
          }
        });
        return { success: true, token };
      } catch (error: any) {
        return { success: false, token, error };
      }
    })
  );

  const invalidTokens = responses
    .filter(({ success, error }) =>
      !success && (
        error?.code === "messaging/registration-token-not-registered" ||
        error?.code === "messaging/invalid-registration-token"
      )
    )
    .map(({ token }) => token);

  if (invalidTokens.length) {
    const validTokens = tokens.filter((token) => !invalidTokens.includes(token));
    await admin.firestore().collection("users").doc(uid).set({
      fcmToken: validTokens[0] || null,
      fcmTokens: validTokens,
      fcmTokenUpdatedAt: Date.now()
    }, { merge: true });
  }

  return {
    delivered: responses.filter(({ success }) => success).length,
    removed: invalidTokens.length
  };
}

async function verifyFirebaseRequest(req: express.Request) {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT.");
  }

  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    throw new Error("Missing Firebase auth token.");
  }

  return await admin.auth().verifyIdToken(token);
}

function isBookingCallable(data: Record<string, any>) {
  return true;
}

async function getAuthorizedBooking(req: express.Request, bookingId: string) {
  const decoded = await verifyFirebaseRequest(req);
  const bookingSnap = await admin.firestore().collection("bookings").doc(bookingId).get();

  if (!bookingSnap.exists) {
    throw new Error("Booking not found.");
  }

  const booking = bookingSnap.data() as Record<string, any>;
  const isParticipant = decoded.uid === booking.patientUid || decoded.uid === booking.doctorUid;
  if (!isParticipant) {
    throw new Error("You are not allowed to access this booking.");
  }

  if (!isBookingCallable(booking)) {
    throw new Error("Voice calling is disabled for this booking.");
  }

  return { decoded, booking };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  const distPath = path.join(process.cwd(), "dist");
  const buildPath = path.join(process.cwd(), "build");
  const staticPath = fs.existsSync(distPath) ? distPath : buildPath;

  app.get("/api/health", (req: express.Request, res: express.Response) => {
    res.json({ ok: true, timestamp: Date.now(), version: "1.0.0" });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use((req, res, next) => {
    const requestOrigin = String(req.headers.origin || "");
    const allowAllOrigins = ALLOWED_ORIGINS.length === 0;
    const matchedOrigin = allowAllOrigins
      ? "*"
      : ALLOWED_ORIGINS.find((origin) => origin === requestOrigin);

    if (matchedOrigin) {
      res.header("Access-Control-Allow-Origin", matchedOrigin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get("/firebase-messaging-sw.js", (req, res) => {
    res.type("application/javascript").send(`
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: ${JSON.stringify(process.env.VITE_FIREBASE_API_KEY || "")},
  authDomain: ${JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || "")},
  projectId: ${JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || "")},
  storageBucket: ${JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || "")},
  messagingSenderId: ${JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "")},
  appId: ${JSON.stringify(process.env.VITE_FIREBASE_APP_ID || "")}
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'Incoming call';
  const body = payload.notification?.body || 'Dermacheck call update';
  const data = payload.data || {};

  self.registration.showNotification(title, {
    body,
    data
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const clickAction = event.notification.data?.clickAction || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(clickAction);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
`);
  });

  app.post("/api/analyze", async (req: express.Request, res: express.Response) => {
    try {
      const { image, patientInfo = {} } = await readAnalysisPayload(req);

      if (!image) {
        return res.status(400).json({
          message: "Unable to analyze image now, please try again.",
          details: "Lesion image is required."
        });
      }

      console.log("[analyze] request received", {
        transport: String(req.headers["content-type"] || "").includes("multipart/form-data") ? "multipart" : "json",
        hasImage: Boolean(image),
        patientInfo
      });

      try {
        const analysis = await requestModelAnalysis(image, patientInfo);
        return res.json(analysis);
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        console.error("Error in /api/analyze:", error);
        return res.json(normalizeResult(null, patientInfo, details));
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      console.error("Failed to parse /api/analyze request:", error);
      return res.status(400).json({
        message: "Unable to analyze image now, please try again.",
        details
      });
    }
  });

  app.post("/api/notify-doctor", async (req: express.Request, res: express.Response) => {
    const { doctorUid, patientName, date, time } = req.body;
    try {
      const result = await sendPushToUser(doctorUid, {
        title: "New Appointment Request",
        body: `${patientName} requested a consultation for ${date} at ${time}.`,
        data: {
          type: "appointment_request",
          clickAction: "/doctor/home"
        }
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Push notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/calls/validate", async (req: express.Request, res: express.Response) => {
    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ allowed: false, error: "bookingId is required." });
    }

    try {
      const { decoded, booking } = await getAuthorizedBooking(req, String(bookingId));
      const targetUid = decoded.uid === booking.patientUid ? booking.doctorUid : booking.patientUid;
      return res.json({
        allowed: true,
        bookingId,
        callerUid: decoded.uid,
        targetUid
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to validate booking.";
      return res.status(403).json({ allowed: false, error: message });
    }
  });

  app.post("/api/calls/notify", async (req: express.Request, res: express.Response) => {
    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: "bookingId is required." });
    }

    try {
      const { decoded, booking } = await getAuthorizedBooking(req, String(bookingId));
      const callerIsPatient = decoded.uid === booking.patientUid;
      const targetUid = callerIsPatient ? booking.doctorUid : booking.patientUid;
      const callerName = callerIsPatient ? booking.patientName : booking.doctorName;
      const targetPath = callerIsPatient ? "/doctor/home" : "/patient/appointments";

      const result = await sendPushToUser(targetUid, {
        title: "Incoming Voice Call",
        body: `${callerName} is calling you from Dermacheck.`,
        data: {
          type: "incoming_call",
          bookingId: String(bookingId),
          callerUid: decoded.uid,
          clickAction: targetPath
        }
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to notify participant.";
      console.error("[Calls] notify failed:", error);
      return res.status(500).json({ success: false, error: message });
    }
  });

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    const urls = getServerUrls(PORT);
    console.log("");
    console.log("Dermacheck server is running");
    console.log(`Local:      ${urls.local}`);
    console.log(`Localhost:  ${urls.localhost}`);
    urls.network.forEach((url, index) => {
      console.log(`Network ${index + 1}: ${url}`);
    });
    console.log("");
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
