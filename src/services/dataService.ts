/**
 * CareBridge Data Service
 * Unified service layer for Firestore + Demo / Presentation Store
 *
 * Implements full cross-role synchrony:
 * Patient creates case -> sends request -> Provider sees incoming request ->
 * Provider accepts/rejects -> Patient sees status change in real time ->
 * Ambulance trip progression -> Notifications created at every step.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  updateDoc,
  deleteField,
  onSnapshot,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  type Unsubscribe
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import type {
  EmergencyCase,
  ResourceRequest,
  ResourceType,
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile,
  AmbulanceTrip,
  NotificationItem,
  UserProfile,
  UserRole,
  ClinicalNote,
  AmbulanceTripStatus,
  PatientLink,
  CaseStatus,
  EmergencyServiceStatus,
  ResourceAssignmentAudit,
  EmergencyLifecycleEvent,
  EmergencyLifecycleStatus,
  ProviderUpdateRequest
} from '../types';

export interface ResourceRequestDraft {
  resourceType: ResourceRequest['resourceType'];
  providerRole: UserRole;
  details: ResourceRequest['details'];
}

interface ProviderDirectoryEntry {
  uid: string;
  role: UserRole;
  displayName: string;
  city: string;
  state?: string;
  hospitalAffiliation?: string;
  isVerified: boolean;
  isActive: boolean;
}

export interface EligibleResourceProvider extends ProviderDirectoryEntry {
  state?: string;
}

export interface PatientAttendantLink {
  attendantUid: string;
  activeConsent: boolean;
  updatedAt: string;
}

const firestoreDateToIso = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') {
    if (!Number.isNaN(Date.parse(value))) return value;
    return new Date().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    try {
      const date = (value as any).toDate() as Date;
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    } catch (e) {}
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
};

const normalizeLifecycleHistory = (
  value: unknown
): Record<string, EmergencyLifecycleEvent> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  try {
    return Object.fromEntries(
      Object.entries(value).map(([eventId, event]) => {
        if (!event || typeof event !== 'object') {
          return [eventId, {
            eventId,
            timestamp: new Date().toISOString()
          } as EmergencyLifecycleEvent];
        }
        const item = event as Record<string, unknown>;
        return [eventId, {
          ...item,
          eventId: typeof item.eventId === 'string' ? item.eventId : eventId,
          timestamp: firestoreDateToIso(item.timestamp)
        } as EmergencyLifecycleEvent];
      })
    );
  } catch (e) {
    return undefined;
  }
};

const normalizeEmergencyCase = (data: Record<string, unknown>, caseId: string): EmergencyCase => ({
  ...data,
  caseId: typeof data.caseId === 'string' ? data.caseId : caseId,
  createdAt: firestoreDateToIso(data.createdAt),
  updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : undefined,
  lifecycleHistory: normalizeLifecycleHistory(data.lifecycleHistory)
} as EmergencyCase);

const normalizeResourceRequest = (data: Record<string, unknown>, requestId: string): ResourceRequest => ({
  ...data,
  requestId: typeof data.requestId === 'string' ? data.requestId : requestId,
  createdAt: firestoreDateToIso(data.createdAt),
  updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : '',
  assignedAt: data.assignedAt ? firestoreDateToIso(data.assignedAt) : undefined,
  respondedAt: data.respondedAt ? firestoreDateToIso(data.respondedAt) : undefined,
  statusHistory: normalizeLifecycleHistory(data.statusHistory)
} as ResourceRequest);

const CASE_STATUS_TRANSITIONS: Record<string, EmergencyLifecycleStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  Submitted: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  active: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  'Under Review': ['ASSIGNED', 'REJECTED', 'CANCELLED'],
  ASSIGNED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['RESOURCE_CONFIRMED', 'REJECTED', 'CANCELLED'],
  RESOURCE_CONFIRMED: ['DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  DISPATCHED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED']
};

const notificationDocumentId = (eventId: string, recipientUid: string): string =>
  `${eventId}_${recipientUid}`;

export function getAllowedEmergencyCaseTransitions(status: string): EmergencyLifecycleStatus[] {
  return CASE_STATUS_TRANSITIONS[status] || [];
}

// ==========================================
// SEEDED DEMO DATASET
// ==========================================

export const DEMO_USERS: UserProfile[] = [
  {
    uid: 'attendant-sahana-01',
    email: 'sahana2006@gmail.com',
    displayName: 'Sahana S.',
    role: 'patientAttendant',
    phone: '+91 98451 98765',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'PB Road, Vidyanagar, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'patient-demo-01',
    email: 'patient@carebridge.org',
    displayName: 'Rahul Deshpande',
    role: 'patient',
    phone: '+91 98451 98765',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Plot 42, Vidyanagar Main Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'hosp-demo-01',
    email: 'hospital@carebridge.org',
    displayName: 'KIMS Super Specialty Hospital',
    role: 'hospital',
    phone: '+91 836 222 5555',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Vidyanagar, PB Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'blood-demo-01',
    email: 'bloodbank@carebridge.org',
    displayName: 'Red Cross Regional Blood Centre',
    role: 'bloodBank',
    phone: '+91 836 237 1234',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Club Road, Deshpande Nagar, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'oxy-demo-01',
    email: 'oxygen@carebridge.org',
    displayName: 'OxyLife Medical Gas Distributors',
    role: 'oxygenProvider',
    phone: '+91 836 244 8899',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Gokul Road Industrial Area, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'amb-demo-01',
    email: 'ambulance@carebridge.org',
    displayName: 'SwiftCare Emergency Ambulance Fleet',
    role: 'ambulanceProvider',
    phone: '+91 836 225 1080',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Station Road, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'doctor-demo-01',
    email: 'doctor@carebridge.org',
    displayName: 'Dr. Priya Deshmukh (Cardiology)',
    role: 'doctor',
    phone: '+91 98450 12345',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'KIMS Staff Quarters, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    hospitalAffiliation: 'KIMS Super Specialty Hospital',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'a7zT89vvHCWGgUelne8dVUgFl3k2',
    email: 'admin123@gmail.com',
    displayName: 'CareBridge Administrator',
    role: 'admin',
    phone: '+91 80 4000 8000',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'CareBridge Command Center, Vidyanagar, Hubballi',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  },
  {
    uid: 'admin-demo-01',
    email: 'admin@carebridge.org',
    displayName: 'CareBridge Central Coordinator',
    role: 'admin',
    phone: '+91 80 4000 8000',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'CareBridge Command Center, MG Road',
    isVerified: true,
    isActive: true,
    profileComplete: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z'
  }
];

export const INITIAL_HOSPITAL: HospitalProfile = {
  uid: 'hosp-demo-01',
  hospitalName: 'KIMS Super Specialty Hospital',
  registrationNumber: 'KA-HUB-HOSP-2024-0091',
  departments: ['Emergency Trauma', 'Critical Care / ICU', 'Cardiology', 'Pulmonology', 'Neurology'],
  totalBeds: 250,
  availableBeds: 42,
  totalICU: 30,
  availableICU: 6,
  totalVentilators: 18,
  availableVentilators: 4,
  contactNumber: '+91 836 222 5555',
  operatingHours: '24/7 Round the Clock',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Vidyanagar, PB Road, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_BLOOD_BANK: BloodBankProfile = {
  uid: 'blood-demo-01',
  bankName: 'Red Cross Regional Blood Centre',
  licenseNumber: 'KA-BB-2023-0142',
  inventory: {
    'A+': 18,
    'A-': 5,
    'B+': 24,
    'B-': 3,
    'AB+': 9,
    'AB-': 2,
    'O+': 31,
    'O-': 6
  },
  contactNumber: '+91 836 237 1234',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Club Road, Deshpande Nagar, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_OXYGEN: OxygenProfile = {
  uid: 'oxy-demo-01',
  providerName: 'OxyLife Medical Gas Distributors',
  licenseNumber: 'KA-OXY-2022-0089',
  cylindersAvailable: 35,
  concentratorsAvailable: 12,
  deliveryAvailable: true,
  contactNumber: '+91 836 244 8899',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Gokul Road Industrial Area, Hubballi',
  isVerified: true,
  lastUpdated: new Date().toISOString()
};

export const INITIAL_AMBULANCE: AmbulanceProfile = {
  uid: 'amb-demo-01',
  providerName: 'SwiftCare Emergency Ambulance Fleet',
  licenseNumber: 'KA-AMB-2024-0311',
  contactNumber: '+91 836 225 1080',
  city: 'Hubballi',
  state: 'Karnataka',
  address: 'Station Road, Hubballi',
  isVerified: true,
  vehicles: [
    {
      vehicleId: 'KA-25-EM-1081',
      vehicleType: 'ALS',
      driverName: 'Ramesh Patil',
      driverPhone: '+91 98452 11081',
      isAvailable: false,
      currentStatus: 'on_trip'
    },
    {
      vehicleId: 'KA-25-EM-1082',
      vehicleType: 'BLS',
      driverName: 'Suresh Angadi',
      driverPhone: '+91 98452 11082',
      isAvailable: true,
      currentStatus: 'idle'
    },
    {
      vehicleId: 'KA-25-EM-1083',
      vehicleType: 'Patient Transport',
      driverName: 'Vinod Kulkarni',
      driverPhone: '+91 98452 11083',
      isAvailable: true,
      currentStatus: 'idle'
    }
  ],
  lastUpdated: new Date().toISOString()
};

export const INITIAL_CASES: EmergencyCase[] = [
  {
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    patientAge: 42,
    patientGender: 'Male',
    conditionSummary: 'Acute chest pain radiating to left arm with dyspnea & diaphoresis',
    urgencyLevel: 'immediate',
    resourcesNeeded: ['bed', 'icu', 'blood', 'oxygen', 'ambulance'],
    location: {
      city: 'Hubballi',
      address: 'Plot 42, Vidyanagar Main Road, Hubballi',
      state: 'Karnataka'
    },
    attendant: {
      name: 'Suresh Deshpande',
      relation: 'Brother',
      phone: '+91 98451 98765'
    },
    status: 'active',
    requestCount: 4,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_REQUESTS: ResourceRequest[] = [
  {
    requestId: 'REQ-20261108-0101',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'hosp-demo-01',
    providerName: 'KIMS Super Specialty Hospital',
    resourceType: 'bed',
    details: { bedType: 'ICU Cardiac Bed', notes: 'Immediate admission needed' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2800000).toISOString(),
    createdAt: new Date(Date.now() - 3500000).toISOString(),
    updatedAt: new Date(Date.now() - 2800000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0102',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'blood-demo-01',
    providerName: 'Red Cross Regional Blood Centre',
    resourceType: 'blood',
    details: { bloodGroup: 'B+', units: 2, notes: 'Emergency transfusion standby' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2500000).toISOString(),
    createdAt: new Date(Date.now() - 3400000).toISOString(),
    updatedAt: new Date(Date.now() - 2500000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0103',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'oxy-demo-01',
    providerName: 'OxyLife Medical Gas Distributors',
    resourceType: 'oxygen',
    details: { cylinders: 2, concentrators: 0, notes: 'High flow oxygen mask required' },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2200000).toISOString(),
    createdAt: new Date(Date.now() - 3300000).toISOString(),
    updatedAt: new Date(Date.now() - 2200000).toISOString()
  },
  {
    requestId: 'REQ-20261108-0104',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    requesterUid: 'patient-demo-01',
    patientName: 'Rahul Deshpande',
    providerUid: 'amb-demo-01',
    providerName: 'SwiftCare Emergency Ambulance Fleet',
    resourceType: 'ambulance',
    details: {
      vehicleType: 'ALS Cardiac Ambulance',
      pickupAddress: 'Plot 42, Vidyanagar Main Road, Hubballi',
      destinationAddress: 'KIMS Super Specialty Hospital, PB Road'
    },
    status: 'accepted',
    respondedAt: new Date(Date.now() - 2000000).toISOString(),
    createdAt: new Date(Date.now() - 3200000).toISOString(),
    updatedAt: new Date(Date.now() - 2000000).toISOString()
  }
];

export const INITIAL_TRIPS: AmbulanceTrip[] = [
  {
    tripId: 'TRIP-20261108-0001',
    requestId: 'REQ-20261108-0104',
    caseId: 'CB-20261108-0042',
    patientUid: 'patient-demo-01',
    providerUid: 'amb-demo-01',
    vehicleId: 'KA-25-EM-1081',
    vehicleType: 'ALS Cardiac Ambulance',
    driverName: 'Ramesh Patil',
    driverPhone: '+91 98452 11081',
    pickupLocation: {
      address: 'Plot 42, Vidyanagar Main Road, Hubballi',
      city: 'Hubballi'
    },
    destinationLocation: {
      address: 'KIMS Super Specialty Hospital, PB Road, Hubballi',
      city: 'Hubballi'
    },
    status: 'en_route',
    statusHistory: [
      { status: 'dispatched', timestamp: new Date(Date.now() - 1800000).toISOString(), note: 'Ambulance dispatched from station' },
      { status: 'en_route', timestamp: new Date(Date.now() - 900000).toISOString(), note: 'Vehicle en route to patient location, ETA 6 mins' }
    ],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString()
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-01',
    recipientUid: 'patient-demo-01',
    type: 'ambulance_updated',
    title: 'Ambulance En Route',
    message: 'ALS Ambulance (KA-25-EM-1081) driven by Ramesh Patil is en route. ETA: 6 mins.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0104',
    isRead: false,
    createdAt: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'notif-02',
    recipientUid: 'patient-demo-01',
    type: 'request_accepted',
    title: 'ICU Bed Confirmed',
    message: 'KIMS Super Specialty Hospital has confirmed your ICU cardiac bed admission.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0101',
    isRead: true,
    createdAt: new Date(Date.now() - 2800000).toISOString()
  },
  {
    id: 'notif-03',
    recipientUid: 'hosp-demo-01',
    type: 'request_received',
    title: 'Emergency Admission Request',
    message: 'New critical case CB-20261108-0042 (Rahul Deshpande, 42M) requires an ICU bed.',
    relatedCaseId: 'CB-20261108-0042',
    relatedRequestId: 'REQ-20261108-0101',
    isRead: true,
    createdAt: new Date(Date.now() - 3500000).toISOString()
  }
];

// ==========================================
// UNIFIED DATA STORE (Reactive Singleton)
// ==========================================

const STORAGE_KEY = 'carebridge_unified_store_v2';
const PROVIDER_ROLES: UserRole[] = ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'];
const ATTENDANT_ROLES: UserRole[] = ['patientAttendant', 'patient_attendant', 'attendant'];

interface StoreState {
  users: UserProfile[];
  cases: EmergencyCase[];
  requests: ResourceRequest[];
  trips: AmbulanceTrip[];
  notifications: NotificationItem[];
  hospitalProfiles: Record<string, HospitalProfile>;
  bloodBankProfiles: Record<string, BloodBankProfile>;
  oxygenProfiles: Record<string, OxygenProfile>;
  ambulanceProfiles: Record<string, AmbulanceProfile>;
  clinicalNotes: ClinicalNote[];
  patientLinks: PatientLink[];
  providerUpdateRequests: ProviderUpdateRequest[];
}

type Listener = () => void;

class DataStore {
  public state: StoreState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): StoreState {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const savedUsers: UserProfile[] = Array.isArray(parsed.users) ? parsed.users : [];
          const mergedUsers = [...savedUsers];
          DEMO_USERS.forEach((demoUser) => {
            const idx = mergedUsers.findIndex((u) => u.email.toLowerCase() === demoUser.email.toLowerCase());
            if (idx === -1) {
              mergedUsers.push(demoUser);
            } else if (demoUser.role === 'admin' && mergedUsers[idx].role !== 'admin') {
              mergedUsers[idx] = { ...mergedUsers[idx], role: 'admin' };
            }
          });

          return {
            users: mergedUsers,
            cases: Array.isArray(parsed.cases) ? parsed.cases : [...INITIAL_CASES],
            requests: Array.isArray(parsed.requests) ? parsed.requests : [...INITIAL_REQUESTS],
            trips: Array.isArray(parsed.trips) ? parsed.trips : [...INITIAL_TRIPS],
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [...INITIAL_NOTIFICATIONS],
            hospitalProfiles: parsed.hospitalProfiles && typeof parsed.hospitalProfiles === 'object' && Object.keys(parsed.hospitalProfiles).length > 0
              ? { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL, ...parsed.hospitalProfiles }
              : { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL },
            bloodBankProfiles: parsed.bloodBankProfiles && typeof parsed.bloodBankProfiles === 'object' && Object.keys(parsed.bloodBankProfiles).length > 0
              ? { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK, ...parsed.bloodBankProfiles }
              : { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK },
            oxygenProfiles: parsed.oxygenProfiles && typeof parsed.oxygenProfiles === 'object' && Object.keys(parsed.oxygenProfiles).length > 0
              ? { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN, ...parsed.oxygenProfiles }
              : { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN },
            ambulanceProfiles: parsed.ambulanceProfiles && typeof parsed.ambulanceProfiles === 'object' && Object.keys(parsed.ambulanceProfiles).length > 0
              ? { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE, ...parsed.ambulanceProfiles }
              : { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE },
            clinicalNotes: Array.isArray(parsed.clinicalNotes) ? parsed.clinicalNotes : [],
            patientLinks: Array.isArray(parsed.patientLinks) ? parsed.patientLinks : [],
            providerUpdateRequests: Array.isArray(parsed.providerUpdateRequests) ? parsed.providerUpdateRequests : []
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved store, using default demo seed:', e);
    }

    return {
      users: [...DEMO_USERS],
      cases: [...INITIAL_CASES],
      requests: [...INITIAL_REQUESTS],
      trips: [...INITIAL_TRIPS],
      notifications: [...INITIAL_NOTIFICATIONS],
      hospitalProfiles: { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL },
      bloodBankProfiles: { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK },
      oxygenProfiles: { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN },
      ambulanceProfiles: { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE },
      clinicalNotes: [],
      patientLinks: [],
      providerUpdateRequests: []
    };
  }

  public saveState() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.error('Failed to save store to localStorage:', e);
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Error notifying listener:', err);
      }
    });
  }

  public resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.notify();
  }

  // --- Users & Profiles ---
  public getUsers(): UserProfile[] {
    return [...this.state.users];
  }

  public getUser(uid: string): UserProfile | undefined {
    return this.state.users.find((u) => u.uid === uid);
  }

  public saveUser(user: UserProfile) {
    const idx = this.state.users.findIndex((u) => u.uid === user.uid);
    if (idx >= 0) {
      this.state.users[idx] = { ...user, updatedAt: user.updatedAt || new Date().toISOString() };
    } else {
      this.state.users.push({ ...user });
    }
    this.saveState();
  }

  public removeUser(uid: string) {
    this.state.users = this.state.users.filter((u) => u.uid !== uid);
    this.saveState();
  }

  public async toggleUserActive(uid: string, isActive: boolean): Promise<void> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured && db && auth?.currentUser) {
      const adminSnapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!adminSnapshot.exists() || adminSnapshot.data().role !== 'admin') {
        throw new Error('Only an authorized administrator can change account status.');
      }

      const userRef = doc(db, 'users', uid);
      const userSnapshot = await getDoc(userRef);
      if (!userSnapshot.exists()) {
        throw new Error('The account could not be found.');
      }

      const profile = userSnapshot.data() as UserProfile;
      const batch = writeBatch(db);
      batch.update(userRef, { isActive, updatedAt: now });
      if (PROVIDER_ROLES.includes(profile.role)) {
        batch.set(
          doc(db, 'providerDirectory', uid),
          {
            uid,
            role: profile.role,
            displayName: profile.displayName,
            city: profile.city,
            hospitalAffiliation: profile.hospitalAffiliation || '',
            isVerified: profile.isVerified,
            isActive,
            updatedAt: now
          },
          { merge: true }
        );
      }
      await batch.commit();
    }

    const user = this.state.users.find((u) => u.uid === uid);
    if (user) {
      user.isActive = isActive;
      user.updatedAt = now;
      this.saveState();
    }
  }

  public async verifyProvider(uid: string, isVerified: boolean): Promise<void> {
    const now = new Date().toISOString();

    if (isFirebaseConfigured && db && auth?.currentUser) {
      const adminSnapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (!adminSnapshot.exists() || adminSnapshot.data().role !== 'admin') {
        throw new Error('Only an authorized administrator can change provider verification.');
      }

      const providerRef = doc(db, 'users', uid);
      const providerSnapshot = await getDoc(providerRef);
      if (!providerSnapshot.exists()) {
        throw new Error('The provider account could not be found.');
      }

      const provider = providerSnapshot.data() as UserProfile;
      if (!PROVIDER_ROLES.includes(provider.role)) {
        throw new Error('Verification can only be changed for provider accounts.');
      }

      const batch = writeBatch(db);
      batch.update(providerRef, { isVerified, updatedAt: now });
      batch.set(
        doc(db, 'providerDirectory', uid),
        {
          uid,
          role: provider.role,
          displayName: provider.displayName,
          city: provider.city,
          hospitalAffiliation: provider.hospitalAffiliation || '',
          isVerified,
          isActive: provider.isActive,
          updatedAt: now
        },
        { merge: true }
      );
      await batch.commit();
    }

    const user = this.state.users.find((u) => u.uid === uid);
    if (user) {
      user.isVerified = isVerified;
      user.updatedAt = now;
      if (this.state.hospitalProfiles[uid]) this.state.hospitalProfiles[uid].isVerified = isVerified;
      if (this.state.bloodBankProfiles[uid]) this.state.bloodBankProfiles[uid].isVerified = isVerified;
      if (this.state.oxygenProfiles[uid]) this.state.oxygenProfiles[uid].isVerified = isVerified;
      if (this.state.ambulanceProfiles[uid]) this.state.ambulanceProfiles[uid].isVerified = isVerified;

      this.state.notifications.unshift({
        id: 'notif-' + Date.now(),
        recipientUid: uid,
        type: 'provider_verified',
        title: isVerified ? 'Provider Profile Verified' : 'Provider Verification Revoked',
        message: isVerified
          ? 'Your healthcare provider organization has been verified by the CareBridge Coordinator.'
          : 'Your provider credentials require re-verification. Contact the administrator.',
        isRead: false,
        createdAt: now
      });
      this.saveState();
    }
  }

  // --- Provider Specific Profiles & Real-Time Updates ---
  public getAdminUids(): string[] {
    const fromUsers = this.state.users.filter((u) => u.role === 'admin').map((u) => u.uid);
    const uids = new Set(['admin-demo-01', ...fromUsers]);
    if (auth?.currentUser) {
      const cur = this.getUser(auth.currentUser.uid);
      if (cur?.role === 'admin') uids.add(auth.currentUser.uid);
    }
    return Array.from(uids);
  }

  public getProviderUpdateRequests(): ProviderUpdateRequest[] {
    return [...(this.state.providerUpdateRequests || [])];
  }

  public addProviderUpdateRequest(req: ProviderUpdateRequest) {
    if (!this.state.providerUpdateRequests) {
      this.state.providerUpdateRequests = [];
    }
    this.state.providerUpdateRequests.unshift(req);
    if (this.state.providerUpdateRequests.length > 50) {
      this.state.providerUpdateRequests = this.state.providerUpdateRequests.slice(0, 50);
    }
    this.saveState();
  }

  public getHospitalProfile(uid: string): HospitalProfile | undefined {
    if (!this.state.hospitalProfiles) this.state.hospitalProfiles = { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL };
    if (this.state.hospitalProfiles[uid]) return this.state.hospitalProfiles[uid];
    const user = this.getUser(uid);
    if (user && user.role === 'hospital') {
      const initial: HospitalProfile = {
        ...INITIAL_HOSPITAL,
        uid,
        hospitalName: user.displayName || INITIAL_HOSPITAL.hospitalName,
        city: user.city || INITIAL_HOSPITAL.city,
        state: user.state || INITIAL_HOSPITAL.state,
        address: user.address || INITIAL_HOSPITAL.address,
        contactNumber: user.phone || INITIAL_HOSPITAL.contactNumber,
        isVerified: user.isVerified
      };
      this.state.hospitalProfiles[uid] = initial;
      this.saveState();
      return initial;
    }
    return Object.values(this.state.hospitalProfiles)[0] || INITIAL_HOSPITAL;
  }

  public async updateHospitalProfile(uid: string, updates: Partial<HospitalProfile>) {
    const current = this.getHospitalProfile(uid) || INITIAL_HOSPITAL;
    const summary = `General Beds: ${updates.availableBeds ?? current.availableBeds} / ${updates.totalBeds ?? current.totalBeds}, ICU: ${updates.availableICU ?? current.availableICU} / ${updates.totalICU ?? current.totalICU}, Ventilators: ${updates.availableVentilators ?? current.availableVentilators} / ${updates.totalVentilators ?? current.totalVentilators}`;
    const updateReq: ProviderUpdateRequest = {
      id: `PUR-${Date.now()}-${uid.slice(-4)}`,
      providerUid: uid,
      providerName: current.hospitalName,
      providerRole: 'hospital',
      updateType: 'capacity_update',
      details: updates,
      summary,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    this.addProviderUpdateRequest(updateReq);

    // Notify administrators of pending review request
    const adminUids = this.getAdminUids();
    adminUids.forEach((adminUid) => {
      this.addNotification({
        id: `notif-${Date.now()}-${adminUid.slice(-4)}`,
        recipientUid: adminUid,
        type: 'provider_data_updated',
        title: `Hospital Capacity Change Request: ${current.hospitalName}`,
        message: `${current.hospitalName} submitted an emergency capacity change request: ${summary}. Coordinator review & approval required.`,
        details: summary,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', updateReq.id), updateReq);
        for (const adminUid of adminUids) {
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: adminUid,
              type: 'system_alert',
              title: `Hospital Capacity Change Request: ${current.hospitalName}`,
              message: `${current.hospitalName} requested capacity change: ${summary}. Awaiting approval.`,
              details: summary,
              actorUid: uid,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[CareBridge] Failed to write admin notification to Firestore:', notifErr);
          }
        }
      } catch (e) {
        console.warn('[CareBridge] Failed to sync update request to Firestore:', e);
      }
    }
  }

  public getBloodBankProfile(uid: string): BloodBankProfile | undefined {
    if (!this.state.bloodBankProfiles) this.state.bloodBankProfiles = { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK };
    if (this.state.bloodBankProfiles[uid]) return this.state.bloodBankProfiles[uid];
    const user = this.getUser(uid);
    if (user && user.role === 'bloodBank') {
      const initial: BloodBankProfile = {
        ...INITIAL_BLOOD_BANK,
        uid,
        bankName: user.displayName || INITIAL_BLOOD_BANK.bankName,
        city: user.city || INITIAL_BLOOD_BANK.city,
        state: user.state || INITIAL_BLOOD_BANK.state,
        address: user.address || INITIAL_BLOOD_BANK.address,
        contactNumber: user.phone || INITIAL_BLOOD_BANK.contactNumber,
        isVerified: user.isVerified
      };
      this.state.bloodBankProfiles[uid] = initial;
      this.saveState();
      return initial;
    }
    return Object.values(this.state.bloodBankProfiles)[0] || INITIAL_BLOOD_BANK;
  }

  public async updateBloodBankProfile(uid: string, updates: Partial<BloodBankProfile>) {
    const current = this.getBloodBankProfile(uid) || INITIAL_BLOOD_BANK;
    const summary = 'Blood inventory update requested: ' + Object.entries(updates.inventory || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
    const updateReq: ProviderUpdateRequest = {
      id: `PUR-${Date.now()}-${uid.slice(-4)}`,
      providerUid: uid,
      providerName: current.bankName,
      providerRole: 'bloodBank',
      updateType: 'inventory_update',
      details: updates,
      summary,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    this.addProviderUpdateRequest(updateReq);

    const adminUids = this.getAdminUids();
    adminUids.forEach((adminUid) => {
      this.addNotification({
        id: `notif-${Date.now()}-${adminUid.slice(-4)}`,
        recipientUid: adminUid,
        type: 'provider_data_updated',
        title: `Blood Bank Stock Change Request: ${current.bankName}`,
        message: `${current.bankName} requested blood stock update: ${summary}. Coordinator approval required.`,
        details: summary,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', updateReq.id), updateReq);
        for (const adminUid of adminUids) {
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: adminUid,
              type: 'system_alert',
              title: `Blood Bank Stock Change Request: ${current.bankName}`,
              message: `${current.bankName} requested stock update: ${summary}`,
              details: summary,
              actorUid: uid,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[CareBridge] Failed to write admin notification to Firestore:', notifErr);
          }
        }
      } catch (e) {
        console.warn('[CareBridge] Failed to sync update request to Firestore:', e);
      }
    }
  }

  public getOxygenProfile(uid: string): OxygenProfile | undefined {
    if (!this.state.oxygenProfiles) this.state.oxygenProfiles = { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN };
    if (this.state.oxygenProfiles[uid]) return this.state.oxygenProfiles[uid];
    const user = this.getUser(uid);
    if (user && user.role === 'oxygenProvider') {
      const initial: OxygenProfile = {
        ...INITIAL_OXYGEN,
        uid,
        providerName: user.displayName || INITIAL_OXYGEN.providerName,
        city: user.city || INITIAL_OXYGEN.city,
        state: user.state || INITIAL_OXYGEN.state,
        address: user.address || INITIAL_OXYGEN.address,
        contactNumber: user.phone || INITIAL_OXYGEN.contactNumber,
        isVerified: user.isVerified
      };
      this.state.oxygenProfiles[uid] = initial;
      this.saveState();
      return initial;
    }
    return Object.values(this.state.oxygenProfiles)[0] || INITIAL_OXYGEN;
  }

  public async updateOxygenProfile(uid: string, updates: Partial<OxygenProfile>) {
    const current = this.getOxygenProfile(uid) || INITIAL_OXYGEN;
    const summary = `Cylinders: ${updates.cylindersAvailable ?? current.cylindersAvailable}, Concentrators: ${updates.concentratorsAvailable ?? current.concentratorsAvailable}, Delivery: ${(updates.deliveryAvailable ?? current.deliveryAvailable) ? 'Yes' : 'No'}`;
    const updateReq: ProviderUpdateRequest = {
      id: `PUR-${Date.now()}-${uid.slice(-4)}`,
      providerUid: uid,
      providerName: current.providerName,
      providerRole: 'oxygenProvider',
      updateType: 'inventory_update',
      details: updates,
      summary,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    this.addProviderUpdateRequest(updateReq);

    const adminUids = this.getAdminUids();
    adminUids.forEach((adminUid) => {
      this.addNotification({
        id: `notif-${Date.now()}-${adminUid.slice(-4)}`,
        recipientUid: adminUid,
        type: 'provider_data_updated',
        title: `Oxygen Capacity Change Request: ${current.providerName}`,
        message: `${current.providerName} requested an oxygen inventory update: ${summary}. Coordinator review & approval required.`,
        details: summary,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', updateReq.id), updateReq);
        for (const adminUid of adminUids) {
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: adminUid,
              type: 'system_alert',
              title: `Oxygen Capacity Change Request: ${current.providerName}`,
              message: `${current.providerName} requested reserve update: ${summary}`,
              details: summary,
              actorUid: uid,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[CareBridge] Failed to write admin notification to Firestore:', notifErr);
          }
        }
      } catch (e) {
        console.warn('[CareBridge] Failed to sync oxygen update request to Firestore:', e);
      }
    }
  }

  public getAmbulanceProfile(uid: string): AmbulanceProfile | undefined {
    if (!this.state.ambulanceProfiles) this.state.ambulanceProfiles = { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE };
    if (this.state.ambulanceProfiles[uid]) return this.state.ambulanceProfiles[uid];
    const user = this.getUser(uid);
    if (user && user.role === 'ambulanceProvider') {
      const initial: AmbulanceProfile = {
        ...INITIAL_AMBULANCE,
        uid,
        providerName: user.displayName || INITIAL_AMBULANCE.providerName,
        city: user.city || INITIAL_AMBULANCE.city,
        state: user.state || INITIAL_AMBULANCE.state,
        address: user.address || INITIAL_AMBULANCE.address,
        contactNumber: user.phone || INITIAL_AMBULANCE.contactNumber,
        isVerified: user.isVerified
      };
      this.state.ambulanceProfiles[uid] = initial;
      this.saveState();
      return initial;
    }
    return Object.values(this.state.ambulanceProfiles)[0] || INITIAL_AMBULANCE;
  }

  public async updateAmbulanceProfile(uid: string, updates: Partial<AmbulanceProfile>) {
    const current = this.getAmbulanceProfile(uid) || INITIAL_AMBULANCE;
    const vehicleCount = updates.vehicles ? updates.vehicles.length : current.vehicles.length;
    const idleCount = updates.vehicles ? updates.vehicles.filter(v => v.isAvailable).length : current.vehicles.filter(v => v.isAvailable).length;
    const summary = `Fleet: ${vehicleCount} vehicles (${idleCount} idle units)`;
    const updateReq: ProviderUpdateRequest = {
      id: `PUR-${Date.now()}-${uid.slice(-4)}`,
      providerUid: uid,
      providerName: current.providerName,
      providerRole: 'ambulanceProvider',
      updateType: 'fleet_update',
      details: updates,
      summary,
      timestamp: new Date().toISOString(),
      status: 'PENDING'
    };
    this.addProviderUpdateRequest(updateReq);

    const adminUids = this.getAdminUids();
    adminUids.forEach((adminUid) => {
      this.addNotification({
        id: `notif-${Date.now()}-${adminUid.slice(-4)}`,
        recipientUid: adminUid,
        type: 'provider_data_updated',
        title: `Ambulance Fleet Change Request: ${current.providerName}`,
        message: `${current.providerName} requested an emergency fleet update: ${summary}. Coordinator approval required.`,
        details: summary,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', updateReq.id), updateReq);
        for (const adminUid of adminUids) {
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: adminUid,
              type: 'system_alert',
              title: `Ambulance Fleet Change Request: ${current.providerName}`,
              message: `${current.providerName} requested fleet update: ${summary}`,
              details: summary,
              actorUid: uid,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[CareBridge] Failed to write admin notification to Firestore:', notifErr);
          }
        }
      } catch (e) {
        console.warn('[CareBridge] Failed to sync ambulance update request to Firestore:', e);
      }
    }
  }

  public async approveProviderUpdateRequest(
    requestId: string,
    adjustedDetails?: Record<string, any>,
    adminNote?: string
  ): Promise<void> {
    const updateReq = (this.state.providerUpdateRequests || []).find((r) => r.id === requestId);
    if (!updateReq) throw new Error('Update request not found.');

    const approvedValues = adjustedDetails || updateReq.details;
    const now = new Date().toISOString();
    const adminUid = auth?.currentUser?.uid || 'admin-coordinator';

    // Apply the updates to the active verified provider profile
    if (updateReq.providerRole === 'hospital') {
      const current = this.getHospitalProfile(updateReq.providerUid) || INITIAL_HOSPITAL;
      const updated: HospitalProfile = {
        ...current,
        ...approvedValues,
        lastUpdated: now
      };
      this.state.hospitalProfiles[updateReq.providerUid] = updated;
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'hospitalProfiles', updateReq.providerUid), updated, { merge: true });
          await setDoc(doc(db, 'providerDirectory', updateReq.providerUid), {
            uid: updateReq.providerUid,
            role: 'hospital',
            displayName: updated.hospitalName,
            city: updated.city || 'Hubballi',
            isVerified: true,
            isActive: true,
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[CareBridge] Error syncing approved hospital profile to Firestore:', e);
        }
      }
    } else if (updateReq.providerRole === 'bloodBank') {
      const current = this.getBloodBankProfile(updateReq.providerUid) || INITIAL_BLOOD_BANK;
      const updated: BloodBankProfile = {
        ...current,
        ...approvedValues,
        lastUpdated: now
      };
      this.state.bloodBankProfiles[updateReq.providerUid] = updated;
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'bloodBankProfiles', updateReq.providerUid), updated, { merge: true });
          await setDoc(doc(db, 'providerDirectory', updateReq.providerUid), {
            uid: updateReq.providerUid,
            role: 'bloodBank',
            displayName: updated.bankName,
            city: updated.city || 'Hubballi',
            isVerified: true,
            isActive: true,
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[CareBridge] Error syncing approved blood bank profile to Firestore:', e);
        }
      }
    } else if (updateReq.providerRole === 'oxygenProvider') {
      const current = this.getOxygenProfile(updateReq.providerUid) || INITIAL_OXYGEN;
      const updated: OxygenProfile = {
        ...current,
        ...approvedValues,
        lastUpdated: now
      };
      this.state.oxygenProfiles[updateReq.providerUid] = updated;
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'oxygenProfiles', updateReq.providerUid), updated, { merge: true });
          await setDoc(doc(db, 'providerDirectory', updateReq.providerUid), {
            uid: updateReq.providerUid,
            role: 'oxygenProvider',
            displayName: updated.providerName,
            city: updated.city || 'Hubballi',
            isVerified: true,
            isActive: true,
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[CareBridge] Error syncing approved oxygen profile to Firestore:', e);
        }
      }
    } else if (updateReq.providerRole === 'ambulanceProvider') {
      const current = this.getAmbulanceProfile(updateReq.providerUid) || INITIAL_AMBULANCE;
      const updated: AmbulanceProfile = {
        ...current,
        ...approvedValues,
        lastUpdated: now
      };
      this.state.ambulanceProfiles[updateReq.providerUid] = updated;
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'ambulanceProfiles', updateReq.providerUid), updated, { merge: true });
          await setDoc(doc(db, 'providerDirectory', updateReq.providerUid), {
            uid: updateReq.providerUid,
            role: 'ambulanceProvider',
            displayName: updated.providerName,
            city: updated.city || 'Hubballi',
            isVerified: true,
            isActive: true,
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[CareBridge] Error syncing approved ambulance profile to Firestore:', e);
        }
      }
    }

    updateReq.status = 'APPROVED';
    updateReq.reviewedAt = now;
    updateReq.reviewedByUid = adminUid;
    if (adminNote) updateReq.adminNote = adminNote;

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', requestId), updateReq, { merge: true });
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          recipientUid: updateReq.providerUid,
          type: 'provider_update_approved',
          title: 'Capacity Update Approved',
          message: `Coordinator approved your capacity update request (${updateReq.summary}). Network telemetry is now updated.`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[CareBridge] Error saving approved request to Firestore:', e);
      }
    }

    this.addNotification({
      id: `notif-${Date.now()}-${updateReq.providerUid.slice(-4)}`,
      recipientUid: updateReq.providerUid,
      type: 'provider_update_approved',
      title: 'Capacity Update Approved',
      message: `Coordinator approved your capacity update request (${updateReq.summary}). Network telemetry is now updated.`,
      isRead: false,
      createdAt: now
    });

    this.saveState();
  }

  public async rejectProviderUpdateRequest(
    requestId: string,
    reason?: string
  ): Promise<void> {
    const updateReq = (this.state.providerUpdateRequests || []).find((r) => r.id === requestId);
    if (!updateReq) throw new Error('Update request not found.');

    const now = new Date().toISOString();
    const adminUid = auth?.currentUser?.uid || 'admin-coordinator';

    updateReq.status = 'REJECTED';
    updateReq.reviewedAt = now;
    updateReq.reviewedByUid = adminUid;
    updateReq.adminNote = reason || 'Declined by coordinator';

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'providerUpdateRequests', requestId), updateReq, { merge: true });
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          recipientUid: updateReq.providerUid,
          type: 'provider_update_rejected',
          title: 'Capacity Update Declined',
          message: `Coordinator declined your capacity update request${reason ? `: ${reason}` : ''}. Current live numbers remain unchanged.`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[CareBridge] Error saving rejected request to Firestore:', e);
      }
    }

    this.addNotification({
      id: `notif-${Date.now()}-${updateReq.providerUid.slice(-4)}`,
      recipientUid: updateReq.providerUid,
      type: 'provider_update_rejected',
      title: 'Capacity Update Declined',
      message: `Coordinator declined your capacity update request${reason ? `: ${reason}` : ''}. Current live numbers remain unchanged.`,
      isRead: false,
      createdAt: now
    });

    this.saveState();
  }

  public getDoctorProfile(uid: string): UserProfile | undefined {
    const user = this.getUser(uid);
    return user?.role === 'doctor' ? user : (this.getUsers().find(u => u.role === 'doctor'));
  }

  public getAllHospitalProfiles(): HospitalProfile[] {
    if (!this.state.hospitalProfiles) this.state.hospitalProfiles = { [INITIAL_HOSPITAL.uid]: INITIAL_HOSPITAL };
    this.state.users
      .filter((u) => u.role === 'hospital')
      .forEach((u) => {
        if (!this.state.hospitalProfiles[u.uid]) {
          this.getHospitalProfile(u.uid);
        } else if (u.displayName && (this.state.hospitalProfiles[u.uid].hospitalName === INITIAL_HOSPITAL.hospitalName || !this.state.hospitalProfiles[u.uid].hospitalName)) {
          this.state.hospitalProfiles[u.uid].hospitalName = u.displayName;
        }
      });
    return Object.values(this.state.hospitalProfiles);
  }

  public getAllBloodBankProfiles(): BloodBankProfile[] {
    if (!this.state.bloodBankProfiles) this.state.bloodBankProfiles = { [INITIAL_BLOOD_BANK.uid]: INITIAL_BLOOD_BANK };
    this.state.users
      .filter((u) => u.role === 'bloodBank')
      .forEach((u) => {
        if (!this.state.bloodBankProfiles[u.uid]) {
          this.getBloodBankProfile(u.uid);
        } else if (u.displayName && (this.state.bloodBankProfiles[u.uid].bankName === INITIAL_BLOOD_BANK.bankName || !this.state.bloodBankProfiles[u.uid].bankName)) {
          this.state.bloodBankProfiles[u.uid].bankName = u.displayName;
        }
      });
    return Object.values(this.state.bloodBankProfiles);
  }

  public getAllOxygenProfiles(): OxygenProfile[] {
    if (!this.state.oxygenProfiles) this.state.oxygenProfiles = { [INITIAL_OXYGEN.uid]: INITIAL_OXYGEN };
    this.state.users
      .filter((u) => u.role === 'oxygenProvider' || (u.role as any) === 'oxygenDepot')
      .forEach((u) => {
        if (!this.state.oxygenProfiles[u.uid]) {
          this.getOxygenProfile(u.uid);
        } else if (u.displayName && (this.state.oxygenProfiles[u.uid].providerName === INITIAL_OXYGEN.providerName || !this.state.oxygenProfiles[u.uid].providerName)) {
          this.state.oxygenProfiles[u.uid].providerName = u.displayName;
        }
      });
    return Object.values(this.state.oxygenProfiles);
  }

  public getAllAmbulanceProfiles(): AmbulanceProfile[] {
    if (!this.state.ambulanceProfiles) this.state.ambulanceProfiles = { [INITIAL_AMBULANCE.uid]: INITIAL_AMBULANCE };
    this.state.users
      .filter((u) => u.role === 'ambulanceProvider')
      .forEach((u) => {
        if (!this.state.ambulanceProfiles[u.uid]) {
          this.getAmbulanceProfile(u.uid);
        } else if (u.displayName && (this.state.ambulanceProfiles[u.uid].providerName === INITIAL_AMBULANCE.providerName || !this.state.ambulanceProfiles[u.uid].providerName)) {
          this.state.ambulanceProfiles[u.uid].providerName = u.displayName;
        }
      });
    return Object.values(this.state.ambulanceProfiles);
  }

  // --- Patient Links (Attendant <-> Patient Relationship) ---
  public getPatientLinks(attendantUid: string): PatientLink[] {
    return (this.state.patientLinks || []).filter((l) => l.attendantUid === attendantUid);
  }

  public savePatientLink(link: PatientLink) {
    if (!this.state.patientLinks) this.state.patientLinks = [];
    const idx = this.state.patientLinks.findIndex((l) => l.id === link.id);
    if (idx >= 0) {
      this.state.patientLinks[idx] = { ...link, updatedAt: new Date().toISOString() };
    } else {
      this.state.patientLinks.unshift(link);
    }
    this.saveState();
  }

  public deletePatientLink(linkId: string) {
    if (!this.state.patientLinks) return;
    this.state.patientLinks = this.state.patientLinks.filter((l) => l.id !== linkId);
    this.saveState();
  }

  // --- Emergency Cases ---
  public getCases(): EmergencyCase[] {
    return [...this.state.cases];
  }

  public getCasesForPatient(patientUid: string): EmergencyCase[] {
    return this.state.cases.filter((c) => c.patientUid === patientUid);
  }

  public getCasesForAttendant(attendantUid: string, linkedPatientUids: string[] = []): EmergencyCase[] {
    // Strictly retrieve only cases associated with this attendant UID or their authorized, consented linked patients
    const consentedPatientUids = this.getPatientLinks(attendantUid)
      .filter((l) => l.consentGranted === true && l.consentStatus === 'granted')
      .map((l) => l.patientUid);

    return this.state.cases.filter((c) => {
      if (c.attendantUid === attendantUid) return true;
      if (c.attendant && c.attendant.uid === attendantUid) return true;
      if (c.patientUid === attendantUid) return true;
      if (c.requesterUid === attendantUid) return true;
      // Accessing patient's records strictly requires verified patient consent
      if (consentedPatientUids.includes(c.patientUid) && linkedPatientUids.includes(c.patientUid)) return true;
      return false;
    });
  }

  public getCase(caseId: string): EmergencyCase | undefined {
    return this.state.cases.find((c) => c.caseId === caseId);
  }

  public subscribeToCoordinatorCasesAndRequests(
    onUsers: (users: UserProfile[]) => void,
    onCases: (cases: EmergencyCase[]) => void,
    onRequests: (requests: ResourceRequest[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    // 1. Immediately emit current store state so the admin dashboard is never blank
    onUsers(this.state.users);
    onCases(this.state.cases);
    onRequests(this.state.requests);

    // 2. Subscribe to reactive local dataStore
    const unsubStore = this.subscribe(() => {
      onUsers(this.state.users);
      onCases(this.state.cases);
      onRequests(this.state.requests);
    });

    let unsubUsers = () => {};
    let unsubCases = () => {};
    let unsubRequests = () => {};

    if (isFirebaseConfigured && db) {
      try {
        unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
          try {
            const users = snapshot.docs.map((userSnapshot) => {
              const data = userSnapshot.data();
              return {
                ...data,
                uid: data.uid || userSnapshot.id,
                email: data.email || '',
                displayName: data.displayName || '',
                city: data.city || '',
                state: data.state || '',
                isVerified: data.isVerified === true,
                isActive: data.isActive === true,
                profileComplete: data.profileComplete === true,
                createdAt: data.createdAt ? firestoreDateToIso(data.createdAt) : '',
                updatedAt: data.updatedAt ? firestoreDateToIso(data.updatedAt) : ''
              } as UserProfile;
            });
            const userMap = new Map<string, UserProfile>();
            this.state.users.forEach((u) => userMap.set(u.uid, u));
            users.forEach((u) => userMap.set(u.uid, u));
            const mergedUsers = Array.from(userMap.values());
            this.state.users = mergedUsers;
            mergedUsers.forEach((u) => {
              if (u.role === 'hospital') this.getHospitalProfile(u.uid);
              if (u.role === 'bloodBank') this.getBloodBankProfile(u.uid);
              if (u.role === 'oxygenProvider' || (u.role as any) === 'oxygenDepot') this.getOxygenProfile(u.uid);
              if (u.role === 'ambulanceProvider') this.getAmbulanceProfile(u.uid);
            });
            this.saveState();
            onUsers(mergedUsers);
          } catch (error) {
            console.warn('[CareBridge] Error processing users snapshot:', error);
            onUsers(this.state.users);
          }
        }, (error) => {
          console.warn('[CareBridge] Users onSnapshot note:', error.message);
          onUsers(this.state.users);
        });
      } catch (e) {}

      try {
        unsubCases = onSnapshot(collection(db, 'cases'), (snapshot) => {
          try {
            const cases = snapshot.docs.map((caseSnapshot) =>
              normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id)
            );
            const caseMap = new Map<string, EmergencyCase>();
            this.state.cases.forEach((c) => caseMap.set(c.caseId, c));
            cases.forEach((c) => caseMap.set(c.caseId, c));
            const mergedCases = Array.from(caseMap.values());
            mergedCases.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
            this.state.cases = mergedCases;
            this.saveState();
            onCases(mergedCases);
          } catch (error) {
            console.warn('[CareBridge] Error processing cases snapshot:', error);
            onCases(this.state.cases);
          }
        }, (error) => {
          console.warn('[CareBridge] Cases onSnapshot note (falling back to local state):', error.message);
          onCases(this.state.cases);
        });
      } catch (e) {}

      try {
        unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
          try {
            const requests = snapshot.docs.map((requestSnapshot) =>
              normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id)
            );
            const reqMap = new Map<string, ResourceRequest>();
            this.state.requests.forEach((r) => reqMap.set(r.requestId, r));
            requests.forEach((r) => reqMap.set(r.requestId, r));
            const mergedReqs = Array.from(reqMap.values());
            mergedReqs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
            this.state.requests = mergedReqs;
            this.saveState();
            onRequests(mergedReqs);
          } catch (error) {
            console.warn('[CareBridge] Error processing requests snapshot:', error);
            onRequests(this.state.requests);
          }
        }, (error) => {
          console.warn('[CareBridge] Requests onSnapshot note (falling back to local state):', error.message);
          onRequests(this.state.requests);
        });
      } catch (e) {}
    }

    return () => {
      unsubUsers();
      unsubCases();
      unsubRequests();
      unsubStore();
    };
  }

  public async getEligibleResourceProviders(
    resourceType: ResourceRequest['resourceType'],
    location?: { city?: string; state?: string }
  ): Promise<EligibleResourceProvider[]> {
    const roleByResource: Record<ResourceRequest['resourceType'], UserRole> = {
      bed: 'hospital',
      icu: 'hospital',
      hospital_admission: 'hospital',
      blood: 'bloodBank',
      oxygen: 'oxygenProvider',
      ambulance: 'ambulanceProvider',
      doctor: 'doctor',
      doctor_assistance: 'doctor'
    };
    const requiredRole = roleByResource[resourceType];

    if (!isFirebaseConfigured || !db || !auth?.currentUser) {
      return this.state.users
        .filter((u) => u.role === requiredRole && u.isActive !== false)
        .map((u) => ({
          uid: u.uid,
          role: u.role,
          displayName: u.displayName || 'Healthcare Provider',
          city: u.city || 'Hubballi',
          state: u.state || 'Karnataka',
          hospitalAffiliation: u.hospitalAffiliation || '',
          isVerified: Boolean(u.isVerified),
          isActive: u.isActive !== false
        }));
    }

    const providerSnapshot = await getDocs(
      query(collection(db, 'providerDirectory'), where('role', '==', requiredRole))
    );
    const eligible = await Promise.all(providerSnapshot.docs.map(async (providerSnapshotDoc): Promise<EligibleResourceProvider | null> => {
      const directory = providerSnapshotDoc.data();
      if (
        directory.uid !== providerSnapshotDoc.id ||
        directory.role !== requiredRole ||
        directory.isActive !== true ||
        directory.isVerified !== true
      ) return null;

      const userSnapshot = await getDoc(doc(db, 'users', providerSnapshotDoc.id));
      if (!userSnapshot.exists()) return null;
      const user = userSnapshot.data();
      if (
        user.role !== requiredRole ||
        user.isActive !== true ||
        user.isVerified !== true
      ) return null;

      const eligibleProvider: EligibleResourceProvider = {
        uid: providerSnapshotDoc.id,
        role: requiredRole,
        displayName: directory.displayName || user.displayName || '',
        city: directory.city || user.city || '',
        ...(directory.state || user.state ? { state: directory.state || user.state } : {}),
        isActive: true,
        isVerified: true
      };
      return eligibleProvider;
    }));

    const normalizedCity = location?.city?.trim().toLocaleLowerCase();
    const normalizedState = location?.state?.trim().toLocaleLowerCase();
    return eligible
      .filter((provider): provider is EligibleResourceProvider => provider !== null && Boolean(provider.displayName))
      .sort((a, b) => {
        const score = (provider: EligibleResourceProvider) =>
          Number(Boolean(normalizedCity) && provider.city.trim().toLocaleLowerCase() === normalizedCity) * 2 +
          Number(Boolean(normalizedState) && (provider.state || '').trim().toLocaleLowerCase() === normalizedState);
        return score(b) - score(a) || a.displayName.localeCompare(b.displayName);
      });
  }

  public subscribeToRequestAssignmentHistory(
    requestId: string,
    onHistory: (history: ResourceAssignmentAudit[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Assignment history requires a configured Firebase project.');
      return () => undefined;
    }

    return onSnapshot(
      query(collection(db, 'requests', requestId, 'assignmentHistory'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        try {
          onHistory(snapshot.docs.map((auditSnapshot) => {
            const data = auditSnapshot.data();
            return {
              ...data,
              auditId: auditSnapshot.id,
              timestamp: firestoreDateToIso(data.timestamp)
            } as ResourceAssignmentAudit;
          }));
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Assignment history could not be read.');
        }
      },
      (error) => onError(`Could not load assignment history: ${error.message}`)
    );
  }

  public async assignResourceRequest(
    requestId: string,
    providerUid: string,
    reason: string
  ): Promise<void> {
    const coordinatorUid = auth?.currentUser?.uid || 'admin-coordinator';
    const normalizedReason = reason.trim();
    const assignmentTimestamp = serverTimestamp();

    const providerUser = this.state.users.find((u) => u.uid === providerUid);
    let assignedProviderName = providerUser?.displayName || '';
    if (!assignedProviderName) {
      assignedProviderName =
        this.getHospitalProfile(providerUid)?.hospitalName ||
        this.getBloodBankProfile(providerUid)?.bankName ||
        this.getOxygenProfile(providerUid)?.providerName ||
        this.getAmbulanceProfile(providerUid)?.providerName ||
        'Healthcare Provider';
    }

    if (isFirebaseConfigured && db) {
      const requestRef = doc(db, 'requests', requestId);
      const coordinatorRef = doc(db, 'users', coordinatorUid);
      const auditRef = doc(collection(db, 'requests', requestId, 'assignmentHistory'));
      const notificationRef = doc(
        db,
        'notifications',
        notificationDocumentId(auditRef.id, providerUid)
      );
      const statusEventId = doc(collection(db, 'requests', requestId, 'statusHistory')).id;

      try {
        await runTransaction(db, async (transaction) => {
          const requestSnapshot = await transaction.get(requestRef);
          const coordinatorSnapshot = await transaction.get(coordinatorRef);
          const requestData = requestSnapshot.data();
          if (!requestSnapshot.exists() || !requestData) {
            throw new Error('This resource request no longer exists. Refresh and try again.');
          }

          const providerRef = doc(db, 'providerDirectory', providerUid);
          const providerUserRef = doc(db, 'users', providerUid);
          const [providerSnapshot, providerUserSnapshot, auditSnapshot] = await Promise.all([
            transaction.get(providerRef),
            transaction.get(providerUserRef),
            transaction.get(auditRef)
          ]);
          if (auditSnapshot.exists()) {
            throw new Error('Could not create a unique assignment audit record. Please retry.');
          }

          const previousProviderUid = requestData.providerUid || '';
          const previousProviderName = requestData.providerName || '';
          const isAlreadyAssigned = previousProviderUid && requestData.status !== 'REQUESTED';
          if (isAlreadyAssigned && previousProviderUid === providerUid) {
            throw new Error('This request is already assigned to the selected provider.');
          }

          const coordinator = coordinatorSnapshot.exists() ? coordinatorSnapshot.data() : { displayName: 'Central Coordinator' };
          if (providerSnapshot.exists() && providerSnapshot.data()?.displayName) {
            assignedProviderName = providerSnapshot.data().displayName;
          } else if (providerUserSnapshot.exists() && providerUserSnapshot.data()?.displayName) {
            assignedProviderName = providerUserSnapshot.data().displayName;
          }

          const previousStatus = String(requestData.status);
          const statusHistory = requestData.statusHistory && typeof requestData.statusHistory === 'object'
            ? requestData.statusHistory
            : {};
          transaction.set(auditRef, {
            requestId,
            caseId: requestData.caseId,
            resourceType: requestData.resourceType,
            previousProviderUid,
            previousProviderName,
            newProviderUid: providerUid,
            newProviderName: assignedProviderName,
            coordinatorUid,
            coordinatorName: coordinator.displayName || '',
            timestamp: assignmentTimestamp,
            reason: normalizedReason || 'Initial assignment'
          });
          transaction.update(requestRef, {
            providerUid,
            providerName: assignedProviderName,
            status: 'ASSIGNED',
            assignedAt: assignmentTimestamp,
            assignmentCoordinatorUid: coordinatorUid,
            lastAssignmentAuditId: auditRef.id,
            updatedAt: assignmentTimestamp,
            respondedByUid: deleteField(),
            respondedAt: deleteField(),
            responseDetails: deleteField(),
            rejectionReason: deleteField(),
            ...(previousStatus !== 'ASSIGNED' ? {
              lastStatusEventId: statusEventId,
              statusHistory: {
                ...statusHistory,
                [statusEventId]: {
                  eventId: statusEventId,
                  eventType: 'request_status',
                  previousStatus,
                  newStatus: 'ASSIGNED',
                  updatedByUid: coordinatorUid,
                  userRole: 'admin',
                  timestamp: assignmentTimestamp,
                  requestId,
                  resourceType: requestData.resourceType
                }
              }
            } : {})
          });
          transaction.set(notificationRef, {
            recipientUid: providerUid,
            type: 'request_assigned',
            eventType: 'request_assignment',
            eventId: auditRef.id,
            title: previousProviderUid ? 'Resource request reassigned' : 'New resource request assigned',
            message: `Emergency ${requestData.caseId}: ${requestData.resourceType} request assigned to you${previousProviderUid ? ` after reassignment: ${normalizedReason}` : '.'}`,
            details: previousProviderUid ? normalizedReason : 'A coordinator assigned this emergency resource request to you.',
            emergencyId: requestData.caseId,
            relatedCaseId: requestData.caseId,
            relatedRequestId: requestId,
            resourceType: requestData.resourceType,
            resourceDetails: requestData.details || {},
            actorUid: coordinatorUid,
            isRead: false,
            createdAt: assignmentTimestamp
          });
        });
      } catch (transactionErr) {
        console.warn('[CareBridge] assignResourceRequest transaction error, falling back to direct write:', transactionErr);
        try {
          await updateDoc(requestRef, {
            providerUid,
            providerName: assignedProviderName,
            status: 'ASSIGNED',
            assignedAt: assignmentTimestamp,
            assignmentCoordinatorUid: coordinatorUid,
            updatedAt: assignmentTimestamp
          });
          await setDoc(notificationRef, {
            recipientUid: providerUid,
            type: 'request_assigned',
            title: 'New emergency resource request assigned',
            message: `A coordinator assigned an emergency resource request to your center: ${normalizedReason || 'Emergency response required'}`,
            actorUid: coordinatorUid,
            isRead: false,
            createdAt: assignmentTimestamp
          }, { merge: true });
        } catch (directErr) {
          console.warn('[CareBridge] Direct updateDoc fallback also failed:', directErr);
        }
      }
    }

    let localRequest = this.state.requests.find((request) => request.requestId === requestId);
    if (localRequest) {
      localRequest.providerUid = providerUid;
      localRequest.providerName = assignedProviderName;
      localRequest.status = 'ASSIGNED';
      localRequest.assignedAt = new Date().toISOString();
      localRequest.assignmentCoordinatorUid = coordinatorUid;

      const caseItem = this.state.cases.find((c) => c.caseId === localRequest.caseId);
      if (caseItem) {
        if (['bed', 'icu', 'hospital_admission'].includes(localRequest.resourceType)) {
          caseItem.assignedHospitalUid = providerUid;
          caseItem.assignedHospitalName = assignedProviderName;
        } else if (localRequest.resourceType === 'ambulance') {
          caseItem.assignedAmbulanceUid = providerUid;
          caseItem.assignedAmbulanceName = assignedProviderName;
        } else if (localRequest.resourceType === 'blood') {
          caseItem.assignedBloodBankUid = providerUid;
          caseItem.assignedBloodBankName = assignedProviderName;
        } else if (localRequest.resourceType === 'oxygen') {
          caseItem.assignedOxygenUid = providerUid;
          caseItem.assignedOxygenName = assignedProviderName;
        }
        caseItem.status = 'ASSIGNED';
        caseItem.updatedAt = new Date().toISOString();
      }
      this.saveState();
    }

    this.addNotification({
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      recipientUid: providerUid,
      type: 'request_assigned',
      title: 'Emergency Resource Request Assigned',
      message: `A coordinator assigned an emergency request (${requestId}) to you: ${normalizedReason || 'Emergency response required'}.`,
      relatedRequestId: requestId,
      relatedCaseId: localRequest?.caseId,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  }

  public async assignCaseProviders(
    caseId: string,
    assignments: {
      hospitalUid?: string;
      ambulanceUid?: string;
      bloodBankUid?: string;
      oxygenUid?: string;
      doctorUid?: string;
      note?: string;
    }
  ): Promise<void> {
    const coordinatorUid = auth?.currentUser?.uid || 'admin-coordinator';
    let coordinatorName = 'Central Coordinator';
    if (auth?.currentUser && isFirebaseConfigured && db) {
      try {
        const coordinatorSnapshot = await getDoc(doc(db, 'users', coordinatorUid));
        if (coordinatorSnapshot.exists()) {
          coordinatorName = coordinatorSnapshot.data().displayName || coordinatorName;
        }
      } catch (e) {
        console.warn('Could not read coordinator user:', e);
      }
    }

    let caseItem = this.state.cases.find((c) => c.caseId === caseId);
    if (!caseItem && isFirebaseConfigured && db) {
      try {
        const caseSnap = await getDoc(doc(db, 'cases', caseId));
        if (caseSnap.exists()) {
          caseItem = normalizeEmergencyCase(caseSnap.data(), caseSnap.id);
          this.state.cases.unshift(caseItem);
        }
      } catch (e) {
        console.warn('Could not fetch case from Firestore in assignCaseProviders:', e);
      }
    }

    const reason = assignments.note?.trim() || 'Central Coordinator assignment';
    const now = new Date().toISOString();

    const assignmentMap: Array<{
      role: UserRole;
      resourceTypes: ResourceType[];
      providerUid?: string;
    }> = [
      { role: 'hospital', resourceTypes: ['bed', 'icu', 'hospital_admission'], providerUid: assignments.hospitalUid },
      { role: 'ambulanceProvider', resourceTypes: ['ambulance'], providerUid: assignments.ambulanceUid },
      { role: 'bloodBank', resourceTypes: ['blood'], providerUid: assignments.bloodBankUid },
      { role: 'oxygenProvider', resourceTypes: ['oxygen'], providerUid: assignments.oxygenUid },
      { role: 'doctor', resourceTypes: ['doctor', 'doctor_assistance'], providerUid: assignments.doctorUid }
    ];

    for (const item of assignmentMap) {
      if (!item.providerUid) continue;

      const providerUser = this.state.users.find((u) => u.uid === item.providerUid);
      let providerName = providerUser?.displayName || '';
      if (!providerName) {
        if (item.role === 'hospital') providerName = this.getHospitalProfile(item.providerUid)?.hospitalName || '';
        if (item.role === 'bloodBank') providerName = this.getBloodBankProfile(item.providerUid)?.bankName || '';
        if (item.role === 'oxygenProvider') providerName = this.getOxygenProfile(item.providerUid)?.providerName || '';
        if (item.role === 'ambulanceProvider') providerName = this.getAmbulanceProfile(item.providerUid)?.providerName || '';
        if (item.role === 'doctor') providerName = providerUser?.displayName || 'Attending Physician';
      }
      if (!providerName) providerName = 'Healthcare Provider';

      const defaultResourceType = item.resourceTypes[0];
      const defaultReqId = `REQ-${caseId}-${defaultResourceType}`;

      let req = this.state.requests.find(
        (r) => r.caseId === caseId && item.resourceTypes.includes(r.resourceType)
      );

      const targetReqId = req?.requestId || defaultReqId;
      const actualResourceType = req?.resourceType || defaultResourceType;

      const assignedRequest: ResourceRequest = {
        requestId: targetReqId,
        caseId,
        patientUid: caseItem?.patientUid || '',
        requesterUid: caseItem?.requesterUid,
        patientName: caseItem?.patientName || 'Emergency Patient',
        providerUid: item.providerUid,
        providerName,
        resourceType: actualResourceType,
        details: {
          ...(req?.details || {}),
          notes: reason,
          urgency: caseItem?.urgencyLevel || caseItem?.priority || 'emergency',
          bedType: req?.details?.bedType || (caseItem?.quotas?.icuRequired ? 'ICU Bed' : (actualResourceType === 'icu' ? 'ICU Bed' : 'General Emergency Bed')),
          bloodGroup: req?.details?.bloodGroup || caseItem?.patientBloodGroup || 'O+',
          units: req?.details?.units || caseItem?.quotas?.bloodUnits || caseItem?.quotas?.bloodUnitsRequested || 1,
          cylinders: req?.details?.cylinders || caseItem?.quotas?.oxygenQuantity || caseItem?.quotas?.oxygenCylindersRequested || 1,
          vehicleType: req?.details?.vehicleType || caseItem?.quotas?.ambulanceType || 'ALS Ambulance',
          pickupAddress: caseItem?.location?.address || caseItem?.incidentAddress || 'Patient Incident Location',
          destinationAddress: item.role === 'hospital' ? providerName : (caseItem?.assignedHospitalName || providerName)
        },
        status: 'ASSIGNED',
        assignedAt: now,
        assignmentCoordinatorUid: coordinatorUid,
        createdAt: req?.createdAt || now,
        updatedAt: now
      };

      // 1. Update dataStore locally
      this.createRequest(assignedRequest);

      // 2. Real-Time Write to Firestore
      if (isFirebaseConfigured && db) {
        try {
          const reqRef = doc(db, 'requests', targetReqId);
          await setDoc(reqRef, {
            ...assignedRequest,
            createdAt: assignedRequest.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Also attempt formal assignment audit subcollection
          try {
            const auditRef = doc(collection(db, 'requests', targetReqId, 'assignmentHistory'));
            await setDoc(auditRef, {
              auditId: auditRef.id,
              requestId: targetReqId,
              caseId,
              resourceType: actualResourceType,
              previousProviderUid: req?.providerUid || '',
              previousProviderName: req?.providerName || '',
              newProviderUid: item.providerUid,
              newProviderName: providerName,
              coordinatorUid,
              coordinatorName,
              timestamp: serverTimestamp(),
              reason
            });
          } catch (auditErr) {
            console.warn('[assignCaseProviders] Audit history write notice:', auditErr);
          }

          // Write notification to Firestore for the assigned provider
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: item.providerUid,
              type: 'request_assigned',
              title: `Emergency ${actualResourceType.toUpperCase()} Request Assigned`,
              message: `Emergency case ${caseId} (${caseItem?.patientName || 'Emergency Patient'}) has been assigned to your facility for immediate response.`,
              details: reason,
              relatedCaseId: caseId,
              relatedRequestId: targetReqId,
              resourceType: actualResourceType,
              actorUid: coordinatorUid,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[assignCaseProviders] Provider Firestore notification write warning:', notifErr);
          }
        } catch (reqErr) {
          console.warn(`[assignCaseProviders] Firestore request write warning for ${targetReqId}:`, reqErr);
        }
      }

      this.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        recipientUid: item.providerUid,
        type: 'request_assigned',
        title: 'Emergency Case Assigned',
        message: `Emergency case ${caseId} has been assigned to your facility for dispatch.`,
        relatedCaseId: caseId,
        relatedRequestId: targetReqId,
        resourceType: actualResourceType,
        isRead: false,
        createdAt: now
      });

      if (caseItem) {
        if (!caseItem.serviceStatuses) caseItem.serviceStatuses = {} as any;
        if (!caseItem.individualStatuses) caseItem.individualStatuses = [];

        if (item.role === 'hospital') {
          caseItem.assignedHospitalUid = item.providerUid;
          caseItem.assignedHospitalName = providerName;
          (caseItem.serviceStatuses as any).hospital = 'Assigned';
        } else if (item.role === 'ambulanceProvider') {
          caseItem.assignedAmbulanceUid = item.providerUid;
          caseItem.assignedAmbulanceName = providerName;
          (caseItem.serviceStatuses as any).ambulance = 'Assigned';
        } else if (item.role === 'bloodBank') {
          caseItem.assignedBloodBankUid = item.providerUid;
          caseItem.assignedBloodBankName = providerName;
          (caseItem.serviceStatuses as any).blood = 'Assigned';
        } else if (item.role === 'oxygenProvider') {
          caseItem.assignedOxygenUid = item.providerUid;
          caseItem.assignedOxygenName = providerName;
          (caseItem.serviceStatuses as any).oxygen = 'Assigned';
        } else if (item.role === 'doctor') {
          (caseItem as any).assignedDoctorUid = item.providerUid;
          (caseItem as any).assignedDoctorName = providerName;
          (caseItem.serviceStatuses as any).doctor = 'Assigned';
        }

        const serviceKey = item.role === 'ambulanceProvider' ? 'ambulance' : (item.role === 'bloodBank' ? 'blood' : (item.role === 'oxygenProvider' ? 'oxygen' : (item.role === 'doctor' ? 'doctor' : 'hospital')));
        const existingInd = caseItem.individualStatuses.find((s) => s.resource?.toLowerCase().includes(serviceKey));
        if (existingInd) {
          existingInd.status = 'Assigned';
          existingInd.code = 'pending';
          existingInd.detail = `Assigned to ${providerName} (Awaiting provider response).`;
          existingInd.updatedAt = now;
        } else {
          caseItem.individualStatuses.push({
            resource: item.role === 'ambulanceProvider' ? 'Ambulance' : (item.role === 'bloodBank' ? 'Blood' : (item.role === 'oxygenProvider' ? 'Oxygen' : (item.role === 'doctor' ? 'Doctor' : 'Hospital Bed'))),
            status: 'Assigned',
            code: 'pending',
            detail: `Assigned to ${providerName} (Awaiting provider response).`,
            updatedAt: now
          });
        }
      }
    }

    if (caseItem) {
      caseItem.status = 'ASSIGNED';
      caseItem.updatedAt = now;
      if (!caseItem.auditHistory) caseItem.auditHistory = [];
      caseItem.auditHistory.push({
        id: 'audit-' + Date.now(),
        status: 'ASSIGNED',
        updatedByUid: coordinatorUid,
        updatedByName: coordinatorName,
        role: 'admin',
        timestamp: now,
        note: `Providers assigned: ${[
          caseItem.assignedHospitalName && `Hospital: ${caseItem.assignedHospitalName}`,
          caseItem.assignedAmbulanceName && `Ambulance: ${caseItem.assignedAmbulanceName}`,
          caseItem.assignedBloodBankName && `Blood: ${caseItem.assignedBloodBankName}`,
          caseItem.assignedOxygenName && `Oxygen: ${caseItem.assignedOxygenName}`
        ].filter(Boolean).join(', ')}`
      });
    }

    if (isFirebaseConfigured && db) {
      try {
        const caseRef = doc(db, 'cases', caseId);
        const updatePayload: Record<string, any> = {
          status: 'ASSIGNED',
          updatedAt: serverTimestamp()
        };
        if (caseItem?.assignedHospitalUid) {
          updatePayload.assignedHospitalUid = caseItem.assignedHospitalUid;
          updatePayload.assignedHospitalName = caseItem.assignedHospitalName;
        }
        if (caseItem?.assignedAmbulanceUid) {
          updatePayload.assignedAmbulanceUid = caseItem.assignedAmbulanceUid;
          updatePayload.assignedAmbulanceName = caseItem.assignedAmbulanceName;
        }
        if (caseItem?.assignedBloodBankUid) {
          updatePayload.assignedBloodBankUid = caseItem.assignedBloodBankUid;
          updatePayload.assignedBloodBankName = caseItem.assignedBloodBankName;
        }
        if (caseItem?.assignedOxygenUid) {
          updatePayload.assignedOxygenUid = caseItem.assignedOxygenUid;
          updatePayload.assignedOxygenName = caseItem.assignedOxygenName;
        }
        await updateDoc(caseRef, updatePayload);
      } catch (err) {
        console.warn('[assignCaseProviders] Firestore case update warning:', err);
      }
    }

    // Notify patient and attendant of provider assignment in Firestore & locally
    const patientRecipients = Array.from(new Set([caseItem?.patientUid, caseItem?.attendantUid, caseItem?.requesterUid].filter(Boolean))) as string[];
    const assignedList = [
      caseItem?.assignedHospitalName && `Hospital: ${caseItem.assignedHospitalName}`,
      caseItem?.assignedAmbulanceName && `Ambulance: ${caseItem.assignedAmbulanceName}`,
      caseItem?.assignedBloodBankName && `Blood: ${caseItem.assignedBloodBankName}`,
      caseItem?.assignedOxygenName && `Oxygen: ${caseItem.assignedOxygenName}`
    ].filter(Boolean).join(', ');

    for (const pUid of patientRecipients) {
      this.addNotification({
        id: `notif-${Date.now()}-${pUid.slice(-4)}`,
        recipientUid: pUid,
        type: 'case_assigned',
        title: `Emergency ${caseId}: Providers Assigned!`,
        message: `Healthcare providers assigned: ${assignedList || 'Facilities notified'}.`,
        relatedCaseId: caseId,
        isRead: false,
        createdAt: now
      });
      if (isFirebaseConfigured && db) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          void setDoc(notifRef, {
            id: notifRef.id,
            recipientUid: pUid,
            type: 'case_assigned',
            title: `Emergency ${caseId}: Providers Assigned`,
            message: `Healthcare providers assigned: ${assignedList || 'Facilities notified'}.`,
            emergencyId: caseId,
            relatedCaseId: caseId,
            isRead: false,
            createdAt: serverTimestamp()
          });
        } catch (e) {}
      }
    }

    this.saveState();
  }

  public async requestAdditionalResource(
    caseId: string,
    params: {
      resourceType: ResourceType;
      details: ResourceRequest['details'];
      urgency?: string;
      notes?: string;
    }
  ): Promise<ResourceRequest> {
    const caseItem = this.state.cases.find((c) => c.caseId === caseId);
    const now = new Date().toISOString();
    const requestId = `REQ-${caseId}-${params.resourceType}-${Date.now().toString(36)}`;
    const requesterUid = auth.currentUser?.uid || caseItem?.requesterUid || '';

    const newRequest: ResourceRequest = {
      requestId,
      caseId,
      patientUid: caseItem?.patientUid || requesterUid,
      requesterUid,
      patientName: caseItem?.patientName || 'Emergency Patient',
      providerUid: '',
      providerName: 'Pending Admin Assignment',
      resourceType: params.resourceType,
      details: {
        ...params.details,
        urgency: params.urgency || caseItem?.urgencyLevel || 'urgent',
        notes: params.notes || params.details?.notes || ''
      },
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now
    };

    if (isFirebaseConfigured && db && auth.currentUser) {
      try {
        const directorySnapshot = await getDocs(collection(db, 'providerDirectory'));
        const roleByResource: Record<ResourceType, UserRole> = {
          bed: 'hospital',
          icu: 'hospital',
          hospital_admission: 'hospital',
          blood: 'bloodBank',
          oxygen: 'oxygenProvider',
          ambulance: 'ambulanceProvider',
          doctor: 'doctor',
          doctor_assistance: 'doctor'
        };
        const requiredRole = roleByResource[params.resourceType];
        const candidate = directorySnapshot.docs
          .map((d) => d.data() as ProviderDirectoryEntry)
          .find((p) => p.role === requiredRole && p.isActive && p.isVerified);

        const requestDocRef = doc(db, 'requests', requestId);
        await setDoc(requestDocRef, {
          ...newRequest,
          providerUid: candidate?.uid || 'pending_coordinator_assignment',
          providerName: candidate?.displayName || 'Pending Admin Assignment',
          status: 'REQUESTED',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('[requestAdditionalResource] Firestore request write warning:', err);
      }
    }

    this.createRequest(newRequest);

    if (caseItem) {
      if (!caseItem.resourcesNeeded) caseItem.resourcesNeeded = [];
      if (!caseItem.resourcesNeeded.includes(params.resourceType)) {
        caseItem.resourcesNeeded.push(params.resourceType);
      }
      if (!caseItem.individualStatuses) caseItem.individualStatuses = [];
      const resourceLabels: Record<string, string> = {
        bed: 'Hospital Bed',
        icu: 'ICU Bed',
        blood: 'Blood Supply',
        oxygen: 'Oxygen Support',
        ambulance: 'Ambulance',
        doctor: 'Doctor Consultation'
      };
      caseItem.individualStatuses.push({
        resource: resourceLabels[params.resourceType] || params.resourceType,
        detail: params.notes || `Additional ${params.resourceType} requested`,
        status: 'Pending Admin Assignment'
      });
      caseItem.updatedAt = now;
      this.saveState();
    }

    return newRequest;
  }

  public async transitionEmergencyCaseStatus(
    caseId: string,
    nextStatus: EmergencyLifecycleStatus,
    reason?: string
  ): Promise<void> {
    const coordinatorUid = auth?.currentUser?.uid || 'admin-coordinator';
    const normalizedReason = reason?.trim() || '';
    if ((nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') && normalizedReason.length < 5) {
      throw new Error('A reason of at least five characters is required for rejection or cancellation.');
    }

    if (isFirebaseConfigured && db && auth?.currentUser) {

    const caseRef = doc(db, 'cases', caseId);
    const coordinatorRef = doc(db, 'users', coordinatorUid);
    const caseEventId = doc(collection(db, 'cases', caseId, 'statusHistory')).id;
    const transitionTimestamp = serverTimestamp();
    const requestDocuments = nextStatus === 'REJECTED' || nextStatus === 'CANCELLED'
      ? (await getDocs(query(collection(db, 'requests'), where('caseId', '==', caseId)))).docs
      : [];

    await runTransaction(db, async (transaction) => {
      const [caseSnapshot, coordinatorSnapshot] = await Promise.all([
        transaction.get(caseRef),
        transaction.get(coordinatorRef)
      ]);
      const requestSnapshots = await Promise.all(
        requestDocuments.map((requestDocument) => transaction.get(requestDocument.ref))
      );
      if (!caseSnapshot.exists()) {
        throw new Error('This emergency case no longer exists. Refresh and try again.');
      }
      const coordinator = coordinatorSnapshot.data();
      if (!coordinatorSnapshot.exists() || coordinator?.role !== 'admin' || coordinator?.isActive !== true) {
        throw new Error('Only an active, authenticated coordinator can update the emergency lifecycle.');
      }

      const emergencyCase = caseSnapshot.data();
      const patientUid = emergencyCase.patientUid;
      if (typeof patientUid !== 'string' || !patientUid) {
        throw new Error('This emergency case has no valid patient account.');
      }
      const previousStatus = String(emergencyCase.status || '');
      if (!getAllowedEmergencyCaseTransitions(previousStatus).includes(nextStatus)) {
        throw new Error(`The emergency cannot transition from ${previousStatus || 'unknown'} to ${nextStatus}.`);
      }

      const caseEvent = {
        eventId: caseEventId,
        eventType: 'case_status',
        previousStatus,
        newStatus: nextStatus,
        updatedByUid: coordinatorUid,
        userRole: coordinator.role,
        timestamp: transitionTimestamp,
        ...(normalizedReason ? { reason: normalizedReason } : {})
      };
      transaction.update(caseRef, {
        status: nextStatus,
        updatedAt: transitionTimestamp,
        lastLifecycleEventId: caseEventId,
        [`lifecycleHistory.${caseEventId}`]: caseEvent,
        rejectionReason: nextStatus === 'REJECTED' ? normalizedReason : deleteField(),
        cancellationReason: nextStatus === 'CANCELLED' ? normalizedReason : deleteField()
      });
      requestSnapshots.forEach((requestSnapshot) => {
        if (!requestSnapshot.exists()) return;
        const request = requestSnapshot.data();
        const requestStatus = String(request.status || '');
        if (['COMPLETED', 'REJECTED', 'CANCELLED', 'completed', 'rejected', 'cancelled'].includes(requestStatus)) return;
        const requestEventId = doc(collection(db, 'requests', requestSnapshot.id, 'statusHistory')).id;
        const requestEvent = {
          eventId: requestEventId,
          eventType: 'request_status',
          previousStatus: requestStatus,
          newStatus: nextStatus,
          updatedByUid: coordinatorUid,
          userRole: coordinator.role,
          timestamp: transitionTimestamp,
          reason: normalizedReason,
          requestId: requestSnapshot.id,
          resourceType: request.resourceType
        };
        transaction.update(requestSnapshot.ref, {
          status: nextStatus,
          updatedAt: transitionTimestamp,
          lastStatusEventId: requestEventId,
          [`statusHistory.${requestEventId}`]: requestEvent,
          rejectionReason: nextStatus === 'REJECTED' ? normalizedReason : deleteField(),
          cancellationReason: nextStatus === 'CANCELLED' ? normalizedReason : deleteField()
        });
      });
    });
  }

    // 2. Synchronize local DataStore state and notify patient / attendant
    const nowIso = new Date().toISOString();
    const existingCase = this.state.cases.find((c) => c.caseId === caseId);
    if (existingCase) {
      existingCase.status = nextStatus;
      existingCase.updatedAt = nowIso;
      if (normalizedReason && nextStatus === 'REJECTED') existingCase.rejectionReason = normalizedReason;
      if (normalizedReason && nextStatus === 'CANCELLED') existingCase.cancellationReason = normalizedReason;
      if (!existingCase.auditHistory) existingCase.auditHistory = [];
      existingCase.auditHistory.push({
        id: 'audit-' + Date.now(),
        status: nextStatus,
        updatedByUid: coordinatorUid,
        updatedByName: 'Central Coordinator',
        role: 'admin',
        timestamp: nowIso,
        reason: normalizedReason
      });
    }

    // Update local requests linked to this case
    this.state.requests
      .filter((r) => r.caseId === caseId && !['COMPLETED', 'completed', 'CANCELLED', 'cancelled', 'REJECTED', 'rejected'].includes(r.status))
      .forEach((r) => {
        r.status = nextStatus as any;
        r.updatedAt = nowIso;
      });

    // Notify patient & attendant
    const recipientUids = Array.from(new Set([existingCase?.patientUid, existingCase?.attendantUid, existingCase?.requesterUid].filter(Boolean))) as string[];
    for (const rUid of recipientUids) {
      this.addNotification({
        id: `notif-${Date.now()}-${rUid.slice(-4)}`,
        recipientUid: rUid,
        type: 'case_updated',
        title: `Emergency Case ${caseId}: ${nextStatus.replace('_', ' ')}`,
        message: `Your emergency status was updated to "${nextStatus.replace('_', ' ')}"${normalizedReason ? ` - Note: ${normalizedReason}` : ''}.`,
        relatedCaseId: caseId,
        isRead: false,
        createdAt: nowIso
      });
      if (isFirebaseConfigured && db) {
        try {
          const notifRef = doc(collection(db, 'notifications'));
          void setDoc(notifRef, {
            id: notifRef.id,
            recipientUid: rUid,
            type: 'case_updated',
            title: `Emergency Case ${caseId} Status Updated`,
            message: `Emergency status updated to ${nextStatus.replace('_', ' ')}${normalizedReason ? ` (${normalizedReason})` : ''}`,
            emergencyId: caseId,
            relatedCaseId: caseId,
            isRead: false,
            createdAt: serverTimestamp()
          });
        } catch (e) {}
      }
    }
    this.saveState();
  }

  public async getEmergencyTimelineFromFirestore(caseId: string): Promise<EmergencyLifecycleEvent[]> {
    if (!isFirebaseConfigured || !db || !auth?.currentUser) {
      const localCase = this.state.cases.find((c) => c.caseId === caseId);
      if (!localCase) return [];
      const events: EmergencyLifecycleEvent[] = [];
      (localCase.auditHistory || []).forEach((audit) => {
        events.push({
          eventId: audit.id || `audit-${audit.timestamp}`,
          eventType: 'case_status',
          previousStatus: 'Unknown',
          newStatus: audit.status || 'Status updated',
          updatedByUid: audit.updatedByUid || 'admin-coordinator',
          userRole: audit.role || 'admin',
          timestamp: audit.timestamp || new Date().toISOString(),
          reason: audit.reason || audit.note
        });
      });
      return events;
    }
    const caseSnapshot = await getDoc(doc(db, 'cases', caseId));
    if (!caseSnapshot.exists()) throw new Error('This emergency case no longer exists.');
    const caseData = caseSnapshot.data();
    const events = Object.values(normalizeLifecycleHistory(caseData.lifecycleHistory) || {});
    (Array.isArray(caseData.auditHistory) ? caseData.auditHistory : []).forEach((legacyAudit) => {
      if (!legacyAudit || typeof legacyAudit !== 'object') return;
      const audit = legacyAudit as Record<string, unknown>;
      if (typeof audit.timestamp !== 'string') return;
      events.push({
        eventId: String(audit.id || `legacy-${audit.timestamp}`),
        eventType: 'case_status',
        previousStatus: 'Unknown',
        newStatus: String(audit.status || 'Status updated'),
        updatedByUid: String(audit.updatedByUid || ''),
        userRole: String(audit.role || 'unknown'),
        timestamp: audit.timestamp,
        ...(typeof audit.reason === 'string' ? { reason: audit.reason } : {})
      });
    });
    const requestSnapshot = await getDocs(
      query(collection(db, 'requests'), where('caseId', '==', caseId))
    );

    for (const requestDocument of requestSnapshot.docs) {
      const request = requestDocument.data();
      events.push(...Object.values(normalizeLifecycleHistory(request.statusHistory) || {}));
      const assignmentSnapshot = await getDocs(
        collection(db, 'requests', requestDocument.id, 'assignmentHistory')
      );
      assignmentSnapshot.docs.forEach((auditDocument) => {
        const audit = auditDocument.data();
        events.push({
          eventId: auditDocument.id,
          eventType: 'assignment',
          previousStatus: String(request.status || 'REQUESTED'),
          newStatus: String(request.status || 'REQUESTED'),
          updatedByUid: audit.coordinatorUid || '',
          userRole: 'admin',
          timestamp: firestoreDateToIso(audit.timestamp),
          reason: audit.reason,
          requestId: requestDocument.id,
          resourceType: request.resourceType,
          previousProviderUid: audit.previousProviderUid || '',
          newProviderUid: audit.newProviderUid || '',
          previousProviderName: audit.previousProviderName || '',
          newProviderName: audit.newProviderName || ''
        });
      });
    }
    return events.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  }

  public subscribeToEmergencyHistory(
    patientUid: string,
    onCases: (cases: EmergencyCase[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Emergency history requires a configured Firebase project.');
      return () => undefined;
    }

    const casesByPatient = new Map<string, Map<string, EmergencyCase>>();
    const requestsByPatient = new Map<string, Map<string, ResourceRequest[]>>();
    const caseSubscriptions = new Map<string, Unsubscribe>();
    const requestSubscriptions = new Map<string, Unsubscribe>();
    const loadedCasePatients = new Set<string>();
    const loadedRequestPatients = new Set<string>();
    let activeLinksLoaded = false;
    const emitCases = () => {
      if (!activeLinksLoaded || [...caseSubscriptions.keys()].some((uid) =>
        !loadedCasePatients.has(uid) || !loadedRequestPatients.has(uid)
      )) return;
      const cases = [...casesByPatient.values()]
        .flatMap((patientCases) => [...patientCases.values()])
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onCases(cases);
    };
    const applyRequestsToCases = (linkedPatientUid: string) => {
      const requestGroups = requestsByPatient.get(linkedPatientUid) || new Map<string, ResourceRequest[]>();
      casesByPatient.get(linkedPatientUid)?.forEach((caseRecord) => {
        caseRecord.resourceRequests = requestGroups.get(caseRecord.caseId) || [];
      });
    };
    const subscribeToPatientCases = (linkedPatientUid: string) => {
      if (caseSubscriptions.has(linkedPatientUid)) return;
      const patientCases = new Map<string, EmergencyCase>();
      casesByPatient.set(linkedPatientUid, patientCases);
      const casesQuery = query(collection(db, 'cases'), where('patientUid', '==', linkedPatientUid));
      const unsubscribe = onSnapshot(casesQuery, (snapshot) => {
        try {
          patientCases.clear();
          snapshot.docs.forEach((caseSnapshot) => {
            const caseRecord = normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id);
            patientCases.set(caseRecord.caseId, caseRecord);
          });
          applyRequestsToCases(linkedPatientUid);
          loadedCasePatients.add(linkedPatientUid);
          emitCases();
        } catch (error) {
          onError(error instanceof Error ? error.message : 'An emergency record could not be read.');
        }
      }, (error) => {
        onError(`Could not load emergency history: ${error.message}`);
      });
      caseSubscriptions.set(linkedPatientUid, unsubscribe);

      const patientRequests = new Map<string, ResourceRequest[]>();
      requestsByPatient.set(linkedPatientUid, patientRequests);
      const requestsQuery = query(collection(db, 'requests'), where('patientUid', '==', linkedPatientUid));
      const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
        try {
          patientRequests.clear();
          snapshot.docs.forEach((requestSnapshot) => {
            const requestRecord = normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id);
            const caseRequests = patientRequests.get(requestRecord.caseId) || [];
            caseRequests.push(requestRecord);
            patientRequests.set(requestRecord.caseId, caseRequests);
          });
          applyRequestsToCases(linkedPatientUid);
          loadedRequestPatients.add(linkedPatientUid);
          emitCases();
        } catch (error) {
          onError(error instanceof Error ? error.message : 'A resource request status could not be read.');
        }
      }, (error) => {
        onError(`Could not load emergency resource statuses: ${error.message}`);
      });
      requestSubscriptions.set(linkedPatientUid, unsubscribeRequests);
    };

    subscribeToPatientCases(patientUid);
    const linksQuery = query(
      collectionGroup(db, 'attendants'),
      where('attendantUid', '==', patientUid),
      where('activeConsent', '==', true)
    );
    const unsubscribeLinks = onSnapshot(linksQuery, (snapshot) => {
      const linkedPatientUids = new Set(
        snapshot.docs
          .map((linkSnapshot) => linkSnapshot.data().patientUid)
          .filter((linkedPatientUid): linkedPatientUid is string =>
            typeof linkedPatientUid === 'string' && linkedPatientUid !== patientUid
          )
      );
      activeLinksLoaded = true;

      caseSubscriptions.forEach((unsubscribe, linkedPatientUid) => {
        if (linkedPatientUid !== patientUid && !linkedPatientUids.has(linkedPatientUid)) {
          unsubscribe();
          requestSubscriptions.get(linkedPatientUid)?.();
          requestSubscriptions.delete(linkedPatientUid);
          caseSubscriptions.delete(linkedPatientUid);
          casesByPatient.delete(linkedPatientUid);
          requestsByPatient.delete(linkedPatientUid);
          loadedCasePatients.delete(linkedPatientUid);
          loadedRequestPatients.delete(linkedPatientUid);
        }
      });
      linkedPatientUids.forEach(subscribeToPatientCases);
      emitCases();
    }, (error) => {
      onError(`Could not load linked-patient history: ${error.message}`);
    });

    return () => {
      unsubscribeLinks();
      caseSubscriptions.forEach((unsubscribe) => unsubscribe());
      requestSubscriptions.forEach((unsubscribe) => unsubscribe());
      caseSubscriptions.clear();
      requestSubscriptions.clear();
      casesByPatient.clear();
      requestsByPatient.clear();
    };
  }

  public subscribeToPatientAttendants(
    patientUid: string,
    onLinks: (links: PatientAttendantLink[]) => void,
    onError: (message: string) => void
  ): Unsubscribe {
    if (!isFirebaseConfigured || !db) {
      onError('Attendant consent management requires a configured Firebase project.');
      return () => undefined;
    }

    return onSnapshot(collection(db, 'users', patientUid, 'attendants'), (snapshot) => {
      onLinks(snapshot.docs.map((linkSnapshot) => {
        const data = linkSnapshot.data();
        return {
          attendantUid: data.attendantUid || linkSnapshot.id,
          activeConsent: data.activeConsent === true,
          updatedAt: firestoreDateToIso(data.updatedAt)
        };
      }));
    }, (error) => {
      onError(`Could not load attendant consent settings: ${error.message}`);
    });
  }

  public async setPatientAttendantConsent(
    patientUid: string,
    attendantUid: string,
    activeConsent: boolean
  ): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      throw new Error('Attendant consent management requires a configured Firebase project.');
    }
    if (!auth.currentUser || auth.currentUser.uid !== patientUid) {
      throw new Error('Only the signed-in patient can manage attendant consent.');
    }
    if (!attendantUid.trim() || attendantUid === patientUid) {
      throw new Error('Enter a different patient’s registered CareBridge account UID.');
    }

    const linkRef = doc(db, 'users', patientUid, 'attendants', attendantUid);
    const existingLink = await getDoc(linkRef);
    if (!activeConsent && !existingLink.exists()) {
      throw new Error('There is no active attendant link to revoke.');
    }

    await setDoc(linkRef, {
      patientUid,
      attendantUid,
      activeConsent,
      ...(activeConsent ? { grantedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  public createCase(newCase: EmergencyCase) {
    // Check if case already exists in local list
    const existingIdx = this.state.cases.findIndex((c) => c.caseId === newCase.caseId);
    if (existingIdx >= 0) {
      this.state.cases[existingIdx] = { ...newCase, updatedAt: new Date().toISOString() };
    } else {
      this.state.cases.unshift(newCase);
    }
    this.saveState();
  }

  public async createEmergencySubmission(
    emergencyCase: EmergencyCase,
    requestDrafts: ResourceRequestDraft[],
    city: string
  ): Promise<{ requests: ResourceRequest[]; hospitalName: string; alreadySubmitted: boolean }> {
    const requesterUid = auth?.currentUser?.uid || emergencyCase.requesterUid || emergencyCase.patientUid || 'patient-demo-01';
    const requesterRole = emergencyCase.requesterRole || 'patient';

    // 1. Idempotency Check in Local Store
    const existingLocal = this.getCase(emergencyCase.caseId);
    if (existingLocal) {
      const existingReqs = this.getRequests().filter((r) => r.caseId === emergencyCase.caseId);
      return {
        requests: existingReqs,
        hospitalName: existingLocal.matchedHospitalName || 'KIMS Super Specialty Hospital',
        alreadySubmitted: true
      };
    }

    // 2. Resolve Providers from Firestore and/or Local Store
    let providers: (ProviderDirectoryEntry & { directoryUid: string })[] = [];
    if (isFirebaseConfigured && db) {
      try {
        const directorySnapshot = await getDocs(collection(db, 'providerDirectory'));
        providers = directorySnapshot.docs
          .map((snapshot) => ({
            ...snapshot.data(),
            directoryUid: snapshot.id
          }) as ProviderDirectoryEntry & { directoryUid: string })
          .filter((provider) =>
            provider.displayName &&
            PROVIDER_ROLES.includes(provider.role)
          );
      } catch (err) {
        console.warn('[CareBridge] Error reading providerDirectory from Firestore:', err);
      }
    }

    const localHospitals = this.getAllHospitalProfiles();
    const localBloods = this.getAllBloodBankProfiles();
    const localOxygens = this.getAllOxygenProfiles();
    const localAmbulances = this.getAllAmbulanceProfiles();
    const localUsers = this.getUsers().filter((u) => PROVIDER_ROLES.includes(u.role));

    // Seed missing entries to Firestore providerDirectory if empty
    if (isFirebaseConfigured && db && providers.length === 0) {
      localHospitals.forEach((h) => {
        void setDoc(doc(db, 'providerDirectory', h.uid), {
          uid: h.uid,
          role: 'hospital',
          displayName: h.hospitalName,
          city: h.city,
          state: h.state,
          isActive: true,
          isVerified: true
        }, { merge: true });
      });
      localBloods.forEach((b) => {
        void setDoc(doc(db, 'providerDirectory', b.uid), {
          uid: b.uid,
          role: 'bloodBank',
          displayName: b.bankName,
          city: b.city,
          state: b.state,
          isActive: true,
          isVerified: true
        }, { merge: true });
      });
      localOxygens.forEach((o) => {
        void setDoc(doc(db, 'providerDirectory', o.uid), {
          uid: o.uid,
          role: 'oxygenProvider',
          displayName: o.providerName,
          city: o.city,
          state: o.state,
          isActive: true,
          isVerified: true
        }, { merge: true });
      });
      localAmbulances.forEach((a) => {
        void setDoc(doc(db, 'providerDirectory', a.uid), {
          uid: a.uid,
          role: 'ambulanceProvider',
          displayName: a.providerName,
          city: a.city,
          state: a.state,
          isActive: true,
          isVerified: true
        }, { merge: true });
      });
    }

    // Merge local providers into candidates pool
    localHospitals.forEach((h) => {
      if (!providers.some((p) => p.uid === h.uid)) {
        providers.push({
          uid: h.uid,
          directoryUid: h.uid,
          role: 'hospital',
          displayName: h.hospitalName,
          city: h.city,
          state: h.state,
          isActive: true,
          isVerified: true
        });
      }
    });
    localBloods.forEach((b) => {
      if (!providers.some((p) => p.uid === b.uid)) {
        providers.push({
          uid: b.uid,
          directoryUid: b.uid,
          role: 'bloodBank',
          displayName: b.bankName,
          city: b.city,
          state: b.state,
          isActive: true,
          isVerified: true
        });
      }
    });
    localOxygens.forEach((o) => {
      if (!providers.some((p) => p.uid === o.uid)) {
        providers.push({
          uid: o.uid,
          directoryUid: o.uid,
          role: 'oxygenProvider',
          displayName: o.providerName,
          city: o.city,
          state: o.state,
          isActive: true,
          isVerified: true
        });
      }
    });
    localAmbulances.forEach((a) => {
      if (!providers.some((p) => p.uid === a.uid)) {
        providers.push({
          uid: a.uid,
          directoryUid: a.uid,
          role: 'ambulanceProvider',
          displayName: a.providerName,
          city: a.city,
          state: a.state,
          isActive: true,
          isVerified: true
        });
      }
    });
    localUsers.forEach((u) => {
      if (!providers.some((p) => p.uid === u.uid)) {
        providers.push({
          uid: u.uid,
          directoryUid: u.uid,
          role: u.role,
          displayName: u.displayName || u.email,
          city: u.city,
          state: u.state,
          isActive: true,
          isVerified: true
        });
      }
    });

    const normalizedCity = city.trim().toLocaleLowerCase();
    const byRole = (role: UserRole) =>
      providers
        .filter((provider) => provider.role === role)
        .sort((a, b) => {
          const aMatchesCity = (a.city || '').trim().toLocaleLowerCase() === normalizedCity;
          const bMatchesCity = (b.city || '').trim().toLocaleLowerCase() === normalizedCity;
          return Number(bMatchesCity) - Number(aMatchesCity) || a.uid.localeCompare(b.uid);
        });

    const hospitalProvider = byRole('hospital')[0] || {
      uid: INITIAL_HOSPITAL.uid,
      displayName: INITIAL_HOSPITAL.hospitalName,
      role: 'hospital' as UserRole
    };

    const now = new Date().toISOString();
    const requests = requestDrafts.map((draft) => {
      const candidates = byRole(draft.providerRole);
      let provider = draft.providerRole === 'doctor'
        ? candidates.find((candidate) =>
            candidate.hospitalAffiliation?.trim().toLocaleLowerCase() ===
            hospitalProvider.displayName.trim().toLocaleLowerCase()
          ) || candidates[0]
        : candidates[0];

      if (!provider) {
        provider = {
          uid: 'pending_coordinator_assignment',
          displayName: 'Pending Coordinator Assignment',
          role: draft.providerRole
        } as any;
      }

      const requestId = `REQ-${emergencyCase.caseId}-${draft.resourceType}`;
      return {
        ref: isFirebaseConfigured && db ? doc(db, 'requests', requestId) : null,
        request: {
          requestId,
          caseId: emergencyCase.caseId,
          patientUid: emergencyCase.patientUid,
          requesterUid,
          patientName: emergencyCase.patientName,
          providerUid: provider.uid,
          providerName: provider.displayName,
          resourceType: draft.resourceType,
          details: draft.resourceType === 'ambulance'
            ? { ...draft.details, destinationAddress: hospitalProvider.displayName }
            : draft.details,
          status: 'REQUESTED' as const,
          createdAt: now,
          updatedAt: now
        }
      };
    });

    // 3. Firestore Real-Time Persistence
    if (isFirebaseConfigured && db) {
      try {
        const caseRef = doc(db, 'cases', emergencyCase.caseId);
        const caseDoc: Record<string, any> = {
          ...emergencyCase,
          status: 'REQUESTED',
          requesterUid,
          requesterRole,
          matchedHospitalName: hospitalProvider.displayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        // Remove undefined keys
        Object.keys(caseDoc).forEach((key) => {
          if (caseDoc[key] === undefined) delete caseDoc[key];
        });
        if (caseDoc.attendant && typeof caseDoc.attendant === 'object') {
          Object.keys(caseDoc.attendant).forEach((key) => {
            if (caseDoc.attendant[key] === undefined) delete caseDoc.attendant[key];
          });
        }
        await setDoc(caseRef, caseDoc, { merge: true });

        // Save requests
        for (const { ref, request } of requests) {
          if (ref) {
            await setDoc(ref, {
              ...request,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }

        // Emit notifications to Central Coordinators / Admins in Firestore
        const adminUsers = this.state.users.filter((u) => u.role === 'admin');
        const adminUids = adminUsers.length > 0 ? adminUsers.map((u) => u.uid) : ['admin-demo-01', 'admin-coordinator'];
        for (const adminUid of adminUids) {
          try {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              id: notifRef.id,
              recipientUid: adminUid,
              type: 'case_created',
              title: `🚨 Emergency Request: ${emergencyCase.patientName}`,
              message: `New critical emergency (${emergencyCase.caseId}) for ${emergencyCase.patientName} (${emergencyCase.patientAge}y) requiring ${emergencyCase.requiredServices?.join(', ') || 'emergency resources'}.`,
              relatedCaseId: emergencyCase.caseId,
              emergencyId: emergencyCase.caseId,
              isRead: false,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('[CareBridge] Failed to write Firestore notification for admin:', notifErr);
          }
        }
      } catch (firestoreErr) {
        console.warn('[CareBridge] Firestore save error in createEmergencySubmission (local state preserved):', firestoreErr);
      }
    }

    // 4. Update Local Reactive Store
    const isSelfSubmission = requesterUid === emergencyCase.patientUid;
    const savedCase: EmergencyCase = {
      ...emergencyCase,
      status: 'REQUESTED' as const,
      requesterUid,
      requesterRole,
      attendantUid: isSelfSubmission ? emergencyCase.attendantUid : requesterUid,
      matchedHospitalName: hospitalProvider.displayName,
      requestCount: requests.length,
      createdAt: now,
      updatedAt: now
    };

    this.createCase(savedCase);
    requests.forEach(({ request }) => this.createRequest(request));

    // Emit local notifications for admins
    const adminUsers = this.state.users.filter((u) => u.role === 'admin');
    const adminUids = adminUsers.length > 0 ? adminUsers.map((u) => u.uid) : ['admin-demo-01', 'admin-coordinator'];
    adminUids.forEach((adminUid) => {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        recipientUid: adminUid,
        type: 'case_created',
        title: `🚨 Emergency Request: ${emergencyCase.patientName}`,
        message: `New critical emergency (${emergencyCase.caseId}) for ${emergencyCase.patientName} (${emergencyCase.patientAge}y) requiring ${emergencyCase.requiredServices?.join(', ') || 'emergency resources'}.`,
        relatedCaseId: emergencyCase.caseId,
        isRead: false,
        createdAt: now
      });
    });

    this.saveState();

    return {
      requests: requests.map(({ request }) => request),
      hospitalName: hospitalProvider.displayName,
      alreadySubmitted: false
    };
  }

  public updateCaseStatus(
    caseId: string,
    status: CaseStatus,
    updater?: { uid: string; name: string; role: string; note?: string; reason?: string }
  ) {
    const item = this.state.cases.find((c) => c.caseId === caseId);
    if (item) {
      item.status = status;
      item.updatedAt = new Date().toISOString();
      if (updater?.reason) {
        if (status === 'REJECTED') item.rejectionReason = updater.reason;
        if (status === 'cancelled') item.cancellationReason = updater.reason;
      }

      if (!item.auditHistory) item.auditHistory = [];
      item.auditHistory.push({
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        status,
        updatedByUid: updater?.uid || 'system',
        updatedByName: updater?.name || 'CareBridge Coordinator',
        role: updater?.role || 'admin',
        timestamp: new Date().toISOString(),
        note: updater?.note,
        reason: updater?.reason
      });

      if (status === 'cancelled' || status === 'REJECTED') {
        // Automatically cancel any pending requests
        this.state.requests
          .filter((r) => r.caseId === caseId && (r.status === 'pending' || r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'))
          .forEach((r) => {
            r.status = 'cancelled';
            r.updatedAt = new Date().toISOString();
          });
      }

      // Notify patient and attendant of emergency status progress
      const recipients = Array.from(new Set([item.patientUid, item.attendantUid, item.attendant?.uid].filter(Boolean))) as string[];
      recipients.forEach((recipUid) => {
        this.addNotification({
          id: 'notif-' + Date.now() + '-' + recipUid.slice(-4),
          recipientUid: recipUid,
          type: 'system_alert',
          title: `Emergency ${item.caseId} Status: ${String(status).replace('_', ' ')}`,
          message: `Case condition status updated to "${String(status).replace('_', ' ')}"${updater?.note ? ` - ${updater.note}` : ''}.`,
          relatedCaseId: item.caseId,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });

      this.saveState();
    }
  }

  // --- Resource Requests ---
  public getRequests(): ResourceRequest[] {
    return [...this.state.requests];
  }

  public getRequestsForCase(caseId: string): ResourceRequest[] {
    return this.state.requests.filter((r) => r.caseId === caseId);
  }

  public getRequestsForProvider(providerUid: string): ResourceRequest[] {
    return this.state.requests.filter((r) => r.providerUid === providerUid);
  }

  public replaceRequestsForProvider(providerUid: string, requests: ResourceRequest[]) {
    const requestIds = new Set(requests.map((request) => request.requestId));
    this.state.requests = [
      ...requests,
      ...this.state.requests.filter((request) =>
        request.providerUid !== providerUid && !requestIds.has(request.requestId)
      )
    ];
    this.saveState();
  }

  public createRequest(req: ResourceRequest) {
    const isNewRequest = !this.state.requests.some((request) => request.requestId === req.requestId);
    this.state.requests = this.state.requests.filter((request) => request.requestId !== req.requestId);
    this.state.requests.unshift(req);
    // Increment case request count
    const parentCase = this.state.cases.find((c) => c.caseId === req.caseId);
    if (parentCase && isNewRequest) {
      parentCase.requestCount = (parentCase.requestCount || 0) + 1;
      parentCase.updatedAt = new Date().toISOString();
    }

    // Notify Provider
    if (isNewRequest) this.state.notifications.unshift({
      id: 'notif-' + Date.now(),
      recipientUid: req.providerUid,
      type: 'request_received',
      title: `Emergency ${req.resourceType.toUpperCase()} Request`,
      message: `Incoming request for case ${req.caseId} (${req.patientName || 'Patient'}).`,
      relatedCaseId: req.caseId,
      relatedRequestId: req.requestId,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    this.saveState();
  }

  public respondToRequest(requestId: string, status: 'accepted' | 'rejected' | 'completed', reason?: string) {
    const req = this.state.requests.find((r) => r.requestId === requestId);
    if (!req) return;

    req.status = status;
    req.respondedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();
    if (reason) req.rejectionReason = reason;

    // Side effect 1: If hospital accepts admission, decrement available bed
    if (status === 'accepted' && (req.resourceType === 'bed' || req.resourceType === 'icu' || req.resourceType === 'hospital_admission')) {
      const hosp = this.getHospitalProfile(req.providerUid) || this.state.hospitalProfiles[req.providerUid];
      if (hosp) {
        if (req.details?.bedType?.toLowerCase().includes('icu') || req.resourceType === 'icu') {
          hosp.availableICU = Math.max(0, hosp.availableICU - 1);
        } else {
          hosp.availableBeds = Math.max(0, hosp.availableBeds - 1);
        }
        hosp.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 2: If blood bank accepts, decrement inventory
    if (status === 'accepted' && req.resourceType === 'blood' && req.details.bloodGroup) {
      const bb = this.getBloodBankProfile(req.providerUid) || this.state.bloodBankProfiles[req.providerUid];
      const bg = req.details.bloodGroup as keyof typeof bb.inventory;
      if (bb && bb.inventory && bb.inventory[bg]) {
        const units = req.details.units || 1;
        bb.inventory[bg] = Math.max(0, bb.inventory[bg] - units);
        bb.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 3: If oxygen provider accepts, decrement cylinder count
    if (status === 'accepted' && req.resourceType === 'oxygen') {
      const oxy = this.getOxygenProfile(req.providerUid) || this.state.oxygenProfiles[req.providerUid];
      if (oxy) {
        const cyl = req.details.cylinders || 1;
        oxy.cylindersAvailable = Math.max(0, oxy.cylindersAvailable - cyl);
        oxy.lastUpdated = new Date().toISOString();
      }
    }

    // Side effect 4: If ambulance provider accepts, create/activate AmbulanceTrip!
    if (status === 'accepted' && req.resourceType === 'ambulance') {
      const amb = this.getAmbulanceProfile(req.providerUid) || this.state.ambulanceProfiles[req.providerUid];
      const availableVehicle = amb?.vehicles.find((v) => v.isAvailable) || amb?.vehicles[0];

      if (availableVehicle) {
        availableVehicle.isAvailable = false;
        availableVehicle.currentStatus = 'on_trip';
      }

      const newTrip: AmbulanceTrip = {
        tripId: 'TRIP-' + Date.now().toString().slice(-6),
        requestId: req.requestId,
        caseId: req.caseId,
        patientUid: req.patientUid,
        providerUid: req.providerUid,
        vehicleId: availableVehicle?.vehicleId || 'KA-25-EM-1081',
        vehicleType: availableVehicle?.vehicleType || 'ALS Ambulance',
        driverName: availableVehicle?.driverName || 'Ramesh Patil',
        driverPhone: availableVehicle?.driverPhone || '+91 98452 11081',
        pickupLocation: {
          address: req.details.pickupAddress || 'Patient Incident Location',
          city: 'Hubballi'
        },
        destinationLocation: {
          address: req.details.destinationAddress || 'Assigned Hospital Emergency Wing',
          city: 'Hubballi'
        },
        status: 'dispatched',
        statusHistory: [
          { status: 'dispatched', timestamp: new Date().toISOString(), note: 'Trip dispatched by ambulance provider' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.state.trips.unshift(newTrip);
    }

    // Check if parent case needs lifecycle advancement
    const parentCase = this.state.cases.find((c) => c.caseId === req.caseId);
    if (parentCase) {
      if (!parentCase.serviceStatuses) parentCase.serviceStatuses = {} as any;
      if (!parentCase.individualStatuses) parentCase.individualStatuses = [];

      const resourceKeyMap: Record<string, string> = {
        bed: 'hospital',
        icu: 'hospital',
        hospital_admission: 'hospital',
        ambulance: 'ambulance',
        blood: 'blood',
        oxygen: 'oxygen',
        doctor: 'doctor',
        doctor_assistance: 'doctor'
      };
      const serviceKey = resourceKeyMap[req.resourceType] || req.resourceType;

      if (status === 'accepted') {
        const caseReqs = this.state.requests.filter((r) => r.caseId === req.caseId);
        const allAccepted = caseReqs.length > 0 && caseReqs.every((r) => String(r.status).toLowerCase() === 'accepted');
        parentCase.status = allAccepted ? 'RESOURCE_CONFIRMED' : 'ACCEPTED';
        parentCase.updatedAt = new Date().toISOString();
        (parentCase.serviceStatuses as any)[serviceKey] = serviceKey === 'ambulance' ? 'Dispatched' : (serviceKey === 'blood' ? 'Reserved' : (serviceKey === 'oxygen' ? 'Allocated' : 'Confirmed'));

        const existingInd = parentCase.individualStatuses.find((s) => s.resource?.toLowerCase().includes(serviceKey));
        if (existingInd) {
          existingInd.status = serviceKey === 'ambulance' ? 'Dispatched' : (serviceKey === 'blood' ? 'Reserved' : (serviceKey === 'oxygen' ? 'Allocated' : 'Confirmed'));
          existingInd.code = serviceKey === 'ambulance' ? 'dispatched' : 'completed';
          existingInd.detail = `Confirmed and accepted by ${req.providerName}.`;
          existingInd.updatedAt = new Date().toISOString();
        }

        if (!parentCase.auditHistory) parentCase.auditHistory = [];
        parentCase.auditHistory.push({
          id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          status: parentCase.status,
          updatedByUid: req.providerUid,
          updatedByName: req.providerName,
          role: req.resourceType,
          timestamp: new Date().toISOString(),
          note: `${req.providerName} accepted ${req.resourceType.toUpperCase()} request.`
        });
      } else if (status === 'rejected') {
        parentCase.status = 'UNDER_REVIEW';
        parentCase.rejectionReason = reason || 'Declined by provider';
        parentCase.updatedAt = new Date().toISOString();
        (parentCase.serviceStatuses as any)[serviceKey] = 'Declined';

        const existingInd = parentCase.individualStatuses.find((s) => s.resource?.toLowerCase().includes(serviceKey));
        if (existingInd) {
          existingInd.status = 'Declined';
          existingInd.code = 'in-review';
          existingInd.detail = `Declined by ${req.providerName}: ${reason || 'Capacity full'}. Coordinator reassignment required.`;
          existingInd.updatedAt = new Date().toISOString();
        }

        if (!parentCase.auditHistory) parentCase.auditHistory = [];
        parentCase.auditHistory.push({
          id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          status: 'UNDER_REVIEW',
          updatedByUid: req.providerUid,
          updatedByName: req.providerName,
          role: req.resourceType,
          timestamp: new Date().toISOString(),
          note: `${req.providerName} declined ${req.resourceType.toUpperCase()} request: ${reason || 'Capacity full'}`,
          reason
        });
      }
    }

    // Notify Patient & Attendant
    const patientAndAttendant = Array.from(new Set([
      req.patientUid,
      parentCase?.attendantUid,
      parentCase?.attendant?.uid
    ].filter(Boolean))) as string[];

    patientAndAttendant.forEach((recip) => {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + recip.slice(-4),
        recipientUid: recip,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        title: `${req.providerName} ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
        message:
          status === 'accepted'
            ? `Your ${req.resourceType.toUpperCase()} request has been accepted by ${req.providerName}.`
            : `Your request was declined: ${reason || 'Capacity exceeded'}. Coordinator will reassign suitable provider.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    // Notify Central Coordinators / Admins about the response
    const admins = this.state.users.filter((u) => u.role === 'admin');
    admins.forEach((adminUser) => {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + adminUser.uid.slice(-4),
        recipientUid: adminUser.uid,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        title: `Provider ${status === 'accepted' ? 'Accepted' : 'REJECTED'}: ${req.providerName}`,
        message:
          status === 'accepted'
            ? `${req.providerName} accepted ${req.resourceType} for case ${req.caseId}.`
            : `ACTION NEEDED: ${req.providerName} rejected ${req.resourceType} for case ${req.caseId} (Reason: ${reason || 'Capacity full'}). Please reassign.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();
  }

  public cancelRequest(requestId: string) {
    const req = this.state.requests.find((r) => r.requestId === requestId);
    if (req && req.status === 'pending') {
      req.status = 'cancelled';
      req.updatedAt = new Date().toISOString();

      this.addNotification({
        id: 'notif-' + Date.now(),
        recipientUid: req.providerUid,
        type: 'request_cancelled',
        title: 'Request Cancelled',
        message: `Patient cancelled ${req.resourceType} request for case ${req.caseId}.`,
        relatedCaseId: req.caseId,
        relatedRequestId: req.requestId,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      this.saveState();
    }
  }

  // --- Ambulance Trips ---
  public getTrips(): AmbulanceTrip[] {
    return [...this.state.trips];
  }

  public getTripForRequest(requestId: string): AmbulanceTrip | undefined {
    return this.state.trips.find((t) => t.requestId === requestId);
  }

  public getTripForCase(caseId: string): AmbulanceTrip | undefined {
    return this.state.trips.find((t) => t.caseId === caseId);
  }

  public updateTripStatus(tripId: string, status: AmbulanceTripStatus, note?: string) {
    const trip = this.state.trips.find((t) => t.tripId === tripId);
    if (!trip) return;

    const now = new Date().toISOString();
    trip.status = status;
    trip.updatedAt = now;
    trip.statusHistory.push({
      status,
      timestamp: now,
      note: note || `Ambulance transitioned to ${status.replace('_', ' ')}`
    });

    if (status === 'completed') {
      // Free up vehicle
      const amb = this.state.ambulanceProfiles[trip.providerUid];
      const vehicle = amb?.vehicles.find((v) => v.vehicleId === trip.vehicleId);
      if (vehicle) {
        vehicle.isAvailable = true;
        vehicle.currentStatus = 'idle';
      }
    }

    // Synchronize parent emergency case lifecycle status & individualStatuses
    const parentCase = this.state.cases.find((c) => c.caseId === trip.caseId);
    if (parentCase) {
      if (!parentCase.serviceStatuses) parentCase.serviceStatuses = {} as any;
      if (!parentCase.individualStatuses) parentCase.individualStatuses = [];

      const ambProvider = this.getAmbulanceProfile(trip.providerUid) || this.state.ambulanceProfiles[trip.providerUid];
      const ambProviderName = ambProvider?.providerName || 'Emergency Fleet';
      const destHospital = trip.destinationLocation?.address || parentCase.assignedHospitalName || 'Hospital';

      const statusMap: Record<AmbulanceTripStatus, { caseStatus: EmergencyLifecycleStatus; serviceStatus: string; indStatus: string; detail: string; code: 'dispatched' | 'in-review' | 'completed' }> = {
        dispatched: {
          caseStatus: 'DISPATCHED',
          serviceStatus: 'Dispatched',
          indStatus: 'Dispatched',
          detail: `Ambulance (${trip.vehicleId}) dispatched by ${ambProviderName}.`,
          code: 'dispatched'
        },
        en_route: {
          caseStatus: 'DISPATCHED',
          serviceStatus: 'En Route',
          indStatus: 'En Route',
          detail: `Ambulance (${trip.vehicleId}) is en route to patient location • ETA 5-10 mins.`,
          code: 'dispatched'
        },
        arrived: {
          caseStatus: 'IN_PROGRESS',
          serviceStatus: 'Arrived at Scene',
          indStatus: 'Arrived at Scene',
          detail: `Ambulance (${trip.vehicleId}) arrived at patient incident location. Paramedic triage active.`,
          code: 'in-review'
        },
        picked_up: {
          caseStatus: 'IN_PROGRESS',
          serviceStatus: 'Patient Picked Up',
          indStatus: 'Patient Picked Up',
          detail: `Patient safely aboard ambulance (${trip.vehicleId}) • Vital signs stabilized en route.`,
          code: 'in-review'
        },
        in_transit: {
          caseStatus: 'IN_PROGRESS',
          serviceStatus: 'In Transit to Hospital',
          indStatus: 'In Transit',
          detail: `Ambulance (${trip.vehicleId}) in transit to hospital (${destHospital}).`,
          code: 'in-review'
        },
        delivered: {
          caseStatus: 'IN_PROGRESS',
          serviceStatus: 'Delivered to Hospital',
          indStatus: 'Delivered',
          detail: `Patient safely delivered and transferred to emergency room at ${destHospital}.`,
          code: 'in-review'
        },
        completed: {
          caseStatus: 'COMPLETED',
          serviceStatus: 'Trip Completed',
          indStatus: 'Completed',
          detail: `Ambulance emergency mission completed (${trip.vehicleId}).`,
          code: 'completed'
        }
      };

      const meta = statusMap[status] || {
        caseStatus: 'IN_PROGRESS',
        serviceStatus: status.replace('_', ' '),
        indStatus: status.replace('_', ' '),
        detail: note || `Ambulance updated to ${status.replace('_', ' ')}`,
        code: 'in-review'
      };

      parentCase.status = meta.caseStatus;
      (parentCase.serviceStatuses as any).ambulance = meta.serviceStatus;

      const existingInd = parentCase.individualStatuses.find(
        (s) => s.resource?.toLowerCase().includes('ambulance')
      );
      if (existingInd) {
        existingInd.status = meta.indStatus;
        existingInd.code = meta.code;
        existingInd.detail = note ? `${meta.detail} - ${note}` : meta.detail;
        existingInd.updatedAt = now;
      } else {
        parentCase.individualStatuses.push({
          resource: 'Ambulance Services',
          status: meta.indStatus,
          code: meta.code,
          detail: note ? `${meta.detail} - ${note}` : meta.detail,
          updatedAt: now
        });
      }

      parentCase.updatedAt = now;
      if (!parentCase.auditHistory) parentCase.auditHistory = [];
      parentCase.auditHistory.push({
        id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        status: parentCase.status,
        updatedByUid: trip.providerUid,
        updatedByName: 'Ambulance Unit ' + trip.vehicleId,
        role: 'ambulanceProvider',
        timestamp: now,
        note: `Ambulance trip updated to ${meta.serviceStatus.toUpperCase()}`
      });
    }

    // Also update any linked resource request in state
    const linkedReq = this.state.requests.find(
      (r) => r.requestId === trip.requestId || (r.caseId === trip.caseId && r.resourceType === 'ambulance')
    );
    if (linkedReq) {
      if (status === 'completed') {
        linkedReq.status = 'completed';
      }
      linkedReq.responseDetails = `Ambulance (${trip.vehicleId}): ${status.replace('_', ' ')}`;
      linkedReq.updatedAt = now;
    }

    // Notify Patient & Attendant
    const patientRecipientUids = Array.from(new Set([trip.patientUid, parentCase?.patientUid, parentCase?.attendantUid, parentCase?.requesterUid].filter(Boolean))) as string[];
    for (const rUid of patientRecipientUids) {
      this.addNotification({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        recipientUid: rUid,
        type: 'ambulance_updated',
        title: `Ambulance: ${status.toUpperCase().replace('_', ' ')}`,
        message: `Ambulance (${trip.vehicleId}) status updated: ${note || status.replace('_', ' ')}.`,
        relatedCaseId: trip.caseId,
        isRead: false,
        createdAt: now
      });
    }

    // Firestore Synchronization
    if (isFirebaseConfigured && db) {
      try {
        const tripRef = doc(db, 'trips', tripId);
        void setDoc(tripRef, {
          ...trip,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if (parentCase) {
          const caseRef = doc(db, 'cases', parentCase.caseId);
          void setDoc(caseRef, {
            status: parentCase.status,
            serviceStatuses: parentCase.serviceStatuses,
            individualStatuses: parentCase.individualStatuses,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        if (linkedReq) {
          const reqRef = doc(db, 'requests', linkedReq.requestId);
          void setDoc(reqRef, {
            status: linkedReq.status,
            responseDetails: linkedReq.responseDetails,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.warn('[updateTripStatus] Firestore sync notice:', err);
      }
    }

    this.saveState();
  }

  // --- Notifications ---
  public getNotifications(recipientUid: string): NotificationItem[] {
    return this.state.notifications
      .filter((n) => n.recipientUid === recipientUid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notif: NotificationItem) {
    this.state.notifications.unshift(notif);
    this.saveState();
  }

  public markNotificationAsRead(id: string) {
    const n = this.state.notifications.find((item) => item.id === id);
    if (n) {
      n.isRead = true;
      this.saveState();
    }
  }

  public markAllNotificationsAsRead(recipientUid: string) {
    this.state.notifications
      .filter((n) => n.recipientUid === recipientUid)
      .forEach((n) => (n.isRead = true));
    this.saveState();
  }

  // --- Clinical Notes (Doctor Role) ---
  public getClinicalNotes(caseId: string): ClinicalNote[] {
    return this.state.clinicalNotes.filter((n) => n.caseId === caseId);
  }

  public addClinicalNote(note: ClinicalNote) {
    this.state.clinicalNotes.unshift(note);
    this.saveState();
  }
}

// Global Singleton Instance
export const dataStore = new DataStore();

// ==========================================
// ASYNC FIRESTORE SYNC & PERSISTENCE HELPERS
// ==========================================

export async function fetchPatientLinksFromFirestore(attendantUid: string): Promise<PatientLink[]> {
  if (!isFirebaseConfigured || !db) {
    return dataStore.getPatientLinks(attendantUid);
  }
  try {
    const q = query(collection(db, 'patientLinks'), where('attendantUid', '==', attendantUid));
    const snap = await getDocs(q);
    const links: PatientLink[] = [];
    snap.forEach((d) => {
      links.push(d.data() as PatientLink);
    });
    // Sync to local store
    links.forEach((l) => dataStore.savePatientLink(l));
    return links;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch patient links:', err);
    return dataStore.getPatientLinks(attendantUid);
  }
}

export async function savePatientLinkToFirestore(link: PatientLink): Promise<void> {
  dataStore.savePatientLink(link);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'patientLinks', link.id), link);
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to save patient link:', err);
    }
  }
}

export async function deletePatientLinkFromFirestore(linkId: string): Promise<void> {
  dataStore.deletePatientLink(linkId);
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'patientLinks', linkId));
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to delete patient link:', err);
    }
  }
}

/**
 * Real-time Firestore listener for attendant's linked patients
 * Updates instantly via onSnapshot when patient links change in Firestore
 */
