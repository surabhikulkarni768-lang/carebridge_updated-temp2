import {
  searchNearbyHospitals,
  getGoogleMapEmbedUrl,
  getGoogleMapsDirectionsUrl,
  buildProvidersLookup,
  POPULAR_LOCATIONS,
  HOSPITAL_DIRECTORY
} from '../src/services/hospitalDirectoryService';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('====================================================');
console.log('CAREBRIDGE HOSPITAL DIRECTORY & MAP VERIFICATION');
console.log('====================================================');

// 1. Directory size check
assert(HOSPITAL_DIRECTORY.length >= 25, 'Total Indexed Hospitals', `Found ${HOSPITAL_DIRECTORY.length} hospitals`);

// 2. Dharwad search returns multiple hospitals
const dharwadResults = searchNearbyHospitals('dharwad, Karnataka, India');
assert(dharwadResults.length >= 5, 'Dharwad Multiple Hospitals Found', `Found ${dharwadResults.length} hospitals for Dharwad`);
const hasSDM = dharwadResults.some(h => h.name.includes('SDM'));
const hasCivil = dharwadResults.some(h => h.name.includes('Civil'));
assert(hasSDM && hasCivil, 'Dharwad Landmark Hospitals Present (SDM & Civil Hospital)');

// 3. Hubballi search returns multiple hospitals (including legacy prov-01, prov-02, prov-03)
const hubliResults = searchNearbyHospitals('Hubballi, Karnataka');
assert(hubliResults.length >= 5, 'Hubballi Multiple Hospitals Found', `Found ${hubliResults.length} hospitals for Hubballi`);
const hasProv1 = hubliResults.some(h => h.id === 'prov-01');
const hasProv2 = hubliResults.some(h => h.id === 'prov-02');
assert(hasProv1 && hasProv2, 'Backward Compatibility: prov-01 & prov-02 mapped in Hubballi');

// 4. Belagavi search
const belagaviResults = searchNearbyHospitals('Belagavi');
assert(belagaviResults.length >= 3, 'Belagavi Hospitals Found', `Found ${belagaviResults.length} hospitals for Belagavi`);

// 5. Bengaluru search
const bngResults = searchNearbyHospitals('Bengaluru');
assert(bngResults.length >= 4, 'Bengaluru Hospitals Found', `Found ${bngResults.length} hospitals for Bengaluru`);

// 6. GPS Geolocation coordinate matching
const gpsResults = searchNearbyHospitals('15.4589, 75.0078');
assert(gpsResults.length >= 5, 'GPS Coordinate Resolution', `Resolved ${gpsResults.length} hospitals for coordinates`);
assert(gpsResults[0].distanceKm < 30, 'GPS Proximity Sorting', `Closest hospital is ${gpsResults[0].distanceKm} km away`);

// 7. Dynamic fallback for arbitrary unindexed towns
const customTownResults = searchNearbyHospitals('Sirsi, Karnataka');
assert(customTownResults.length >= 3, 'Dynamic Fallback for Unindexed Town', `Generated ${customTownResults.length} facilities for Sirsi`);
assert(customTownResults[0].city === 'Sirsi', 'Dynamic Fallback Locality Preservation');

// 8. Google Maps Embed URL generation
const embedUrl = getGoogleMapEmbedUrl('Dharwad, Karnataka', dharwadResults[0]);
assert(embedUrl.includes('output=embed') && embedUrl.includes('maps.google.com'), 'Google Maps Embed URL Valid');

// 9. Google Maps Directions URL generation
const dirUrl = getGoogleMapsDirectionsUrl(dharwadResults[0], 'Hubballi');
assert(dirUrl.includes('google.com/maps/dir') && dirUrl.includes('destination='), 'Google Maps Directions URL Valid');

// 10. Provider Lookup Dictionary
const lookup = buildProvidersLookup(dharwadResults);
assert(lookup['prov-01'] !== undefined, 'Lookup Dictionary has prov-01');
assert(lookup['prov-dh-01'] !== undefined, 'Lookup Dictionary has SDM Dharwad');
assert(lookup['prov-dh-01'].name.includes('SDM'), 'Lookup Dictionary name correct');

// 11. Resource prioritizing
const icuResourceResults = searchNearbyHospitals('Dharwad', { beds: true, icu: true });
assert(icuResourceResults[0].availableResources.icu > 0, 'Resource Sorting Prioritizes ICU availability');

console.log('====================================================');
console.log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
