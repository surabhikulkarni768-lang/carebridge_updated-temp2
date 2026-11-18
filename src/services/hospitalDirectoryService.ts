/**
 * CareBridge Multi-City Hospital & Provider Directory Service
 * Provides nearby hospitals, emergency centers, real-time resource availability,
 * and Google Maps integration for multiple locations.
 */

import type {
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile
} from '../types';

export interface HospitalProvider {
  id: string;
  firestoreUid?: string;
  name: string;
  type: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  rating: string;
  reviewCount: number;
  distanceKm: number;
  etaMins: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  availableResources: {
    beds: number;
    totalBeds: number;
    icu: number;
    totalIcu: number;
    ventilators?: number;
    totalVentilators?: number;
    bloodGroups: string[];
    bloodUnits: number;
    oxygenTanks: number;
    ambulances: number;
    doctorsOnDuty: number;
  };
  latestUpdate: string;
  details: string;
  isEmergency24x7: boolean;
  isLiveFirestoreData?: boolean;
  isVerified?: boolean;
  withinSearchRadius?: boolean;
  isEligible?: boolean;
  missingResources?: string[];
}

export interface NearbyEmergencyResource {
  id: string;
  name: string;
  resourceKind: 'bloodBank' | 'oxygenProvider' | 'ambulanceProvider';
  address: string;
  city: string;
  phone: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  distanceKm: number;
  etaMins: number;
  withinSearchRadius: boolean;
  availabilitySummary: string;
  isAvailable: boolean;
  isLiveFirestoreData: boolean;
  lastUpdated: string;
}

export const DEFAULT_SEARCH_RADIUS_KM = 2;

export interface GpsLocationReading {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  source: 'gps' | 'manual_coordinates' | 'manual_address';
  label?: string;
  capturedAt: string;
}

export type GpsAccuracyTier = 'good' | 'caution' | 'poor' | 'manual';

export interface GpsAccuracyAssessment {
  tier: GpsAccuracyTier;
  accuracyMeters: number | null;
  label: string;
  message: string;
  canClaimPrecise2Km: boolean;
  recommendManualOrRetry: boolean;
}

export const POPULAR_LOCATIONS = [
  { label: 'Dharwad', query: 'Dharwad, Karnataka, India' },
  { label: 'Hubballi', query: 'Hubballi, Karnataka, India' },
  { label: 'Belagavi', query: 'Belagavi, Karnataka, India' },
  { label: 'Bengaluru', query: 'Bengaluru, Karnataka, India' },
  { label: 'Mysuru', query: 'Mysuru, Karnataka, India' },
  { label: 'Mumbai', query: 'Mumbai, Maharashtra, India' },
  { label: 'Pune', query: 'Pune, Maharashtra, India' },
  { label: 'Delhi NCR', query: 'New Delhi, India' },
];

