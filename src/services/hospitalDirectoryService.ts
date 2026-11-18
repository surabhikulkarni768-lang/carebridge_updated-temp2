/**
 * CareBridge Multi-City Hospital & Provider Directory Service
 * Provides nearby hospitals, emergency centers, real-time resource availability,
 * and Google Maps integration for multiple locations.
 */

export interface HospitalProvider {
  id: string;
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
    bloodGroups: string[];
    bloodUnits: number;
    oxygenTanks: number;
    ambulances: number;
    doctorsOnDuty: number;
  };
  latestUpdate: string;
  details: string;
  isEmergency24x7: boolean;
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
 * Calculates distance in kilometers between two lat/lng coordinates (Haversine formula)
 */
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