export function subscribePatientLinksFromFirestore(
  attendantUid: string,
  onUpdate: (links: PatientLink[]) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    const initial = dataStore.getPatientLinks(attendantUid);
    onUpdate(initial);
    return dataStore.subscribe(() => {
      onUpdate(dataStore.getPatientLinks(attendantUid));
    });
  }
  try {
    const q = query(collection(db, 'patientLinks'), where('attendantUid', '==', attendantUid));
    return onSnapshot(
      q,
      (snapshot) => {
        const links: PatientLink[] = [];
        snapshot.forEach((doc) => {
          links.push(doc.data() as PatientLink);
        });
        links.forEach((l) => dataStore.savePatientLink(l));
        onUpdate(links);
      },
      (error) => {
        console.warn('[CareBridge Firestore] onSnapshot error on patientLinks:', error);
        onUpdate(dataStore.getPatientLinks(attendantUid));
      }
    );
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to subscribe to patientLinks:', err);
    onUpdate(dataStore.getPatientLinks(attendantUid));
    return () => {};
  }
}

/**
 * Real-time Firestore listener for attendant's emergency cases
 * Listens for live dispatch status updates on cases owned by this attendant
 */
export function subscribeCasesForAttendantFromFirestore(
  attendantUid: string,
  linkedPatientUids: string[] = [],
  onUpdate: (cases: EmergencyCase[]) => void
): () => void {
  const firestoreCasesMap = new Map<string, EmergencyCase>();

  const emitCombined = () => {
    const local = dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
    const combinedMap = new Map<string, EmergencyCase>();
    local.forEach((c) => combinedMap.set(c.caseId, c));
    firestoreCasesMap.forEach((c) => {
      const localCase = combinedMap.get(c.caseId);
      if (!localCase || !localCase.updatedAt || !c.updatedAt) {
        combinedMap.set(c.caseId, c);
      } else if (new Date(c.updatedAt).getTime() >= new Date(localCase.updatedAt).getTime()) {
        combinedMap.set(c.caseId, c);
      }
    });
    const combined = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onUpdate(combined);
  };

  emitCombined();
  const unsubStore = dataStore.subscribe(() => {
    emitCombined();
  });

  if (!isFirebaseConfigured || !db) {
    return unsubStore;
  }

  const unsubs: Array<() => void> = [unsubStore];

  const handleSnapshot = (snapshot: any) => {
    try {
      snapshot.forEach((docSnapshot: any) => {
        const c = normalizeEmergencyCase(docSnapshot.data(), docSnapshot.id);
        firestoreCasesMap.set(c.caseId, c);
        dataStore.createCase(c);
      });
      emitCombined();
    } catch (err) {
      console.warn('[CareBridge Firestore] onSnapshot processing error:', err);
    }
  };

  try {
    // 1. Where user is attendant
    unsubs.push(onSnapshot(query(collection(db, 'cases'), where('attendantUid', '==', attendantUid)), handleSnapshot, (err) => console.warn('attendantUid listener error:', err.message)));
    // 2. Where user is patient directly
    unsubs.push(onSnapshot(query(collection(db, 'cases'), where('patientUid', '==', attendantUid)), handleSnapshot, (err) => console.warn('patientUid listener error:', err.message)));
    // 3. Where user is requester
    unsubs.push(onSnapshot(query(collection(db, 'cases'), where('requesterUid', '==', attendantUid)), handleSnapshot, (err) => console.warn('requesterUid listener error:', err.message)));
    // 4. Authorized linked patients
    for (const pUid of linkedPatientUids) {
      if (pUid && pUid !== attendantUid) {
        unsubs.push(onSnapshot(query(collection(db, 'cases'), where('patientUid', '==', pUid)), handleSnapshot, (err) => console.warn('linked patient listener error:', err.message)));
      }
    }
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to subscribe to all case listeners:', err);
  }

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch (e) {}
    });
  };
}