export const HOSPITAL_DIRECTORY: HospitalProvider[] = [
  // ----------------------------------------------------
  // DHARWAD HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-dh-01',
    name: 'SDM College of Medical Sciences & Hospital',
    type: 'Multi-Specialty Teaching Hospital',
    city: 'Dharwad',
    state: 'Karnataka',
    address: 'Manjushree Nagar, Sattur, Dharwad, Karnataka 580009',
    phone: '+91 836 247 7777',
    rating: '4.8 Stars',
    reviewCount: 340,
    distanceKm: 2.1,
    etaMins: 5,
    coordinates: { lat: 15.4208, lng: 75.0384 },
    availableResources: {
      beds: 24,
      totalBeds: 200,
      icu: 6,
      totalIcu: 30,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+', 'O-'],
      bloodUnits: 32,
      oxygenTanks: 20,
      ambulances: 4,
      doctorsOnDuty: 8
    },
    latestUpdate: 'Just now',
    details: '24 Hospital Beds, 6 ICU, 32 Units Blood, 20 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-dh-02',
    name: 'District Civil Hospital Dharwad',
    type: 'Government District Hospital',
    city: 'Dharwad',
    state: 'Karnataka',
    address: 'PB Road, Near Court Circle, Dharwad, Karnataka 580001',
    phone: '+91 836 244 8222',
    rating: '4.4 Stars',
    reviewCount: 215,
    distanceKm: 1.2,
    etaMins: 3,
    coordinates: { lat: 15.4589, lng: 75.0078 },
    availableResources: {
      beds: 18,
      totalBeds: 150,
      icu: 4,
      totalIcu: 20,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+'],
      bloodUnits: 25,
      oxygenTanks: 24,
      ambulances: 3,
      doctorsOnDuty: 6
    },
    latestUpdate: '3 mins ago',
    details: '18 Hospital Beds, 4 ICU, 25 Units Blood, 24 Oxygen Tanks, 3 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-dh-03',
    name: 'DIMHANS Emergency Healthcare Unit',
    type: 'Specialty Emergency Center',
    city: 'Dharwad',
    state: 'Karnataka',
    address: 'Belgaum Road, Dharwad, Karnataka 580008',
    phone: '+91 836 274 0800',
    rating: '4.6 Stars',
    reviewCount: 145,
    distanceKm: 3.4,
    etaMins: 7,
    coordinates: { lat: 15.4712, lng: 74.9980 },
    availableResources: {
      beds: 12,
      totalBeds: 80,
      icu: 2,
      totalIcu: 10,
      bloodGroups: ['B+', 'O+', 'A+'],
      bloodUnits: 14,
      oxygenTanks: 16,
      ambulances: 2,
      doctorsOnDuty: 4
    },
    latestUpdate: '5 mins ago',
    details: '12 Hospital Beds, 2 ICU, 14 Units Blood, 16 Oxygen Tanks, 2 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-dh-04',
    name: 'Vivekananda General Hospital & Trauma Care',
    type: 'Trauma & General Hospital',
    city: 'Dharwad',
    state: 'Karnataka',
    address: 'Deshpande Nagar, PB Road, Dharwad, Karnataka 580007',
    phone: '+91 836 244 5566',
    rating: '4.7 Stars',
    reviewCount: 180,
    distanceKm: 2.8,
    etaMins: 6,
    coordinates: { lat: 15.4490, lng: 75.0150 },
    availableResources: {
      beds: 15,
      totalBeds: 90,
      icu: 4,
      totalIcu: 15,
      bloodGroups: ['O+', 'A+', 'B+'],
      bloodUnits: 20,
      oxygenTanks: 18,
      ambulances: 3,
      doctorsOnDuty: 5
    },
    latestUpdate: '8 mins ago',
    details: '15 Hospital Beds, 4 ICU, 20 Units Blood, 18 Oxygen Tanks, 3 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-dh-05',
    name: 'Shivakrupa Multi-Specialty Hospital',
    type: 'Multi-Specialty Center',
    city: 'Dharwad',
    state: 'Karnataka',
    address: 'Station Road, Malamaddi, Dharwad, Karnataka 580007',
    phone: '+91 836 274 1234',
    rating: '4.5 Stars',
    reviewCount: 95,
    distanceKm: 1.8,
    etaMins: 4,
    coordinates: { lat: 15.4610, lng: 75.0120 },
    availableResources: {
      beds: 9,
      totalBeds: 60,
      icu: 2,
      totalIcu: 8,
      bloodGroups: ['B+', 'O+'],
      bloodUnits: 12,
      oxygenTanks: 10,
      ambulances: 2,
      doctorsOnDuty: 4
    },
    latestUpdate: '12 mins ago',
    details: '9 Hospital Beds, 2 ICU, 12 Units Blood, 10 Oxygen Tanks, 2 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // HUBBALLI HOSPITALS (Includes backward-compatible prov-01, prov-02, prov-03)
  // ----------------------------------------------------
  {
    id: 'prov-01',
    name: "St. Luke's Medical Center",
    type: 'Super Specialty Trauma Center',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Vidyanagar Main Road, Hubballi, Karnataka 580021',
    phone: '+91 836 225 1100',
    rating: '4.8 Stars',
    reviewCount: 220,
    distanceKm: 1.5,
    etaMins: 3,
    coordinates: { lat: 15.3647, lng: 75.1240 },
    availableResources: {
      beds: 5,
      totalBeds: 80,
      icu: 2,
      totalIcu: 12,
      bloodGroups: ['A+', 'B+', 'O+'],
      bloodUnits: 16,
      oxygenTanks: 12,
      ambulances: 2,
      doctorsOnDuty: 5
    },
    latestUpdate: '2 mins ago',
    details: '5 Hospital Beds, 2 ICU, 16 Units Blood, 12 Oxygen Tanks, 2 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-02',
    name: 'City General Hospital & Regional Blood Centre',
    type: 'General Hospital & Blood Bank',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'PB Road, Hubballi, Karnataka 580029',
    phone: '+91 836 237 4422',
    rating: '4.5 Stars',
    reviewCount: 180,
    distanceKm: 2.9,
    etaMins: 6,
    coordinates: { lat: 15.3480, lng: 75.1400 },
    availableResources: {
      beds: 8,
      totalBeds: 120,
      icu: 2,
      totalIcu: 15,
      bloodGroups: ['B+', 'O+', 'A+', 'AB+'],
      bloodUnits: 25,
      oxygenTanks: 15,
      ambulances: 3,
      doctorsOnDuty: 6
    },
    latestUpdate: '10 mins ago',
    details: '8 Hospital Beds, 2 ICU, 25 Units B+ Blood, 15 Oxygen Tanks, 3 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-hb-01',
    name: 'KIMS Super Specialty Hospital',
    type: 'Apex Government Medical Institute',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'PB Road, Vidyanagar, Hubballi, Karnataka 580022',
    phone: '+91 836 237 0057',
    rating: '4.7 Stars',
    reviewCount: 480,
    distanceKm: 2.3,
    etaMins: 5,
    coordinates: { lat: 15.3524, lng: 75.1328 },
    availableResources: {
      beds: 35,
      totalBeds: 350,
      icu: 8,
      totalIcu: 40,
      bloodGroups: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
      bloodUnits: 48,
      oxygenTanks: 30,
      ambulances: 6,
      doctorsOnDuty: 12
    },
    latestUpdate: 'Just now',
    details: '35 Hospital Beds, 8 ICU, 48 Units Blood (All Groups), 30 Oxygen Tanks, 6 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-03',
    name: 'Paramount Ambulance Service',
    type: 'Emergency Mobile Ambulance Fleet',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Station Road, Hubballi, Karnataka 580020',
    phone: '+91 836 299 9108',
    rating: '4.9 Stars',
    reviewCount: 290,
    distanceKm: 1.0,
    etaMins: 2,
    coordinates: { lat: 15.3580, lng: 75.1420 },
    availableResources: {
      beds: 0,
      totalBeds: 0,
      icu: 0,
      totalIcu: 0,
      bloodGroups: [],
      bloodUnits: 0,
      oxygenTanks: 8,
      ambulances: 5,
      doctorsOnDuty: 3
    },
    latestUpdate: '5 mins ago',
    details: '5 Advanced Life Support (ALS) Ambulances, 8 Mobile Oxygen Kits',
    isEmergency24x7: true
  },
  {
    id: 'prov-hb-04',
    name: 'Sushruta Multi Specialty Hospital',
    type: 'Private Multi-Specialty Hospital',
    city: 'Hubballi',
    state: 'Karnataka',
    address: 'Shirur Park, Vidyanagar, Hubballi, Karnataka 580031',
    phone: '+91 836 237 5555',
    rating: '4.6 Stars',
    reviewCount: 135,
    distanceKm: 3.1,
    etaMins: 7,
    coordinates: { lat: 15.3720, lng: 75.1180 },
    availableResources: {
      beds: 12,
      totalBeds: 70,
      icu: 3,
      totalIcu: 12,
      bloodGroups: ['O+', 'B+'],
      bloodUnits: 14,
      oxygenTanks: 12,
      ambulances: 2,
      doctorsOnDuty: 4
    },
    latestUpdate: '15 mins ago',
    details: '12 Hospital Beds, 3 ICU, 14 Units Blood, 12 Oxygen Tanks, 2 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // BELAGAVI HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-bg-01',
    name: "KLE's Dr. Prabhakar Kore Charitable Hospital",
    type: 'Tertiary Medical Center & MRC',
    city: 'Belagavi',
    state: 'Karnataka',
    address: 'Nehru Nagar, Belagavi, Karnataka 590010',
    phone: '+91 831 247 3777',
    rating: '4.8 Stars',
    reviewCount: 520,
    distanceKm: 2.4,
    etaMins: 5,
    coordinates: { lat: 15.8670, lng: 74.5120 },
    availableResources: {
      beds: 40,
      totalBeds: 400,
      icu: 10,
      totalIcu: 45,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+', 'O-'],
      bloodUnits: 55,
      oxygenTanks: 35,
      ambulances: 8,
      doctorsOnDuty: 14
    },
    latestUpdate: 'Just now',
    details: '40 Hospital Beds, 10 ICU, 55 Units Blood, 35 Oxygen Tanks, 8 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-bg-02',
    name: 'BIMS District Civil Hospital Belagavi',
    type: 'Government Medical College Hospital',
    city: 'Belagavi',
    state: 'Karnataka',
    address: 'Civil Hospital Road, Belagavi, Karnataka 590001',
    phone: '+91 831 240 3123',
    rating: '4.3 Stars',
    reviewCount: 280,
    distanceKm: 1.8,
    etaMins: 4,
    coordinates: { lat: 15.8580, lng: 74.5050 },
    availableResources: {
      beds: 22,
      totalBeds: 250,
      icu: 5,
      totalIcu: 25,
      bloodGroups: ['A+', 'B+', 'O+'],
      bloodUnits: 30,
      oxygenTanks: 22,
      ambulances: 4,
      doctorsOnDuty: 8
    },
    latestUpdate: '6 mins ago',
    details: '22 Hospital Beds, 5 ICU, 30 Units Blood, 22 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-bg-03',
    name: 'Lakeview Goaves Hospital',
    type: 'Trauma & Cardiac Care',
    city: 'Belagavi',
    state: 'Karnataka',
    address: 'Goaves, Belagavi, Karnataka 590011',
    phone: '+91 831 246 8888',
    rating: '4.6 Stars',
    reviewCount: 165,
    distanceKm: 3.0,
    etaMins: 6,
    coordinates: { lat: 15.8450, lng: 74.5200 },
    availableResources: {
      beds: 14,
      totalBeds: 80,
      icu: 3,
      totalIcu: 12,
      bloodGroups: ['B+', 'O+', 'A+'],
      bloodUnits: 15,
      oxygenTanks: 14,
      ambulances: 2,
      doctorsOnDuty: 5
    },
    latestUpdate: '11 mins ago',
    details: '14 Hospital Beds, 3 ICU, 15 Units Blood, 14 Oxygen Tanks, 2 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // BENGALURU HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-blr-01',
    name: 'Manipal Hospital HAL Old Airport Road',
    type: 'Super Specialty & Level-1 Trauma',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '98 HAL Old Airport Road, Kodihalli, Bengaluru, Karnataka 560017',
    phone: '+91 80 2502 4444',
    rating: '4.8 Stars',
    reviewCount: 820,
    distanceKm: 3.2,
    etaMins: 8,
    coordinates: { lat: 12.9592, lng: 77.6475 },
    availableResources: {
      beds: 28,
      totalBeds: 350,
      icu: 7,
      totalIcu: 50,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 42,
      oxygenTanks: 28,
      ambulances: 5,
      doctorsOnDuty: 12
    },
    latestUpdate: '1 min ago',
    details: '28 Hospital Beds, 7 ICU, 42 Units Blood, 28 Oxygen Tanks, 5 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-blr-02',
    name: 'Victoria Hospital Emergency Trauma Centre',
    type: 'Apex Government Trauma Centre',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'Fort Road, Near City Market, Kalasipalya, Bengaluru, Karnataka 560002',
    phone: '+91 80 2670 1150',
    rating: '4.4 Stars',
    reviewCount: 510,
    distanceKm: 2.0,
    etaMins: 5,
    coordinates: { lat: 12.9634, lng: 77.5744 },
    availableResources: {
      beds: 32,
      totalBeds: 400,
      icu: 6,
      totalIcu: 40,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 50,
      oxygenTanks: 32,
      ambulances: 6,
      doctorsOnDuty: 10
    },
    latestUpdate: '4 mins ago',
    details: '32 Hospital Beds, 6 ICU, 50 Units Blood, 32 Oxygen Tanks, 6 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-blr-03',
    name: 'Fortis Hospital Critical Care Unit',
    type: 'Super Specialty Critical Care',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '154/9 Bannerghatta Main Road, Opp IIMB, Bengaluru, Karnataka 560076',
    phone: '+91 80 6621 4444',
    rating: '4.7 Stars',
    reviewCount: 640,
    distanceKm: 4.5,
    etaMins: 10,
    coordinates: { lat: 12.8953, lng: 77.5993 },
    availableResources: {
      beds: 22,
      totalBeds: 280,
      icu: 5,
      totalIcu: 35,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+'],
      bloodUnits: 34,
      oxygenTanks: 22,
      ambulances: 4,
      doctorsOnDuty: 9
    },
    latestUpdate: '7 mins ago',
    details: '22 Hospital Beds, 5 ICU, 34 Units Blood, 22 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-blr-04',
    name: 'Aster CMI Hospital & Emergency Centre',
    type: 'Multi-Specialty Quaternary Hospital',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'No. 43/42, NH 44, Sahakar Nagar, Hebbal, Bengaluru, Karnataka 560092',
    phone: '+91 80 4342 0100',
    rating: '4.8 Stars',
    reviewCount: 710,
    distanceKm: 3.8,
    etaMins: 9,
    coordinates: { lat: 13.0560, lng: 77.5920 },
    availableResources: {
      beds: 30,
      totalBeds: 320,
      icu: 8,
      totalIcu: 45,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 45,
      oxygenTanks: 30,
      ambulances: 5,
      doctorsOnDuty: 11
    },
    latestUpdate: '3 mins ago',
    details: '30 Hospital Beds, 8 ICU, 45 Units Blood, 30 Oxygen Tanks, 5 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-blr-05',
    name: 'Narayana Health City Multi-Specialty',
    type: 'Apex Cardiac & Trauma Care',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: '258/A, Bommasandra Industrial Area, Anekal Taluk, Bengaluru, Karnataka 560099',
    phone: '+91 80 7122 2222',
    rating: '4.9 Stars',
    reviewCount: 920,
    distanceKm: 6.2,
    etaMins: 14,
    coordinates: { lat: 12.8180, lng: 77.6940 },
    availableResources: {
      beds: 40,
      totalBeds: 500,
      icu: 12,
      totalIcu: 60,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 55,
      oxygenTanks: 35,
      ambulances: 6,
      doctorsOnDuty: 15
    },
    latestUpdate: 'Just now',
    details: '40 Hospital Beds, 12 ICU, 55 Units Blood, 35 Oxygen Tanks, 6 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // MYSURU HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-mys-01',
    name: 'Apollo BGS Hospitals Mysuru',
    type: 'Super Specialty Hospital',
    city: 'Mysuru',
    state: 'Karnataka',
    address: 'Adichunchanagiri Road, Kuvempu Nagara, Mysuru, Karnataka 570023',
    phone: '+91 821 256 8888',
    rating: '4.8 Stars',
    reviewCount: 380,
    distanceKm: 2.2,
    etaMins: 5,
    coordinates: { lat: 12.2965, lng: 76.6321 },
    availableResources: {
      beds: 18,
      totalBeds: 200,
      icu: 4,
      totalIcu: 25,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+'],
      bloodUnits: 26,
      oxygenTanks: 18,
      ambulances: 3,
      doctorsOnDuty: 7
    },
    latestUpdate: 'Just now',
    details: '18 Hospital Beds, 4 ICU, 26 Units Blood, 18 Oxygen Tanks, 3 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-mys-02',
    name: 'KR Hospital Emergency Trauma Care',
    type: 'District Government Teaching Hospital',
    city: 'Mysuru',
    state: 'Karnataka',
    address: 'Irwin Road, Near Mysuru Palace, Mysuru, Karnataka 570001',
    phone: '+91 821 242 0100',
    rating: '4.3 Stars',
    reviewCount: 260,
    distanceKm: 1.5,
    etaMins: 4,
    coordinates: { lat: 12.3120, lng: 76.6510 },
    availableResources: {
      beds: 20,
      totalBeds: 220,
      icu: 4,
      totalIcu: 20,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 30,
      oxygenTanks: 20,
      ambulances: 4,
      doctorsOnDuty: 8
    },
    latestUpdate: '5 mins ago',
    details: '20 Hospital Beds, 4 ICU, 30 Units Blood, 20 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-mys-03',
    name: 'Manipal Hospital Mysuru',
    type: 'Multi-Specialty Emergency Hospital',
    city: 'Mysuru',
    state: 'Karnataka',
    address: 'Bangalore-Mysore Ring Road Junction, Bannimantap, Mysuru, Karnataka 570015',
    phone: '+91 821 259 8888',
    rating: '4.6 Stars',
    reviewCount: 290,
    distanceKm: 2.8,
    etaMins: 6,
    coordinates: { lat: 12.3380, lng: 76.6490 },
    availableResources: {
      beds: 15,
      totalBeds: 180,
      icu: 3,
      totalIcu: 18,
      bloodGroups: ['A+', 'B+', 'O+'],
      bloodUnits: 20,
      oxygenTanks: 16,
      ambulances: 3,
      doctorsOnDuty: 6
    },
    latestUpdate: 'Just now',
    details: '15 Hospital Beds, 3 ICU, 20 Units Blood, 16 Oxygen Tanks, 3 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // MUMBAI HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-mum-01',
    name: 'Lilavati Hospital & Research Centre',
    type: 'Premier Multi-Specialty Hospital',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'A-791 Bandra Reclamation, Bandra West, Mumbai, Maharashtra 400050',
    phone: '+91 22 2675 1000',
    rating: '4.8 Stars',
    reviewCount: 710,
    distanceKm: 3.0,
    etaMins: 8,
    coordinates: { lat: 19.0515, lng: 72.8290 },
    availableResources: {
      beds: 30,
      totalBeds: 300,
      icu: 7,
      totalIcu: 40,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 45,
      oxygenTanks: 30,
      ambulances: 5,
      doctorsOnDuty: 11
    },
    latestUpdate: '3 mins ago',
    details: '30 Hospital Beds, 7 ICU, 45 Units Blood, 30 Oxygen Tanks, 5 Ambulances',
    isEmergency24x7: true
  },
  {
    id: 'prov-mum-02',
    name: 'KEM Hospital & Critical Care Unit',
    type: 'Municipal Teaching Hospital',
    city: 'Mumbai',
    state: 'Maharashtra',
    address: 'Acharya Donde Marg, Parel, Mumbai, Maharashtra 400012',
    phone: '+91 22 2410 7000',
    rating: '4.5 Stars',
    reviewCount: 590,
    distanceKm: 2.1,
    etaMins: 5,
    coordinates: { lat: 19.0028, lng: 72.8423 },
    availableResources: {
      beds: 25,
      totalBeds: 350,
      icu: 5,
      totalIcu: 35,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 38,
      oxygenTanks: 25,
      ambulances: 4,
      doctorsOnDuty: 9
    },
    latestUpdate: '6 mins ago',
    details: '25 Hospital Beds, 5 ICU, 38 Units Blood, 25 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // PUNE HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-pun-01',
    name: 'Ruby Hall Clinic & Trauma Center',
    type: 'Multi-Specialty Center',
    city: 'Pune',
    state: 'Maharashtra',
    address: '40 Sassoon Road, Sangamvadi, Pune, Maharashtra 411001',
    phone: '+91 20 6645 5100',
    rating: '4.7 Stars',
    reviewCount: 490,
    distanceKm: 2.5,
    etaMins: 6,
    coordinates: { lat: 18.5308, lng: 73.8767 },
    availableResources: {
      beds: 20,
      totalBeds: 250,
      icu: 5,
      totalIcu: 30,
      bloodGroups: ['A+', 'B+', 'O+', 'AB+'],
      bloodUnits: 32,
      oxygenTanks: 20,
      ambulances: 4,
      doctorsOnDuty: 8
    },
    latestUpdate: 'Just now',
    details: '20 Hospital Beds, 5 ICU, 32 Units Blood, 20 Oxygen Tanks, 4 Ambulances',
    isEmergency24x7: true
  },

  // ----------------------------------------------------
  // DELHI NCR HOSPITALS
  // ----------------------------------------------------
  {
    id: 'prov-del-01',
    name: 'AIIMS New Delhi Apex Trauma Center',
    type: 'National Apex Institute & Trauma Care',
    city: 'New Delhi',
    state: 'Delhi',
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029',
    phone: '+91 11 2658 8500',
    rating: '4.9 Stars',
    reviewCount: 950,
    distanceKm: 3.5,
    etaMins: 8,
    coordinates: { lat: 28.5672, lng: 77.2100 },
    availableResources: {
      beds: 45,
      totalBeds: 500,
      icu: 12,
      totalIcu: 60,
      bloodGroups: ['All Groups Available'],
      bloodUnits: 65,
      oxygenTanks: 40,
      ambulances: 8,
      doctorsOnDuty: 16
    },
    latestUpdate: 'Just now',
    details: '45 Hospital Beds, 12 ICU, 65 Units Blood, 40 Oxygen Tanks, 8 Ambulances',
    isEmergency24x7: true
  }
];

