/**
 * CareBridge GPS Coordinate-Based Nearby Hospitals & Live Firestore Availability Verification Suite
 * Validates:
 * 1. Exact Haversine geographical distance calculations from actual lat/lng coordinates.
 * 2. Strict separation of 2 km search radius vs GPS accuracy tiers:
 *    - <= 50 m: good location estimate (can claim precise 2 km)
 *    - 50–500 m: usable with caution (cannot claim precise 2 km)
 *    - > 500 m: poor accuracy (recommends retry GPS or manual address entry)
 * 3. Eligible hospital filtering within 2 km radius using coordinates (not city name matching).
 * 4. Automatic outside-2 km fallback when no eligible hospital is found within 2 km.
 * 5. Live Firestore HospitalProfile availability updates (general beds, ICU beds) override static counts.
 * 6. Live Firestore emergency resources (Blood Banks, Oxygen, Ambulances) distance calculation.
 * 7. Manual coordinate and address parsing/resolution.
 */

import assert from 'node:assert/strict';
import {
  DEFAULT_SEARCH_RADIUS_KM,
  HOSPITAL_DIRECTORY,
  assessGpsAccuracy,
  calculateHaversineDistanceKm,
  formatDistanceKm,
  parseCoordinateString,
  mergeHospitalsWithFirestoreData,
  findNearbyHospitalsByCoordinates,
  findNearbyFirestoreResourcesByCoordinates
} from '../src/services/hospitalDirectoryService';
import type {
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile
} from '../src/types';