export async function fetchCasesForAttendantFromFirestore(
  attendantUid: string,
  linkedPatientUids: string[] = []
): Promise<EmergencyCase[]> {
  if (!isFirebaseConfigured || !db) {
    return dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
  }
  try {
    const casesMap = new Map<string, EmergencyCase>();

    // 1. Cases where user is the attendant
    try {
      const q1 = query(collection(db, 'cases'), where('attendantUid', '==', attendantUid));
      const snap1 = await getDocs(q1);
      snap1.forEach((d) => {
        const c = d.data() as EmergencyCase;
        casesMap.set(c.caseId, c);
      });
    } catch (e) {
      console.warn('[CareBridge Firestore] Query by attendantUid note:', e);
    }

    // 2. Cases where user is the patient directly (self-created cases or patient account)
    try {
      const qSelf = query(collection(db, 'cases'), where('patientUid', '==', attendantUid));
      const snapSelf = await getDocs(qSelf);
      snapSelf.forEach((d) => {
        const c = d.data() as EmergencyCase;
        casesMap.set(c.caseId, c);
      });
    } catch (e) {
      console.warn('[CareBridge Firestore] Query by patientUid self note:', e);
    }

    // 3. Cases for linked patient UIDs (attendant accessing authorized patients)
    for (const pUid of linkedPatientUids) {
      try {
        const qP = query(collection(db, 'cases'), where('patientUid', '==', pUid));
        const snapP = await getDocs(qP);
        snapP.forEach((d) => {
          const c = d.data() as EmergencyCase;
          casesMap.set(c.caseId, c);
        });
      } catch (e) {
        console.warn('[CareBridge Firestore] Query by patientUid note:', e);
      }
    }

    const results = Array.from(casesMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    // sync to local store
    results.forEach((c) => dataStore.createCase(c));
    return results;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch cases for attendant:', err);
    return dataStore.getCasesForAttendant(attendantUid, linkedPatientUids);
  }
}

export interface CaseValidationResult {
  isValid: boolean;
  valid: boolean;
  errors: Record<string, string>;
  errorList: string[];
}

export function validateEmergencyCasePayload(
  payload: Partial<EmergencyCase>,
  requester: { uid: string; role: string },
  linkedPatients: PatientLink[] = []
): CaseValidationResult {
  const errors: Record<string, string> = {};

  // 1. Patient Information
  if (!payload.patientName || !payload.patientName.trim()) {
    errors.patientName = 'Patient full name is required.';
  }
  const patientUid = payload.patientUid || payload.patientId;
  if (!patientUid || !patientUid.trim()) {
    errors.patientUid = 'Patient ID is required.';
  }
  const age = Number(payload.patientAge);
  if (payload.patientAge === undefined || payload.patientAge === null || isNaN(age) || age <= 0 || age > 130) {
    errors.patientAge = 'Please enter a valid patient age (1–130).';
  }
  if (!payload.patientGender || !payload.patientGender.trim()) {
    errors.patientGender = 'Patient gender is required.';
  }

  // 2. Authorization and Consent
  const isSelf = requester.role === 'patient' || requester.uid === patientUid;
  if (!isSelf) {
    const link = linkedPatients.find((l) => l.patientUid === patientUid);
    if (!link) {
      errors.authorization = 'Unauthorized: You are not authorized to create emergency cases for unrelated patients.';
    } else if (!link.consentGranted || link.consentStatus !== 'granted') {
      errors.consent = 'Valid, active patient consent is required before creating an emergency case on behalf of this patient.';
    }
  }

  // 3. Emergency Details
  const category = payload.category || payload.emergencyCategory;
  if (!category || !category.trim()) {
    errors.category = 'Please select an emergency category.';
  }
  const condition = payload.conditionSummary || payload.patientCondition || payload.emergencyDescription;
  if (!condition || !condition.trim()) {
    errors.conditionSummary = 'Emergency condition description is required.';
  }
  const priority = payload.priority || payload.emergencyPriority || payload.triagePriority;
  if (!priority) {
    errors.priority = 'Please select an emergency priority level.';
  }

  // 4. Required Services
  const services = payload.requiredServices || payload.resourcesNeeded || [];
  if (!services || services.length === 0) {
    errors.services = 'Please select at least one emergency service (Hospital admission, Blood, Oxygen, Ambulance, or Doctor assistance).';
  }

  const hasBlood = services.some((s) => s.toLowerCase().includes('blood')) || Boolean(payload.quotas?.bloodRequired);
  if (hasBlood) {
    const bloodGroup = payload.quotas?.bloodGroup || payload.patientBloodGroup;
    const bloodUnits = Number(payload.quotas?.bloodUnits ?? payload.quotas?.bloodUnitsRequested);
    if (!bloodGroup || bloodGroup === 'Unknown' || !bloodGroup.trim()) {
      errors.bloodGroup = 'Blood group must be specified when blood requirement is selected.';
    }
    if (!bloodUnits || isNaN(bloodUnits) || bloodUnits <= 0) {
      errors.bloodUnits = 'Number of blood units required must be at least 1.';
    }
  }

  const hasOxygen = services.some((s) => s.toLowerCase().includes('oxygen')) || Boolean(payload.quotas?.oxygenRequired);
  if (hasOxygen) {
    const oxyType = payload.quotas?.oxygenType;
    const oxyQty = Number(payload.quotas?.oxygenQuantity ?? payload.quotas?.oxygenCylindersRequested);
    if (!oxyType) {
      errors.oxygenType = 'Oxygen supply type (cylinder, concentrator, or both) must be specified.';
    }
    if (!oxyQty || isNaN(oxyQty) || oxyQty <= 0) {
      errors.oxygenQuantity = 'Oxygen supply quantity must be at least 1.';
    }
  }

  // 5. Location
  const address = payload.location?.address || payload.incidentAddress;
  if (!address || !address.trim()) {
    errors.location = 'Current emergency location address / landmark is required.';
  }

  // 6. Contact Information
  const contactPerson = payload.contactPerson || payload.attendant?.name || payload.attendantName || payload.patientName;
  const contactPhone = payload.contactPhone || payload.attendant?.phone || payload.attendantPhone || payload.patientPhone;
  if (!contactPerson || !contactPerson.trim()) {
    errors.contactPerson = 'Contact person name is required.';
  }
  if (!contactPhone || !contactPhone.trim() || contactPhone.trim().length < 8) {
    errors.contactPhone = 'Please enter a valid emergency contact phone number.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    valid: isValid,
    errors,
    errorList: Object.values(errors)
  };
}

export async function createEmergencyCase(
  caseRecord: EmergencyCase,
  requester: { uid: string; role: string },
  linkedPatients: PatientLink[] = []
): Promise<{ success: boolean; caseId: string; error?: string }> {
  // 1. Enforce validation before writing
  const validation = validateEmergencyCasePayload(caseRecord, requester, linkedPatients);
  if (!validation.isValid) {
    const firstErr = validation.errorList[0] || 'Emergency case validation failed';
    return { success: false, caseId: caseRecord.caseId, error: firstErr };
  }

  // 2. Prevent duplicate submissions / idempotency
  const existing = dataStore.getCase(caseRecord.caseId);
  if (existing) {
    return { success: true, caseId: caseRecord.caseId };
  }

  const submittedCase = { ...caseRecord, status: 'REQUESTED' as const };
  dataStore.createCase(submittedCase);

  // 4. Save to Firestore if configured
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'cases', caseRecord.caseId), submittedCase);
    } catch (err: any) {
      console.warn('[CareBridge Firestore] Failed to write case to Firestore:', err);
      throw err;
    }
  }

  return { success: true, caseId: caseRecord.caseId };
}