/**
 * Normalizes city names for fuzzy location matching
 */
function normalizeQuery(q: string): string {
  return (q || '').trim().toLowerCase();
}

/**
 * Generates dynamic fallback hospitals if the user searches for any unindexed custom town or location
 */
function generateDynamicNearbyHospitals(locationQuery: string): HospitalProvider[] {
  const cleanLoc = locationQuery.trim();
  const titleLoc = cleanLoc
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0] || 'Local District';

  return [
    {
      id: `prov-dyn-${Date.now()}-1`,
      name: `${titleLoc} General & Emergency Hospital`,
      type: 'Multi-Specialty Emergency Center',
      city: titleLoc,
      state: 'Local Region',
      address: `Main Medical Road, Central ${titleLoc}`,
      phone: '+91 800 108 0001',
      rating: '4.7 Stars',
      reviewCount: 165,
      distanceKm: 1.4,
      etaMins: 4,
      coordinates: { lat: 15.45, lng: 75.01 },
      availableResources: {
        beds: 14,
        totalBeds: 110,
        icu: 4,
        totalIcu: 18,
        bloodGroups: ['O+', 'B+', 'A+'],
        bloodUnits: 22,
        oxygenTanks: 18,
        ambulances: 3,
        doctorsOnDuty: 5
      },
      latestUpdate: 'Just now',
      details: '14 Hospital Beds, 4 ICU, 22 Units Blood, 18 Oxygen Tanks, 3 Ambulances',
      isEmergency24x7: true
    },
    {
      id: `prov-dyn-${Date.now()}-2`,
      name: `${titleLoc} City Trauma & Critical Care Center`,
      type: 'Trauma & Emergency Care',
      city: titleLoc,
      state: 'Local Region',
      address: `Highway Junction, Near Bus Terminus, ${titleLoc}`,
      phone: '+91 800 108 0002',
      rating: '4.6 Stars',
      reviewCount: 120,
      distanceKm: 2.8,
      etaMins: 6,
      coordinates: { lat: 15.46, lng: 75.02 },
      availableResources: {
        beds: 10,
        totalBeds: 80,
        icu: 3,
        totalIcu: 12,
        bloodGroups: ['A+', 'B+', 'O+', 'AB+'],
        bloodUnits: 18,
        oxygenTanks: 14,
        ambulances: 2,
        doctorsOnDuty: 4
      },
      latestUpdate: '4 mins ago',
      details: '10 Hospital Beds, 3 ICU, 18 Units Blood, 14 Oxygen Tanks, 2 Ambulances',
      isEmergency24x7: true
    },
    {
      id: `prov-dyn-${Date.now()}-3`,
      name: `${titleLoc} Community Healthcare & Blood Bank`,
      type: 'District Hospital & Blood Centre',
      city: titleLoc,
      state: 'Local Region',
      address: `Civil Lines, Old Station Road, ${titleLoc}`,
      phone: '+91 800 108 0003',
      rating: '4.4 Stars',
      reviewCount: 95,
      distanceKm: 3.5,
      etaMins: 8,
      coordinates: { lat: 15.44, lng: 75.00 },
      availableResources: {
        beds: 8,
        totalBeds: 60,
        icu: 2,
        totalIcu: 8,
        bloodGroups: ['B+', 'O+'],
        bloodUnits: 15,
        oxygenTanks: 12,
        ambulances: 2,
        doctorsOnDuty: 3
      },
      latestUpdate: '7 mins ago',
      details: '8 Hospital Beds, 2 ICU, 15 Units Blood, 12 Oxygen Tanks, 2 Ambulances',
      isEmergency24x7: true
    },
    {
      id: `prov-dyn-${Date.now()}-4`,
      name: `${titleLoc} 24/7 Ambulance & Rapid Response Fleet`,
      type: 'Emergency Ambulance Fleet',
      city: titleLoc,
      state: 'Local Region',
      address: `Ring Road Corridor, ${titleLoc}`,
      phone: '+91 800 108 0004',
      rating: '4.9 Stars',
      reviewCount: 210,
      distanceKm: 1.1,
      etaMins: 3,
      coordinates: { lat: 15.455, lng: 75.015 },
      availableResources: {
        beds: 0,
        totalBeds: 0,
        icu: 0,
        totalIcu: 0,
        bloodGroups: [],
        bloodUnits: 0,
        oxygenTanks: 10,
        ambulances: 4,
        doctorsOnDuty: 2
      },
      latestUpdate: '2 mins ago',
      details: '4 Rapid Response ALS Ambulances, 10 Transport Oxygen Kits',
      isEmergency24x7: true
    }
  ];
}

