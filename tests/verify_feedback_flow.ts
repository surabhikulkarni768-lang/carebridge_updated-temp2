/**
 * CareBridge Completed-Case Patient Feedback Verification Suite
 * Verifies:
 * 1. Completing an emergency case does NOT require feedback (non-mandatory).
 * 2. Marking a case completed automatically triggers a patient feedback-available notification.
 * 3. Feedback cannot be submitted before a case reaches Completed status.
 * 4. Ambulance service rating applicability detection (applicable vs not applicable).
 * 5. Valid feedback submission saves Case ID, all ratings, provider/hospital metadata, and comments.
 * 6. Duplicate feedback submission for the same completed case is strictly rejected (1 per case).
 * 7. Admin dashboard filtering by provider, hospital, date range, and search works accurately.
 * 8. Admin average ratings calculate accurately (and exclude N/A ambulance cases from ambulance avg).
 */

import assert from 'node:assert/strict';
import {
  dataStore,
  isCaseCompletedStatus,
  isAmbulanceApplicableForCase,
  extractFeedbackProviderMetadata,
  submitCaseFeedbackToFirestore,
  calculateFeedbackAverages,
  filterCaseFeedback
} from '../src/services/dataService';
import type { EmergencyCase, ResourceRequest } from '../src/types';

async function runFeedbackTests() {
  const passed: string[] = [];
  const check = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    passed.push(name);
    console.log(`[PASS] ${name}`);
  };

  const patientUid = 'patient-fb-test-01';
  const caseWithAmbId = `CB-FB-AMB-${Date.now()}`;
  const caseNoAmbId = `CB-FB-NOAMB-${Date.now()}`;

  const caseWithAmb: EmergencyCase = {
    caseId: caseWithAmbId,
    patientUid,
    patientName: 'Aarav Kulkarni',
    patientAge: 54,
    patientGender: 'Male',
    conditionSummary: 'Acute chest discomfort',
    urgencyLevel: 'immediate',
    resourcesNeeded: ['bed', 'icu', 'ambulance'],
    assignedHospitalUid: 'hosp-demo-01',
    assignedHospitalName: 'KIMS Super Specialty Hospital',
    assignedAmbulanceUid: 'amb-demo-01',
    assignedAmbulanceName: 'SwiftCare Emergency Ambulance Fleet',
    status: 'IN_PROGRESS',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:30:00.000Z'
  };

  const caseNoAmb: EmergencyCase = {
    caseId: caseNoAmbId,
    patientUid,
    patientName: 'Meera Joshi',
    patientAge: 34,
    patientGender: 'Female',
    conditionSummary: 'Severe anemia requiring blood & oxygen',
    urgencyLevel: 'urgent',
    resourcesNeeded: ['bed', 'blood', 'oxygen'],
    assignedHospitalUid: 'hosp-city-02',
    assignedHospitalName: 'City Care Trauma Centre',
    assignedBloodBankUid: 'blood-demo-01',
    assignedBloodBankName: 'Red Cross Regional Blood Centre',
    status: 'IN_PROGRESS',
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:30:00.000Z'
  };

  dataStore.createCase(caseWithAmb);
  dataStore.createCase(caseNoAmb);

  await check('Feedback submission is blocked before case reaches Completed status', async () => {
    assert.equal(isCaseCompletedStatus(caseWithAmb.status), false);
    await assert.rejects(
      () =>
        submitCaseFeedbackToFirestore({
          caseId: caseWithAmbId,
          caseStatus: caseWithAmb.status,
          patientUid,
          patientName: caseWithAmb.patientName,
          submittedByUid: patientUid,
          submittedByName: caseWithAmb.patientName,
          submittedByRole: 'patient',
          overallRating: 5,
          hospitalProviderRating: 5,
          ambulanceApplicable: true,
          ambulanceRating: 4,
          responseTimeSatisfaction: 5,
          comments: 'Too early!'
        }),
      /Completed status/i
    );
  });

  await check('Marking a case completed succeeds without mandatory feedback and notifies the patient', async () => {
    dataStore.updateCaseStatus(caseWithAmbId, 'COMPLETED', {
      uid: 'admin-demo-01',
      name: 'Central Coordinator',
      role: 'admin'
    });
    const updated = dataStore.getCase(caseWithAmbId);
    assert.equal(updated?.status, 'COMPLETED');
    assert.equal(isCaseCompletedStatus(updated?.status), true);
    assert.equal(dataStore.getFeedbackForCase(caseWithAmbId), undefined);

    const patientNotifs = dataStore.getNotifications(patientUid);
    const feedbackNotif = patientNotifs.find(
      (n) => n.relatedCaseId === caseWithAmbId && n.type === 'feedback_available'
    );
    assert.ok(feedbackNotif, 'Expected a feedback_available notification on case completion');
  });

  await check('Ambulance applicability is detected accurately per case', () => {
    const reqsNoAmb: ResourceRequest[] = [
      {
        requestId: `REQ-${caseNoAmbId}-blood`,
        caseId: caseNoAmbId,
        patientUid,
        providerUid: 'blood-demo-01',
        providerName: 'Red Cross Regional Blood Centre',
        resourceType: 'blood',
        details: { bloodGroup: 'O+', units: 2 },
        status: 'COMPLETED',
        createdAt: caseNoAmb.createdAt,
        updatedAt: caseNoAmb.createdAt
      }
    ];
    assert.equal(isAmbulanceApplicableForCase(caseWithAmb), true);
    assert.equal(isAmbulanceApplicableForCase(caseNoAmb, reqsNoAmb), false);
  });

  await check('Submitting feedback for a completed case with ambulance saves all fields and Case ID', async () => {
    const meta = extractFeedbackProviderMetadata(caseWithAmb);
    const saved = await submitCaseFeedbackToFirestore({
      caseId: caseWithAmbId,
      caseStatus: 'COMPLETED',
      patientUid,
      patientName: caseWithAmb.patientName,
      submittedByUid: patientUid,
      submittedByName: caseWithAmb.patientName,
      submittedByRole: 'patient',
      overallRating: 5,
      hospitalProviderRating: 4,
      ambulanceApplicable: true,
      ambulanceRating: 5,
      responseTimeSatisfaction: 5,
      comments: 'Ambulance arrived in 6 minutes and ICU team was ready.',
      ...meta
    });

    assert.equal(saved.id, caseWithAmbId);
    assert.equal(saved.caseId, caseWithAmbId);
    assert.equal(saved.overallRating, 5);
    assert.equal(saved.hospitalProviderRating, 4);
    assert.equal(saved.ambulanceApplicable, true);
    assert.equal(saved.ambulanceRating, 5);
    assert.equal(saved.responseTimeSatisfaction, 5);
    assert.equal(saved.hospitalName, 'KIMS Super Specialty Hospital');
    assert.equal(saved.ambulanceName, 'SwiftCare Emergency Ambulance Fleet');
    assert.equal(saved.comments, 'Ambulance arrived in 6 minutes and ICU team was ready.');
  });

  await check('Duplicate feedback submission for the same completed case is rejected', async () => {
    await assert.rejects(
      () =>
        submitCaseFeedbackToFirestore({
          caseId: caseWithAmbId,
          caseStatus: 'COMPLETED',
          patientUid,
          patientName: caseWithAmb.patientName,
          submittedByUid: patientUid,
          submittedByName: caseWithAmb.patientName,
          submittedByRole: 'patient',
          overallRating: 2,
          hospitalProviderRating: 2,
          ambulanceApplicable: true,
          ambulanceRating: 2,
          responseTimeSatisfaction: 2,
          comments: 'Duplicate submission attempt'
        }),
      /already been submitted/i
    );
  });

  await check('Completed case without ambulance stores ambulanceApplicable=false and ambulanceRating=null', async () => {
    dataStore.updateCaseStatus(caseNoAmbId, 'COMPLETED', {
      uid: 'admin-demo-01',
      name: 'Central Coordinator',
      role: 'admin'
    });
    const meta = extractFeedbackProviderMetadata(caseNoAmb);
    const saved = await submitCaseFeedbackToFirestore({
      caseId: caseNoAmbId,
      caseStatus: 'COMPLETED',
      patientUid,
      patientName: caseNoAmb.patientName,
      submittedByUid: patientUid,
      submittedByName: caseNoAmb.patientName,
      submittedByRole: 'patient',
      overallRating: 3,
      hospitalProviderRating: 4,
      ambulanceApplicable: false,
      ambulanceRating: null,
      responseTimeSatisfaction: 3,
      comments: 'Blood bank coordination was smooth; waiting room could be clearer.',
      ...meta
    });
    // Backdate second feedback slightly for date-range filtering check
    saved.createdAt = '2026-11-15T12:00:00.000Z';
    dataStore.saveFeedbackLocal(saved);

    const first = dataStore.getFeedbackForCase(caseWithAmbId)!;
    first.createdAt = '2026-11-10T12:00:00.000Z';
    dataStore.saveFeedbackLocal(first);

    assert.equal(saved.ambulanceApplicable, false);
    assert.equal(saved.ambulanceRating, null);
  });

  await check('Admin average rating calculation and provider/hospital/date filters work accurately', () => {
    const all = dataStore.getFeedbackList().filter(
      (f) => f.caseId === caseWithAmbId || f.caseId === caseNoAmbId
    );
    assert.equal(all.length, 2);

    const avg = calculateFeedbackAverages(all);
    assert.equal(avg.totalCount, 2);
    assert.equal(avg.overallAvg, 4); // (5 + 3) / 2 = 4.0
    assert.equal(avg.hospitalProviderAvg, 4); // (4 + 4) / 2 = 4.0
    assert.equal(avg.ambulanceAvg, 5); // Only caseWithAmb has ambulanceApplicable=true (rating 5)
    assert.equal(avg.ambulanceResponseCount, 1);
    assert.equal(avg.responseTimeAvg, 4); // (5 + 3) / 2 = 4.0

    // Filter by hospital
    const byHospital = filterCaseFeedback(all, { hospital: 'KIMS Super Specialty Hospital' });
    assert.equal(byHospital.length, 1);
    assert.equal(byHospital[0].caseId, caseWithAmbId);

    // Filter by provider (blood bank)
    const byProvider = filterCaseFeedback(all, { provider: 'Red Cross Regional Blood Centre' });
    assert.equal(byProvider.length, 1);
    assert.equal(byProvider[0].caseId, caseNoAmbId);

    // Filter by provider (ambulance)
    const byAmbulance = filterCaseFeedback(all, { provider: 'SwiftCare Emergency Ambulance Fleet' });
    assert.equal(byAmbulance.length, 1);
    assert.equal(byAmbulance[0].caseId, caseWithAmbId);

    // Filter by date range
    const byDate = filterCaseFeedback(all, { dateFrom: '2026-11-12', dateTo: '2026-11-16' });
    assert.equal(byDate.length, 1);
    assert.equal(byDate[0].caseId, caseNoAmbId);

    // Filter by comment search
    const byComment = filterCaseFeedback(all, { search: '6 minutes' });
    assert.equal(byComment.length, 1);
    assert.equal(byComment[0].caseId, caseWithAmbId);
  });

  console.log(`\nFeedback Flow Verification Suite: ${passed.length} passed.`);
}

runFeedbackTests().catch((err) => {
  console.error('[FAIL]', err);
  process.exitCode = 1;
});