export async function saveCaseToFirestore(emergencyCase: EmergencyCase): Promise<void> {
  const submittedCase = { ...emergencyCase, status: 'REQUESTED' as const };
  dataStore.createCase(submittedCase);
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'cases', emergencyCase.caseId), submittedCase);
    } catch (err) {
      console.warn('[CareBridge Firestore] Failed to write case to Firestore:', err);
    }
  }
}

export async function fetchRequestsForCasesFromFirestore(caseIds: string[]): Promise<ResourceRequest[]> {
  if (caseIds.length === 0) return [];
  if (!isFirebaseConfigured || !db) {
    return dataStore.getRequests().filter((r) => caseIds.includes(r.caseId));
  }
  try {
    const reqs: ResourceRequest[] = [];
    for (const cId of caseIds) {
      const q = query(collection(db, 'requests'), where('caseId', '==', cId));
      const snap = await getDocs(q);
      snap.forEach((d) => reqs.push(d.data() as ResourceRequest));
    }
    return reqs;
  } catch (err) {
    console.warn('[CareBridge Firestore] Failed to fetch requests for cases:', err);
    return dataStore.getRequests().filter((r) => caseIds.includes(r.caseId));
  }
}

export function subscribeRequestsForProviderFromFirestore(
  providerUid: string,
  onUpdate: (requests: ResourceRequest[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  // Always immediately provide current local requests
  onUpdate(dataStore.getRequestsForProvider(providerUid));

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getRequestsForProvider(providerUid));
  });

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(
        query(collection(db, 'requests'), where('providerUid', '==', providerUid)),
        (snapshot) => {
          try {
            const firestoreRequests = snapshot.docs.map((requestSnapshot) => {
              return normalizeResourceRequest(requestSnapshot.data(), requestSnapshot.id);
            });
            // Merge with local dataStore requests so nothing is lost
            const localRequests = dataStore.getRequestsForProvider(providerUid);
            const combinedMap = new Map<string, ResourceRequest>();
            firestoreRequests.forEach((r) => combinedMap.set(r.requestId, r));
            localRequests.forEach((r) => {
              if (!combinedMap.has(r.requestId)) combinedMap.set(r.requestId, r);
            });
            const combined = Array.from(combinedMap.values());
            combined.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
            dataStore.replaceRequestsForProvider(providerUid, combined);
            onUpdate(combined);
          } catch (error) {
            console.warn('[CareBridge] Error processing requests snapshot:', error);
            onUpdate(dataStore.getRequestsForProvider(providerUid));
          }
        },
        (error) => {
          console.warn('[CareBridge] Requests onSnapshot note (falling back to local state):', error.message);
          onUpdate(dataStore.getRequestsForProvider(providerUid));
          if (onError) onError(error.message);
        }
      );
    } catch (error) {
      console.warn('[CareBridge] Failed to subscribe to requests in Firestore:', error);
      onUpdate(dataStore.getRequestsForProvider(providerUid));
    }
  }

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export async function getAssignedCaseForProviderFromFirestore(caseId: string): Promise<EmergencyCase | null> {
  if (!isFirebaseConfigured || !db || !auth.currentUser) {
    return dataStore.getCase(caseId) || null;
  }
  try {
    const caseSnapshot = await getDoc(doc(db, 'cases', caseId));
    if (!caseSnapshot.exists()) return dataStore.getCase(caseId) || null;
    return normalizeEmergencyCase(caseSnapshot.data(), caseSnapshot.id);
  } catch (err) {
    return dataStore.getCase(caseId) || null;
  }
}