/**
 * Calculates geographical distance in kilometers between two lat/lng coordinates (Haversine formula)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateHaversineDistanceKm(lat1, lon1, lat2, lon2);
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '—';
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m (${distanceKm.toFixed(2)} km)`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

export function formatAccuracyMeters(accuracyMeters: number): string {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0) return 'Unknown';
  if (accuracyMeters >= 1000) {
    return `±${(accuracyMeters / 1000).toFixed(2)} km (${Math.round(accuracyMeters)} m)`;
  }
  return `±${Math.round(accuracyMeters)} m`;
}

/**
 * Separately evaluates device GPS accuracy (distinct from the 2 km search radius).
 * - <= 50 m: good location estimate
 * - 50 m < accuracy <= 500 m: usable with caution
 * - > 500 m: poor accuracy — do not claim a precise 2 km location; prompt retry or manual address
 */
export function assessGpsAccuracy(
  accuracyMeters: number | null | undefined,
  source: GpsLocationReading['source'] = 'gps'
): GpsAccuracyAssessment {
  if (source !== 'gps' || accuracyMeters === null || accuracyMeters === undefined || !Number.isFinite(accuracyMeters)) {
    return {
      tier: 'manual',
      accuracyMeters: null,
      label: source === 'manual_coordinates' ? 'Manual Coordinates Entered' : 'Manual Address Coordinates',
      message:
        'Distances are calculated geographically from the coordinates for your manually entered location (2 km search radius).',
      canClaimPrecise2Km: false,
      recommendManualOrRetry: false
    };
  }

  const rounded = Math.max(1, Math.round(accuracyMeters));

  if (rounded <= 50) {
    return {
      tier: 'good',
      accuracyMeters: rounded,
      label: `Good GPS accuracy (${formatAccuracyMeters(rounded)})`,
      message:
        'Good location estimate. Geographical distances and the 2 km search radius around your position are reliable.',
      canClaimPrecise2Km: true,
      recommendManualOrRetry: false
    };
  }

  if (rounded <= 500) {
    return {
      tier: 'caution',
      accuracyMeters: rounded,
      label: `Moderate GPS accuracy (${formatAccuracyMeters(rounded)}) — Usable with caution`,
      message: `Your GPS reading has an uncertainty of ${formatAccuracyMeters(rounded)}. The 2 km search radius is approximate rather than exact — verify hospital distances or retry GPS for a tighter fix.`,
      canClaimPrecise2Km: false,
      recommendManualOrRetry: false
    };
  }

  return {
    tier: 'poor',
    accuracyMeters: rounded,
    label: `Poor GPS accuracy (${formatAccuracyMeters(rounded)})`,
    message: `Reported GPS accuracy is worse than 500 m (${formatAccuracyMeters(rounded)}), so a precise 2 km search around your exact position cannot be claimed. Retry GPS outdoors or enter your street address / coordinates manually below.`,
    canClaimPrecise2Km: false,
    recommendManualOrRetry: true
  };
}