function runTests() {
  const passed: string[] = [];
  const check = (name: string, fn: () => void) => {
    fn();
    passed.push(name);
    console.log(`[PASS] ${name}`);
  };

  check('Default search radius is 2 km', () => {
    assert.equal(DEFAULT_SEARCH_RADIUS_KM, 2);
  });

  check('Haversine geographical distance accurately measures coordinate distances', () => {
    // KIMS Hubballi (15.3524, 75.1328) to St. Luke's Hubballi (15.3647, 75.1240) ~ 1.66 km
    const distKm = calculateHaversineDistanceKm(15.3524, 75.1328, 15.3647, 75.1240);
    assert.ok(distKm > 1.4 && distKm < 1.9, `Expected ~1.66 km, got ${distKm}`);
    assert.match(formatDistanceKm(0.45), /450 m/);
    assert.match(formatDistanceKm(1.66), /1\.66 km/);
  });

  check('GPS accuracy is strictly classified separately from the 2 km search radius', () => {
    const good = assessGpsAccuracy(25, 'gps');
    assert.equal(good.tier, 'good');
    assert.equal(good.canClaimPrecise2Km, true);
    assert.equal(good.recommendManualOrRetry, false);

    const caution = assessGpsAccuracy(180, 'gps');
    assert.equal(caution.tier, 'caution');
    assert.equal(caution.canClaimPrecise2Km, false);
    assert.equal(caution.recommendManualOrRetry, false);

    const poor = assessGpsAccuracy(1200, 'gps');
    assert.equal(poor.tier, 'poor');
    assert.equal(poor.canClaimPrecise2Km, false);
    assert.equal(poor.recommendManualOrRetry, true);

    const manual = assessGpsAccuracy(null, 'manual_address');
    assert.equal(manual.tier, 'manual');
    assert.equal(manual.canClaimPrecise2Km, false);
  });

  check('Live Firestore HospitalProfile updates displayed general beds and ICU beds', () => {
    const liveFirestoreHospitals: HospitalProfile[] = [
      {
        uid: 'hosp-demo-01',
        hospitalName: 'KIMS Super Specialty Hospital',
        registrationNumber: 'KA-HUB-HOSP-2024-0091',
        departments: ['Emergency Trauma', 'ICU'],
        totalBeds: 250,
        availableBeds: 19,
        totalICU: 30,
        availableICU: 3,
        totalVentilators: 18,
        availableVentilators: 2,
        contactNumber: '+91 836 222 5555',
        operatingHours: '24/7',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Vidyanagar, PB Road, Hubballi',
        coordinates: { lat: 15.3524, lng: 75.1328 },
        isVerified: true,
        lastUpdated: new Date().toISOString()
      },
      {
        uid: 'hosp-new-fs-01',
        hospitalName: 'Navanagar Trauma Care Hospital',
        registrationNumber: 'KA-HUB-HOSP-2026-0999',
        departments: ['Emergency Trauma'],
        totalBeds: 80,
        availableBeds: 11,
        totalICU: 12,
        availableICU: 4,
        totalVentilators: 5,
        availableVentilators: 2,
        contactNumber: '+91 836 290 1111',
        operatingHours: '24/7',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Navanagar Bypass, Hubballi',
        coordinates: { lat: 15.3550, lng: 75.1350 },
        isVerified: true,
        lastUpdated: new Date().toISOString()
      }
    ];

    const merged = mergeHospitalsWithFirestoreData(liveFirestoreHospitals, HOSPITAL_DIRECTORY);
    const kims = merged.find((h) => h.name === 'KIMS Super Specialty Hospital');
    assert.ok(kims, 'Expected KIMS hospital in merged directory');
    assert.equal(kims.isLiveFirestoreData, true);
    assert.equal(kims.availableResources.beds, 19);
    assert.equal(kims.availableResources.icu, 3);

    const newHosp = merged.find((h) => h.id === 'hosp-new-fs-01');
    assert.ok(newHosp, 'Expected newly registered Firestore hospital to be included');
    assert.equal(newHosp.availableResources.beds, 11);
    assert.equal(newHosp.availableResources.icu, 4);
  });

  check('Coordinate search returns eligible hospitals within 2 km and excludes ineligible ones', () => {
    const firestoreZeroIcu: HospitalProfile[] = [
      {
        uid: 'hosp-zero-icu',
        hospitalName: 'KIMS Super Specialty Hospital',
        registrationNumber: 'KA-01',
        departments: ['Emergency'],
        totalBeds: 250,
        availableBeds: 20,
        totalICU: 30,
        availableICU: 0, // No ICU beds available!
        totalVentilators: 10,
        availableVentilators: 0,
        contactNumber: '+91 836 222 5555',
        operatingHours: '24/7',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Vidyanagar, PB Road, Hubballi',
        coordinates: { lat: 15.3524, lng: 75.1328 },
        isVerified: true,
        lastUpdated: new Date().toISOString()
      }
    ];
    const merged = mergeHospitalsWithFirestoreData(firestoreZeroIcu, HOSPITAL_DIRECTORY);
    // Patient standing right next to KIMS (15.3530, 75.1330), requesting beds + ICU
    const result = findNearbyHospitalsByCoordinates(
      { lat: 15.3530, lng: 75.1330 },
      merged,
      { beds: true, icu: true },
      2
    );

    assert.equal(result.usedOutsideRadiusFallback, false);
    assert.ok(result.eligibleWithinRadius.length >= 1, 'Expected eligible hospitals within 2 km');
    assert.ok(result.eligibleWithinRadius.every((h) => h.distanceKm <= 2));
    assert.ok(result.eligibleWithinRadius.every((h) => h.availableResources.beds > 0 && h.availableResources.icu > 0));
    assert.ok(
      !result.eligibleWithinRadius.some((h) => h.name === 'KIMS Super Specialty Hospital'),
      'KIMS with 0 live Firestore ICU beds should not be marked eligible when ICU is required'
    );
    assert.ok(
      result.ineligibleWithinRadius.some((h) => h.name === 'KIMS Super Specialty Hospital'),
      'KIMS should appear in ineligibleWithinRadius'
    );
  });

  check('Outside-2 km fallback offers nearest eligible hospitals when none exist within 2 km', () => {
    // Coordinates roughly midway between Hubballi & Dharwad (> 2 km from any hospital)
    const remotePoint = { lat: 15.3950, lng: 75.0800 };
    const result = findNearbyHospitalsByCoordinates(
      remotePoint,
      HOSPITAL_DIRECTORY,
      { beds: true, icu: true },
      2
    );
    assert.equal(result.eligibleWithinRadius.length, 0);
    assert.equal(result.usedOutsideRadiusFallback, true);
    assert.ok(result.displayedHospitals.length > 0, 'Must still offer nearby hospitals outside 2 km');
    assert.ok(result.displayedHospitals[0].distanceKm > 2);
    // Ensure sorted strictly by ascending geographical distance
    for (let i = 1; i < result.displayedHospitals.length; i += 1) {
      assert.ok(result.displayedHospitals[i].distanceKm >= result.displayedHospitals[i - 1].distanceKm);
    }
  });

  check('Live Firestore Blood Banks, Oxygen Depots, and Ambulances compute exact distances', () => {
    const bloodBanks: BloodBankProfile[] = [
      {
        uid: 'bb-1',
        bankName: 'Red Cross Regional Blood Centre',
        licenseNumber: 'L1',
        inventory: { 'A+': 10, 'A-': 2, 'B+': 15, 'B-': 1, 'AB+': 4, 'AB-': 0, 'O+': 20, 'O-': 3 },
        contactNumber: '123',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Club Road, Hubballi',
        coordinates: { lat: 15.3548, lng: 75.1392 },
        isVerified: true,
        lastUpdated: new Date().toISOString()
      }
    ];
    const oxygenProfiles: OxygenProfile[] = [
      {
        uid: 'oxy-1',
        providerName: 'OxyLife Medical Gas',
        licenseNumber: 'O1',
        cylindersAvailable: 25,
        concentratorsAvailable: 8,
        deliveryAvailable: true,
        contactNumber: '456',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Gokul Road, Hubballi',
        coordinates: { lat: 15.3612, lng: 75.1095 },
        isVerified: true,
        lastUpdated: new Date().toISOString()
      }
    ];
    const ambulanceProfiles: AmbulanceProfile[] = [
      {
        uid: 'amb-1',
        providerName: 'SwiftCare Ambulance Fleet',
        licenseNumber: 'A1',
        contactNumber: '789',
        city: 'Hubballi',
        state: 'Karnataka',
        address: 'Station Road, Hubballi',
        coordinates: { lat: 15.3580, lng: 75.1420 },
        isVerified: true,
        vehicles: [
          {
            vehicleId: 'KA-25-1081',
            vehicleType: 'ALS',
            driverName: 'Ramesh',
            driverPhone: '999',
            isAvailable: true,
            currentStatus: 'idle'
          }
        ],
        lastUpdated: new Date().toISOString()
      }
    ];

    const nearby = findNearbyFirestoreResourcesByCoordinates(
      { lat: 15.3530, lng: 75.1340 },
      bloodBanks,
      oxygenProfiles,
      ambulanceProfiles,
      2
    );
    assert.ok(nearby.withinRadius.length >= 2, 'Expected blood bank & ambulance within 2 km');
    assert.ok(nearby.withinRadius.every((r) => r.distanceKm <= 2 && r.isLiveFirestoreData));
  });

  check('Manual coordinate parsing validates latitude/longitude ranges', () => {
    const valid = parseCoordinateString('15.3524, 75.1328');
    assert.deepEqual(valid, { lat: 15.3524, lng: 75.1328 });
    assert.equal(parseCoordinateString('95.0, 75.0'), null);
    assert.equal(parseCoordinateString('Hubballi, Karnataka'), null);
  });

  console.log(`\nNearby GPS & Live Firestore Hospital Suite: ${passed.length} passed.`);
}

runTests();