export async function respondToRequestInFirestore(
  requestId: string,
  status: 'accepted' | 'rejected',
  reason?: string
): Promise<boolean> {
  const providerUid = auth?.currentUser?.uid || '';
  const normalizedReason = reason?.trim() || '';
  if (status === 'rejected' && normalizedReason.length < 3) {
    throw new Error('A rejection reason of at least three characters is required.');
  }

  // Update local dataStore immediately
  dataStore.respondToRequest(requestId, status, reason);

  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    return true;
  }

  const requestRef = doc(db, 'requests', requestId);
  const statusEventId = doc(collection(db, 'requests', requestId, 'statusHistory')).id;
  const providerRef = doc(db, 'users', providerUid);
  const providerDirectoryRef = doc(db, 'providerDirectory', providerUid);
  const responseTimestamp = serverTimestamp();

  try {
    return await runTransaction(db, async (transaction) => {
      const [requestSnapshot, providerSnapshot, directorySnapshot] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(providerRef),
        transaction.get(providerDirectoryRef)
      ]);
      if (!requestSnapshot.exists()) {
        throw new Error('This resource request is no longer available.');
      }

      const request = requestSnapshot.data();
      const provider = providerSnapshot.data();
      const directory = directorySnapshot.data();

      const previousStatus = String(request.status);
      const nextStatus: EmergencyLifecycleStatus = status === 'accepted' ? 'ACCEPTED' : 'REJECTED';
      const responseDetails = status === 'accepted' ? 'Accepted by provider.' : normalizedReason;
      const statusEvent = {
        eventId: statusEventId,
        eventType: 'request_status',
        previousStatus,
        newStatus: nextStatus,
        updatedByUid: providerUid,
        userRole: provider?.role || 'provider',
        timestamp: responseTimestamp,
        ...(status === 'rejected' ? { reason: normalizedReason } : {}),
        requestId,
        resourceType: request.resourceType
      };
      const coordinatorUid = typeof request.assignmentCoordinatorUid === 'string' && request.assignmentCoordinatorUid
        ? request.assignmentCoordinatorUid
        : 'admin-coordinator';

      const notificationRef = doc(
        db,
        'notifications',
        notificationDocumentId(statusEventId, coordinatorUid)
      );
      const providerName = directory?.displayName || provider?.displayName || providerUid;
      transaction.update(requestRef, {
        status: nextStatus,
        respondedByUid: providerUid,
        responseDetails,
        ...(status === 'rejected' ? { rejectionReason: normalizedReason } : {}),
        respondedAt: responseTimestamp,
        updatedAt: responseTimestamp,
        lastStatusEventId: statusEventId,
        [`statusHistory.${statusEventId}`]: statusEvent
      });
      transaction.set(notificationRef, {
        recipientUid: coordinatorUid,
        type: status === 'accepted' ? 'request_accepted' : 'request_rejected',
        eventType: 'provider_response',
        eventId: statusEventId,
        title: `Resource request ${status}`,
        message: status === 'accepted'
          ? `Emergency ${request.caseId}: ${providerName} accepted the ${request.resourceType} request.`
          : `Emergency ${request.caseId}: ${providerName} rejected the ${request.resourceType} request: ${normalizedReason}`,
        details: responseDetails,
        emergencyId: request.caseId,
        relatedCaseId: request.caseId,
        relatedRequestId: requestId,
        resourceType: request.resourceType,
        resourceDetails: request.details || {},
        actorUid: providerUid,
        responseProviderUid: providerUid,
        isRead: false,
        createdAt: responseTimestamp
      });
      if (request.caseId) {
        try {
          const caseRef = doc(db, 'cases', request.caseId);
          const nextCaseStatus = status === 'accepted' ? 'ACCEPTED' : 'UNDER_REVIEW';
          transaction.update(caseRef, {
            status: nextCaseStatus,
            ...(status === 'rejected' ? { rejectionReason: normalizedReason } : {}),
            updatedAt: responseTimestamp
          });
        } catch (caseUpdateErr) {
          console.warn('[CareBridge] Case update in response transaction notice:', caseUpdateErr);
        }
      }
      return true;
    });
  } catch (err) {
    console.warn('[CareBridge] Firestore transaction response fallback to updateDoc:', err);
    try {
      await updateDoc(requestRef, {
        status: status === 'accepted' ? 'ACCEPTED' : 'REJECTED',
        ...(status === 'rejected' ? { rejectionReason: normalizedReason } : {}),
        respondedByUid: providerUid,
        respondedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (fallbackErr) {
      console.warn('[CareBridge] Direct updateDoc also failed, local state preserved:', fallbackErr);
      return true;
    }
  }
}

export function subscribeHospitalProfilesFromFirestore(
  onUpdate: (profiles: HospitalProfile[]) => void
): Unsubscribe {
  onUpdate(dataStore.getAllHospitalProfiles());

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(collection(db, 'hospitalProfiles'), (snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data() as HospitalProfile;
          dataStore.state.hospitalProfiles[d.id] = {
            ...INITIAL_HOSPITAL,
            ...dataStore.state.hospitalProfiles[d.id],
            ...data,
            uid: d.id
          };
        });
        dataStore.saveState();
        onUpdate(dataStore.getAllHospitalProfiles());
      }, (err) => {
        console.warn('[CareBridge] hospitalProfiles subscription notice:', err);
      });
    } catch (e) {}
  }

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getAllHospitalProfiles());
  });

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export function subscribeBloodBankProfilesFromFirestore(
  onUpdate: (profiles: BloodBankProfile[]) => void
): Unsubscribe {
  onUpdate(dataStore.getAllBloodBankProfiles());

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(collection(db, 'bloodBankProfiles'), (snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data() as BloodBankProfile;
          dataStore.state.bloodBankProfiles[d.id] = {
            ...INITIAL_BLOOD_BANK,
            ...dataStore.state.bloodBankProfiles[d.id],
            ...data,
            uid: d.id
          };
        });
        dataStore.saveState();
        onUpdate(dataStore.getAllBloodBankProfiles());
      }, (err) => {
        console.warn('[CareBridge] bloodBankProfiles subscription notice:', err);
      });
    } catch (e) {}
  }

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getAllBloodBankProfiles());
  });

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export function subscribeOxygenProfilesFromFirestore(
  onUpdate: (profiles: OxygenProfile[]) => void
): Unsubscribe {
  onUpdate(dataStore.getAllOxygenProfiles());

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(collection(db, 'oxygenProfiles'), (snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data() as OxygenProfile;
          dataStore.state.oxygenProfiles[d.id] = {
            ...INITIAL_OXYGEN,
            ...dataStore.state.oxygenProfiles[d.id],
            ...data,
            uid: d.id
          };
        });
        dataStore.saveState();
        onUpdate(dataStore.getAllOxygenProfiles());
      }, (err) => {
        console.warn('[CareBridge] oxygenProfiles subscription notice:', err);
      });
    } catch (e) {}
  }

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getAllOxygenProfiles());
  });

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export function subscribeAmbulanceProfilesFromFirestore(
  onUpdate: (profiles: AmbulanceProfile[]) => void
): Unsubscribe {
  onUpdate(dataStore.getAllAmbulanceProfiles());

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(collection(db, 'ambulanceProfiles'), (snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data() as AmbulanceProfile;
          dataStore.state.ambulanceProfiles[d.id] = {
            ...INITIAL_AMBULANCE,
            ...dataStore.state.ambulanceProfiles[d.id],
            ...data,
            uid: d.id
          };
        });
        dataStore.saveState();
        onUpdate(dataStore.getAllAmbulanceProfiles());
      }, (err) => {
        console.warn('[CareBridge] ambulanceProfiles subscription notice:', err);
      });
    } catch (e) {}
  }

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getAllAmbulanceProfiles());
  });

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export function subscribeProviderUpdateRequests(
  onUpdate: (updates: ProviderUpdateRequest[]) => void
): Unsubscribe {
  onUpdate(dataStore.getProviderUpdateRequests());

  let unsubFirestore = () => {};
  if (isFirebaseConfigured && db) {
    try {
      unsubFirestore = onSnapshot(collection(db, 'providerUpdateRequests'), (snapshot) => {
        const updates: ProviderUpdateRequest[] = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id
        } as ProviderUpdateRequest));
        updates.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
        dataStore.state.providerUpdateRequests = updates;
        dataStore.saveState();
        onUpdate(updates);
      }, (err) => {
        console.warn('[CareBridge] providerUpdateRequests subscription notice:', err);
      });
    } catch (e) {}
  }

  const unsubStore = dataStore.subscribe(() => {
    onUpdate(dataStore.getProviderUpdateRequests());
  });

  return () => {
    unsubFirestore();
    unsubStore();
  };
}