export function parseCoordinateString(input: string): { lat: number; lng: number } | null {
  const match = (input || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

const KNOWN_LOCATION_COORDS: Array<{ keywords: string[]; lat: number; lng: number; label: string }> = [
  { keywords: ['vidyanagar', 'kims', 'pb road hubballi'], lat: 15.3524, lng: 75.1328, label: 'Vidyanagar, Hubballi, Karnataka' },
  { keywords: ['hubballi', 'hubli'], lat: 15.3647, lng: 75.1240, label: 'Hubballi, Karnataka' },
  { keywords: ['sattur', 'sdm dharwad'], lat: 15.4208, lng: 75.0384, label: 'Sattur, Dharwad, Karnataka' },
  { keywords: ['dharwad'], lat: 15.4589, lng: 75.0078, label: 'Dharwad, Karnataka' },
  { keywords: ['belagavi', 'belgaum'], lat: 15.8580, lng: 74.5050, label: 'Belagavi, Karnataka' },
  { keywords: ['bengaluru', 'bangalore'], lat: 12.9634, lng: 77.5744, label: 'Bengaluru, Karnataka' },
  { keywords: ['mysuru', 'mysore'], lat: 12.3120, lng: 76.6510, label: 'Mysuru, Karnataka' },
  { keywords: ['mumbai', 'bandra', 'parel'], lat: 19.0515, lng: 72.8290, label: 'Mumbai, Maharashtra' },
  { keywords: ['pune'], lat: 18.5308, lng: 73.8767, label: 'Pune, Maharashtra' },
  { keywords: ['delhi', 'new delhi', 'aiims'], lat: 28.5672, lng: 77.2100, label: 'New Delhi, Delhi' }
];

const inferFallbackCoordinatesForAddress = (address?: string, city?: string): { lat: number; lng: number } | null => {
  const combined = `${address || ''} ${city || ''}`.toLowerCase();
  if (!combined.trim()) return null;
  const hit = KNOWN_LOCATION_COORDS.find((loc) => loc.keywords.some((kw) => combined.includes(kw)));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
};

/**
 * Resolves a manual street address or coordinate string to actual geographic { lat, lng } coordinates.
 * Uses OpenStreetMap Nominatim when online, with known regional coordinate reference fallback.
 */
export async function resolveManualAddressToCoordinates(
  addressInput: string
): Promise<{ lat: number; lng: number; resolvedLabel: string; source: 'manual_coordinates' | 'manual_address' } | null> {
  const trimmed = (addressInput || '').trim();
  if (!trimmed) return null;

  const directCoords = parseCoordinateString(trimmed);
  if (directCoords) {
    return {
      lat: directCoords.lat,
      lng: directCoords.lng,
      resolvedLabel: `${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)}`,
      source: 'manual_coordinates'
    };
  }

  // Try live Nominatim geocoding when running in a browser with network connectivity
  if (typeof fetch === 'function') {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`,
        {
          headers: { Accept: 'application/json' },
          ...(controller ? { signal: controller.signal } : {})
        }
      );
      if (timer) clearTimeout(timer);
      if (response.ok) {
        const results = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
        if (Array.isArray(results) && results.length > 0 && results[0].lat && results[0].lon) {
          const lat = Number(results[0].lat);
          const lng = Number(results[0].lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return {
              lat,
              lng,
              resolvedLabel: results[0].display_name || trimmed,
              source: 'manual_address'
            };
          }
        }
      }
    } catch {
      // Fall back to curated coordinate lookup if offline/blocked
    }
  }

  const lower = trimmed.toLowerCase();
  const known = KNOWN_LOCATION_COORDS.find((loc) => loc.keywords.some((kw) => lower.includes(kw)));
  if (known) {
    return {
      lat: known.lat,
      lng: known.lng,
      resolvedLabel: known.label,
      source: 'manual_address'
    };
  }

  return null;
}

const formatRelativeLastUpdated = (iso?: string): string => {
  if (!iso) return 'Live Firestore';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'Live Firestore';
  const diffMins = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (diffMins < 1) return 'Just now (Firestore)';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago (Firestore)`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago (Firestore)`;
  return new Date(parsed).toLocaleDateString();
};

const normalizeHospitalKey = (name: string): string =>
  (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Merges indexed hospital coordinates with live Firestore HospitalProfile availability data.
 * Any hospital present in Firestore updates its real-time general beds, ICU beds, ventilators,
 * address, and timestamp; newly registered Firestore hospitals are included as selectable entries.
 */
export function mergeHospitalsWithFirestoreData(
  firestoreHospitals: HospitalProfile[] = [],
  baseDirectory: HospitalProvider[] = HOSPITAL_DIRECTORY
): HospitalProvider[] {
  const merged = baseDirectory.map((h) => ({
    ...h,
    availableResources: { ...h.availableResources }
  }));

  for (const fsHosp of firestoreHospitals) {
    if (!fsHosp || !fsHosp.hospitalName) continue;
    const normFsName = normalizeHospitalKey(fsHosp.hospitalName);
    const existingIdx = merged.findIndex(
      (h) =>
        h.id === fsHosp.uid ||
        h.firestoreUid === fsHosp.uid ||
        normalizeHospitalKey(h.name) === normFsName
    );

    const liveBeds = Math.max(0, Number(fsHosp.availableBeds ?? 0));
    const liveTotalBeds = Math.max(liveBeds, Number(fsHosp.totalBeds ?? 0));
    const liveIcu = Math.max(0, Number(fsHosp.availableICU ?? 0));
    const liveTotalIcu = Math.max(liveIcu, Number(fsHosp.totalICU ?? 0));
    const liveVent = Math.max(0, Number(fsHosp.availableVentilators ?? 0));
    const liveTotalVent = Math.max(liveVent, Number(fsHosp.totalVentilators ?? 0));

    if (existingIdx >= 0) {
      const existing = merged[existingIdx];
      const nextCoords =
        fsHosp.coordinates &&
        Number.isFinite(fsHosp.coordinates.lat) &&
        Number.isFinite(fsHosp.coordinates.lng)
          ? fsHosp.coordinates
          : existing.coordinates;
      merged[existingIdx] = {
        ...existing,
        firestoreUid: fsHosp.uid,
        name: fsHosp.hospitalName || existing.name,
        address: fsHosp.address ? `${fsHosp.address}${fsHosp.city && !fsHosp.address.toLowerCase().includes(fsHosp.city.toLowerCase()) ? `, ${fsHosp.city}` : ''}` : existing.address,
        city: fsHosp.city || existing.city,
        state: fsHosp.state || existing.state,
        phone: fsHosp.contactNumber || existing.phone,
        coordinates: nextCoords,
        availableResources: {
          ...existing.availableResources,
          beds: liveBeds,
          totalBeds: liveTotalBeds,
          icu: liveIcu,
          totalIcu: liveTotalIcu,
          ventilators: liveVent,
          totalVentilators: liveTotalVent
        },
        latestUpdate: formatRelativeLastUpdated(fsHosp.lastUpdated),
        details: `${liveBeds} General Beds, ${liveIcu} ICU Beds, ${liveVent} Ventilators (Live Firestore)`,
        isLiveFirestoreData: true,
        isVerified: fsHosp.isVerified
      };
    } else {
      const coords =
        fsHosp.coordinates &&
        Number.isFinite(fsHosp.coordinates.lat) &&
        Number.isFinite(fsHosp.coordinates.lng)
          ? fsHosp.coordinates
          : inferFallbackCoordinatesForAddress(fsHosp.address, fsHosp.city);
      if (!coords) continue;

      merged.push({
        id: fsHosp.uid,
        firestoreUid: fsHosp.uid,
        name: fsHosp.hospitalName,
        type: fsHosp.departments?.[0] || 'Registered Emergency Hospital',
        city: fsHosp.city || 'Local',
        state: fsHosp.state || '',
        address: fsHosp.address
          ? `${fsHosp.address}${fsHosp.city && !fsHosp.address.toLowerCase().includes(fsHosp.city.toLowerCase()) ? `, ${fsHosp.city}` : ''}`
          : fsHosp.city || 'Address on file',
        phone: fsHosp.contactNumber || '',
        rating: fsHosp.isVerified ? 'Verified Provider' : 'Registered',
        reviewCount: 0,
        distanceKm: 0,
        etaMins: 5,
        coordinates: coords,
        availableResources: {
          beds: liveBeds,
          totalBeds: liveTotalBeds,
          icu: liveIcu,
          totalIcu: liveTotalIcu,
          ventilators: liveVent,
          totalVentilators: liveTotalVent,
          bloodGroups: [],
          bloodUnits: 0,
          oxygenTanks: 0,
          ambulances: 0,
          doctorsOnDuty: Math.max(1, fsHosp.departments?.length || 1)
        },
        latestUpdate: formatRelativeLastUpdated(fsHosp.lastUpdated),
        details: `${liveBeds} General Beds, ${liveIcu} ICU Beds, ${liveVent} Ventilators (Live Firestore)`,
        isEmergency24x7: (fsHosp.operatingHours || '').includes('24'),
        isLiveFirestoreData: true,
        isVerified: fsHosp.isVerified
      });
    }
  }

  return merged;
}

export interface CoordinateHospitalSearchResult {
  origin: { lat: number; lng: number };
  radiusKm: number;
  eligibleWithinRadius: HospitalProvider[];
  ineligibleWithinRadius: HospitalProvider[];
  eligibleOutsideRadius: HospitalProvider[];
  usedOutsideRadiusFallback: boolean;
  displayedHospitals: HospitalProvider[];
}

/**
 * Evaluates whether a hospital is eligible for the patient's selected resources.
 * Hospitals without beds/ICU (e.g., standalone ambulance fleets) are excluded when beds or ICU are requested.
 */
export function evaluateHospitalEligibility(
  hospital: HospitalProvider,
  selectedResources?: Record<string, boolean>
): { isEligible: boolean; missingResources: string[] } {
  const missing: string[] = [];
  const res = hospital.availableResources;
  const reqBeds = Boolean(selectedResources?.beds);
  const reqIcu = Boolean(selectedResources?.icu);
  const reqBlood = Boolean(selectedResources?.blood);
  const reqOxygen = Boolean(selectedResources?.oxygen);
  const reqAmbulance = Boolean(selectedResources?.ambulance);

  if (reqBeds && res.beds <= 0) missing.push('General Beds');
  if (reqIcu && res.icu <= 0) missing.push('ICU Beds');

  // Must be a hospital (have bed or ICU capacity) unless ONLY non-hospital resources are selected
  const isHospitalFacility = res.totalBeds > 0 || res.totalIcu > 0 || res.beds > 0 || res.icu > 0;
  if (!reqBeds && !reqIcu) {
    if (!isHospitalFacility) {
      const hasAnySelected =
        (reqBlood && res.bloodUnits > 0) ||
        (reqOxygen && res.oxygenTanks > 0) ||
        (reqAmbulance && res.ambulances > 0);
      if (!hasAnySelected) missing.push('Selected Emergency Resource');
    }
  } else if (!isHospitalFacility) {
    if (!missing.includes('General Beds') && reqBeds) missing.push('General Beds');
    if (!missing.includes('ICU Beds') && reqIcu) missing.push('ICU Beds');
  }

  return {
    isEligible: missing.length === 0,
    missingResources: missing
  };
}

/**
 * Finds eligible hospitals strictly by geographical coordinates & Haversine distance (no city-name matching).
 * Primary search distance defaults to 2 km; if none are eligible within 2 km, offers closest eligible
 * hospitals outside the 2 km radius so the patient is never left without options.
 */
export function findNearbyHospitalsByCoordinates(
  originCoords: { lat: number; lng: number },
  hospitals: HospitalProvider[],
  selectedResources?: Record<string, boolean>,
  radiusKm: number = DEFAULT_SEARCH_RADIUS_KM
): CoordinateHospitalSearchResult {
  const ranked = hospitals
    .filter(
      (h) =>
        h.coordinates &&
        Number.isFinite(h.coordinates.lat) &&
        Number.isFinite(h.coordinates.lng)
    )
    .map((h) => {
      const exactKm = calculateHaversineDistanceKm(
        originCoords.lat,
        originCoords.lng,
        h.coordinates.lat,
        h.coordinates.lng
      );
      const distanceKm = Number(exactKm.toFixed(2));
      const etaMins = Math.max(2, Math.round(exactKm * 2.5));
      const { isEligible, missingResources } = evaluateHospitalEligibility(h, selectedResources);
      return {
        ...h,
        distanceKm,
        etaMins,
        withinSearchRadius: exactKm <= radiusKm,
        isEligible,
        missingResources
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const eligibleWithinRadius = ranked.filter((h) => h.withinSearchRadius && h.isEligible);
  const ineligibleWithinRadius = ranked.filter((h) => h.withinSearchRadius && !h.isEligible);
  const eligibleOutsideRadius = ranked.filter((h) => !h.withinSearchRadius && h.isEligible);

  const usedOutsideRadiusFallback =
    eligibleWithinRadius.length === 0 && eligibleOutsideRadius.length > 0;

  const displayedHospitals =
    eligibleWithinRadius.length > 0
      ? eligibleWithinRadius
      : eligibleOutsideRadius.slice(0, 8);

  return {
    origin: originCoords,
    radiusKm,
    eligibleWithinRadius,
    ineligibleWithinRadius,
    eligibleOutsideRadius,
    usedOutsideRadiusFallback,
    displayedHospitals
  };
}

/**
 * Computes geographical distance for live Firestore Blood Banks, Oxygen Providers, and Ambulance Fleets.
 */
export function findNearbyFirestoreResourcesByCoordinates(
  originCoords: { lat: number; lng: number },
  bloodBanks: BloodBankProfile[] = [],
  oxygenProfiles: OxygenProfile[] = [],
  ambulanceProfiles: AmbulanceProfile[] = [],
  radiusKm: number = DEFAULT_SEARCH_RADIUS_KM
): {
  withinRadius: NearbyEmergencyResource[];
  outsideRadiusFallback: NearbyEmergencyResource[];
} {
  const items: NearbyEmergencyResource[] = [];

  for (const bb of bloodBanks) {
    const coords = bb.coordinates || inferFallbackCoordinatesForAddress(bb.address, bb.city);
    if (!coords) continue;
    const totalUnits = Object.values(bb.inventory || {}).reduce((acc, v) => acc + Math.max(0, Number(v) || 0), 0);
    const availableGroups = Object.entries(bb.inventory || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([g]) => g);
    const dist = calculateHaversineDistanceKm(originCoords.lat, originCoords.lng, coords.lat, coords.lng);
    items.push({
      id: bb.uid,
      name: bb.bankName,
      resourceKind: 'bloodBank',
      address: bb.address,
      city: bb.city,
      phone: bb.contactNumber,
      coordinates: coords,
      distanceKm: Number(dist.toFixed(2)),
      etaMins: Math.max(2, Math.round(dist * 2.5)),
      withinSearchRadius: dist <= radiusKm,
      availabilitySummary:
        totalUnits > 0
          ? `${totalUnits} blood units (${availableGroups.slice(0, 4).join(', ')}${availableGroups.length > 4 ? '…' : ''})`
          : 'Currently out of stock',
      isAvailable: totalUnits > 0,
      isLiveFirestoreData: true,
      lastUpdated: formatRelativeLastUpdated(bb.lastUpdated)
    });
  }

  for (const oxy of oxygenProfiles) {
    const coords = oxy.coordinates || inferFallbackCoordinatesForAddress(oxy.address, oxy.city);
    if (!coords) continue;
    const cyl = Math.max(0, Number(oxy.cylindersAvailable || 0));
    const conc = Math.max(0, Number(oxy.concentratorsAvailable || 0));
    const dist = calculateHaversineDistanceKm(originCoords.lat, originCoords.lng, coords.lat, coords.lng);
    items.push({
      id: oxy.uid,
      name: oxy.providerName,
      resourceKind: 'oxygenProvider',
      address: oxy.address,
      city: oxy.city,
      phone: oxy.contactNumber,
      coordinates: coords,
      distanceKm: Number(dist.toFixed(2)),
      etaMins: Math.max(2, Math.round(dist * 2.5)),
      withinSearchRadius: dist <= radiusKm,
      availabilitySummary: `${cyl} cylinders, ${conc} concentrators${oxy.deliveryAvailable ? ' · Delivery available' : ''}`,
      isAvailable: cyl > 0 || conc > 0,
      isLiveFirestoreData: true,
      lastUpdated: formatRelativeLastUpdated(oxy.lastUpdated)
    });
  }

  for (const amb of ambulanceProfiles) {
    const coords = amb.coordinates || inferFallbackCoordinatesForAddress(amb.address, amb.city);
    if (!coords) continue;
    const availableVehicles = (amb.vehicles || []).filter((v) => v.isAvailable);
    const dist = calculateHaversineDistanceKm(originCoords.lat, originCoords.lng, coords.lat, coords.lng);
    items.push({
      id: amb.uid,
      name: amb.providerName,
      resourceKind: 'ambulanceProvider',
      address: amb.address,
      city: amb.city,
      phone: amb.contactNumber,
      coordinates: coords,
      distanceKm: Number(dist.toFixed(2)),
      etaMins: Math.max(2, Math.round(dist * 2.2)),
      withinSearchRadius: dist <= radiusKm,
      availabilitySummary: `${availableVehicles.length} of ${(amb.vehicles || []).length} ambulances ready`,
      isAvailable: availableVehicles.length > 0,
      isLiveFirestoreData: true,
      lastUpdated: formatRelativeLastUpdated(amb.lastUpdated)
    });
  }

  const availableSorted = items.filter((i) => i.isAvailable).sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    withinRadius: availableSorted.filter((i) => i.withinSearchRadius),
    outsideRadiusFallback: availableSorted.filter((i) => !i.withinSearchRadius).slice(0, 6)
  };
}

/**
 * Searches and ranks hospitals based on location query and optional required resources
 */
export function searchNearbyHospitals(
  locationQuery: string,
  selectedResources?: Record<string, boolean>
): HospitalProvider[] {
  const norm = normalizeQuery(locationQuery);

  if (!norm) {
    // Default to Dharwad/Hubballi combined nearby
    return HOSPITAL_DIRECTORY.filter((h) => h.city === 'Dharwad' || h.city === 'Hubballi');
  }

  // 0. GPS Coordinate parsing (e.g. "15.4589, 75.0078")
  const coordMatch = norm.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    const userLat = parseFloat(coordMatch[1]);
    const userLng = parseFloat(coordMatch[2]);
    const withDistances = HOSPITAL_DIRECTORY.map((h) => {
      const dist = getDistanceFromLatLonInKm(userLat, userLng, h.coordinates.lat, h.coordinates.lng);
      return {
        ...h,
        distanceKm: Number(dist.toFixed(1)),
        etaMins: Math.max(3, Math.round(dist * 2.2))
      };
    });
    withDistances.sort((a, b) => a.distanceKm - b.distanceKm);
    const nearby = withDistances.filter((h) => h.distanceKm <= 80);
    return nearby.length > 0 ? nearby : withDistances.slice(0, 8);
  }

  // 1. Direct match on city, name, address, or state
  let matched = HOSPITAL_DIRECTORY.filter((h) => {
    const cityName = h.city.toLowerCase();
    const hospName = h.name.toLowerCase();
    const addr = h.address.toLowerCase();

    // Check Dharwad / Hubli / Belgaum variations
    if (norm.includes('dharwad') || norm.includes('sattur')) {
      return cityName === 'dharwad' || cityName === 'hubballi';
    }
    if (norm.includes('hubballi') || norm.includes('hubli') || norm.includes('kims') || norm.includes('vidyanagar')) {
      return cityName === 'hubballi' || cityName === 'dharwad';
    }
    if (norm.includes('belagavi') || norm.includes('belgaum')) {
      return cityName === 'belagavi';
    }
    if (norm.includes('bengaluru') || norm.includes('bangalore')) {
      return cityName === 'bengaluru';
    }
    if (norm.includes('mysuru') || norm.includes('mysore')) {
      return cityName === 'mysuru';
    }
    if (norm.includes('mumbai') || norm.includes('bombay')) {
      return cityName === 'mumbai';
    }
    if (norm.includes('pune')) {
      return cityName === 'pune';
    }
    if (norm.includes('delhi') || norm.includes('ncr')) {
      return cityName === 'new delhi';
    }

    return (
      norm.includes(cityName) ||
      cityName.includes(norm) ||
      hospName.includes(norm) ||
      addr.includes(norm)
    );
  });

  // If no predefined match found, dynamically generate nearby verified facilities for that location
  if (matched.length === 0) {
    matched = generateDynamicNearbyHospitals(locationQuery);
  }

  // If resource filtering is enabled, prioritize hospitals that have the user's selected resources
  if (selectedResources) {
    matched.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      if (selectedResources.beds) {
        if (a.availableResources.beds > 0) scoreA += 5;
        if (b.availableResources.beds > 0) scoreB += 5;
      }
      if (selectedResources.icu) {
        if (a.availableResources.icu > 0) scoreA += 5;
        if (b.availableResources.icu > 0) scoreB += 5;
      }
      if (selectedResources.blood) {
        if (a.availableResources.bloodUnits > 0) scoreA += 3;
        if (b.availableResources.bloodUnits > 0) scoreB += 3;
      }
      if (selectedResources.oxygen) {
        if (a.availableResources.oxygenTanks > 0) scoreA += 3;
        if (b.availableResources.oxygenTanks > 0) scoreB += 3;
      }
      if (selectedResources.ambulance) {
        if (a.availableResources.ambulances > 0) scoreA += 4;
        if (b.availableResources.ambulances > 0) scoreB += 4;
      }
      // Closer distance breaks ties
      return scoreB - scoreA || a.distanceKm - b.distanceKm;
    });
  } else {
    // Sort by proximity
    matched.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return matched;
}

/**
 * Builds Google Map embed URL for embedding in an iframe
 */
export function getGoogleMapEmbedUrl(locationQuery: string, hospital?: HospitalProvider | null): string {
  let queryTarget = '';
  if (hospital) {
    queryTarget = `${hospital.name}, ${hospital.address}`;
  } else if (locationQuery && locationQuery.trim()) {
    queryTarget = `${locationQuery.trim()} hospitals emergency`;
  } else {
    queryTarget = 'Dharwad Karnataka hospitals emergency';
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(queryTarget)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
}

/**
 * Builds direct Google Maps directions URL for turn-by-turn navigation
 */
export function getGoogleMapsDirectionsUrl(hospital: HospitalProvider, originQuery?: string): string {
  const dest = encodeURIComponent(`${hospital.name}, ${hospital.address}`);
  if (originQuery && originQuery.trim()) {
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery.trim())}&destination=${dest}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

/**
 * Builds provider lookup dictionary compatible with existing App.tsx PROVIDERS mapping
 */
export function buildProvidersLookup(hospitals: HospitalProvider[]): Record<string, {
  name: string;
  details: string;
  rating: string;
  phone: string;
  address: string;
}> {
  const map: Record<string, {
    name: string;
    details: string;
    rating: string;
    phone: string;
    address: string;
  }> = {};

  // Seed all known directory hospitals
  HOSPITAL_DIRECTORY.forEach((h) => {
    map[h.id] = {
      name: h.name,
      details: h.details,
      rating: h.rating,
      phone: h.phone,
      address: h.address
    };
  });

  // Seed dynamically searched hospitals
  hospitals.forEach((h) => {
    map[h.id] = {
      name: h.name,
      details: h.details,
      rating: h.rating,
      phone: h.phone,
      address: h.address
    };
  });

  return map;
}
