export type Role = 'patient' | 'doctor';
export type PaymentMethod = 'UPI' | 'Card' | 'Cash';

export type PatientProfile = {
  uid?: string;
  email: string;
  role: 'patient';
  fullName: string;
  age: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  emergencyContact: string;
  allergies: string;
  address: string;
  updatedAt?: string;
};

export type Slot = {
  time: string;
  available: boolean;
};

export type DoctorAvailability = {
  date: string;
  available: boolean;
  slots: Slot[];
};

export type DoctorProfile = {
  uid?: string;
  email: string;
  role: 'doctor';
  fullName: string;
  specialization: string;
  hospital: string;
  phone: string;
  consultationFee: number;
  licenseNumber: string;
  experienceYears: string;
  consultationMode: string;
  availableDates: DoctorAvailability[];
  updatedAt?: string;
};

export type UserProfile = PatientProfile | DoctorProfile;

export type AppUser = {
  email: string;
  role: Role;
  uid?: string;
};

export type PredictionResult = {
  prediction: string;
  diagnosis?: string;
  diseaseName?: string;
  supportedDiseases?: string[];
  observedFeatures?: string[];
  providerStatus?: string;
  confidence: number;
  top3: { label: string; score: number }[];
  description: string;
  disclaimer: string;
  severity: 'Low' | 'Medium' | 'High';
  accuracyLabel: string;
  treatment: string;
  medications: string[];
  nextSteps: string[];
  recommendations?: string[];
  patientInfo?: {
    name: string;
    age: string;
    gender: string;
    bloodGroup: string;
  };
};

export type ScanHistoryItem = PredictionResult & {
  id: string;
  timestamp: number;
  image: string;
  uid?: string;
  kind?: 'scan';
};

export type AppointmentHistoryStatus = 'Requested' | 'Approved' | 'Confirmed' | 'Cancelled';

export type AppointmentHistoryItem = {
  id: string;
  kind: 'appointment';
  uid: string;
  timestamp: number;
  bookingId: string;
  doctorUid: string;
  doctorName: string;
  doctorEmail: string;
  date: string;
  time: string;
  status: AppointmentHistoryStatus;
  paymentStatus: 'Unpaid' | 'Paid';
  amount: number;
  note: string;
};

export type HistoryItem = ScanHistoryItem | AppointmentHistoryItem;

export type TrackingItem = {
  id: string;
  createdAt: number;
  title: string;
  description: string;
  frequency: string;
  status: 'Active' | 'Completed';
  linkedPrediction: string;
};

export type BookingItem = {
  id: string;
  patientUid: string;
  doctorUid: string;
  patientEmail: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientBloodGroup: string;
  patientPhone: string;
  patientEmergencyContact: string;
  patientAllergies: string;
  patientAddress: string;
  doctorEmail: string;
  doctorName: string;
  doctorSpecialization: string;
  hospital: string;
  date: string;
  time: string;
  status: 'Pending' | 'Approved' | 'Confirmed';
  paymentMethod: PaymentMethod;
  paymentStatus: 'Unpaid' | 'Paid';
  amount: number;
  prediction: string;
  severity: string;
  confidence: number;
  caseDescription: string;
  treatment: string;
  medications: string[];
  nextSteps: string[];
  createdAt: number;
};

export type ActiveTab =
  | 'home'
  | 'upload'
  | 'result'
  | 'bookings'
  | 'history'
  | 'profile'
  | 'tracking';