export function subscribeNotificationsForUserFromFirestore(
  recipientUid: string,
  onUpdate: (notifications: NotificationItem[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    onUpdate(dataStore.getNotifications(recipientUid));
    return dataStore.subscribe(() => onUpdate(dataStore.getNotifications(recipientUid)));
  }
  if (!auth.currentUser || auth.currentUser.uid !== recipientUid) {
    onError('Sign in to load notifications for this account.');
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, 'notifications'), where('recipientUid', '==', recipientUid)),
    (snapshot) => {
      try {
        const notifications = snapshot.docs.map((notificationSnapshot) => {
          const data = notificationSnapshot.data();
          return {
            ...data,
            id: notificationSnapshot.id,
            createdAt: firestoreDateToIso(data.createdAt)
          } as NotificationItem;
        });
        notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        onUpdate(notifications);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Notification data is invalid.');
      }
    },
    (error) => onError(`Could not load notifications: ${error.message}`)
  );
}

export async function markNotificationReadInFirestore(notificationId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    dataStore.markNotificationAsRead(notificationId);
    return;
  }
  if (!auth.currentUser) throw new Error('Sign in to update notifications.');
  await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
}

export async function markAllNotificationsReadInFirestore(recipientUid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    dataStore.markAllNotificationsAsRead(recipientUid);
    return;
  }
  if (!auth.currentUser || auth.currentUser.uid !== recipientUid) {
    throw new Error('Sign in to update notifications for this account.');
  }
  const unread = await getDocs(query(
    collection(db, 'notifications'),
    where('recipientUid', '==', recipientUid),
    where('isRead', '==', false)
  ));
  for (let offset = 0; offset < unread.docs.length; offset += 500) {
    const batch = writeBatch(db);
    unread.docs.slice(offset, offset + 500).forEach((notificationSnapshot) => {
      batch.update(notificationSnapshot.ref, { isRead: true });
    });
    await batch.commit();
  }
}
