import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../config/firebase';
import {
  Building2,
  Bed,
  Activity,
  HeartPulse,
  Wind,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Phone,
  MapPin,
  ShieldCheck,
  Filter,
  User,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataStore, respondToRequestInFirestore, subscribeRequestsForProviderFromFirestore } from '../../services/dataService';
import { ProviderRequestsPanel } from '../common/ProviderRequestsPanel';
import type { HospitalProfile, ResourceRequest } from '../../types';

export const HospitalDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [respondingReqId, setRespondingReqId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit bed counts state
  const [availBeds, setAvailBeds] = useState(42);
  const [availICU, setAvailICU] = useState(6);
  const [availVentilators, setAvailVentilators] = useState(4);

  const loadData = () => {
    if (!currentUser) return;
    const prof = dataStore.getHospitalProfile(currentUser.uid) || {
      uid: currentUser.uid,
      hospitalName: currentUser.displayName || 'Emergency Care Hospital',
      registrationNumber: 'REG-HOSP-001',
      departments: ['Emergency Trauma', 'Critical Care / ICU', 'Cardiology', 'General Medicine'],
      totalBeds: 100,
      availableBeds: 42,
      totalICU: 20,
      availableICU: 6,
      totalVentilators: 10,
      availableVentilators: 4,
      contactNumber: currentUser.phone || '+91 836 222 5555',
      operatingHours: '24/7',
      city: currentUser.city || 'Hubballi',
      state: currentUser.state || 'Karnataka',
      address: currentUser.address || 'Hospital Emergency Wing',
      isVerified: true,
      lastUpdated: new Date().toISOString()
    };
    if (prof) {
      setProfile(prof);
      setAvailBeds(prof.availableBeds);
      setAvailICU(prof.availableICU);
      setAvailVentilators(prof.availableVentilators);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    loadData();
    const unsubscribeStore = dataStore.subscribe(loadData);
    let unsubscribeDoc = () => {};
    if (isFirebaseConfigured && db) {
      try {
        unsubscribeDoc = onSnapshot(doc(db, 'hospitalProfiles', currentUser.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as HospitalProfile;
            setProfile(data);
            setAvailBeds(data.availableBeds);
            setAvailICU(data.availableICU);
            setAvailVentilators(data.availableVentilators);
            dataStore.state.hospitalProfiles[currentUser.uid] = data;
            dataStore.saveState();
          }
        });
      } catch (err) {}
    }
    const unsubscribeRequests = subscribeRequestsForProviderFromFirestore(
      currentUser.uid,
      (nextRequests) => {
        setRequests(nextRequests);
        setRequestsLoading(false);
        setRequestsError(null);
      },
      (message) => {
        const local = dataStore.getRequestsForProvider(currentUser.uid);
        setRequests(local);
        setRequestsLoading(false);
      }
    );
    return () => {
      unsubscribeStore();
      unsubscribeDoc();
      unsubscribeRequests();
    };
  }, [currentUser]);

  const handleUpdateAvailability = async () => {
    if (!currentUser) return;
    setIsUpdating(true);
    try {
      await dataStore.updateHospitalProfile(currentUser.uid, {
        availableBeds: Number(availBeds),
        availableICU: Number(availICU),
        availableVentilators: Number(availVentilators)
      });
      setSuccessMessage('Bed capacity update request submitted to Central Coordinator for approval (Pending Review).');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      window.alert('Failed to update availability.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAccept = async (reqId: string) => {
    setRespondingReqId(reqId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(reqId, 'accepted');
      setSuccessMessage(coordinatorNotified
        ? 'Admission request accepted. The coordinator was notified.'
        : 'Admission request accepted. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  const handleReject = async (reqId: string) => {
    if (rejectionReason.trim().length < 5) {
      window.alert('Enter a rejection reason of at least five characters.');
      return;
    }
    setRespondingReqId(reqId);
    try {
      const coordinatorNotified = await respondToRequestInFirestore(reqId, 'rejected', rejectionReason.trim());
      setRejectingReqId(null);
      setRejectionReason('');
      setSuccessMessage(coordinatorNotified
        ? 'Admission request rejected. The coordinator was notified.'
        : 'Admission request rejected. The status is visible in the coordinator live request list.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not respond to the request.');
    } finally {
      setRespondingReqId(null);
    }
  };

  const isAccepted = (status?: string) =>
    ['accepted', 'completed', 'resolved', 'admitted', 'confirmed'].includes(
      String(status || '').trim().toLowerCase()
    );

  const isRejected = (status?: string) =>
    ['rejected', 'declined', 'cancelled'].includes(
      String(status || '').trim().toLowerCase()
    );

  const isActionRequired = (status?: string) =>
    !isAccepted(status) && !isRejected(status);

  const isIncomingAssigned = (r: ResourceRequest) =>
    Boolean(r.assignedAt || r.assignmentCoordinatorUid || String(r.status).toUpperCase() !== 'REQUESTED');

  const filteredRequests = requests.filter((r) => {
    if (!isIncomingAssigned(r)) return false;
    if (filter === 'all') return true;
    if (filter === 'pending') return isActionRequired(r.status);
    return r.status.toLowerCase() === filter.toLowerCase();
  });

  const pendingCount = requests.filter((r) => isIncomingAssigned(r) && isActionRequired(r.status)).length;

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto p-8 space-y-4 text-center text-slate-500">
        Loading Hospital Provider Dashboard...
        {requestsError && <p role="alert" className="text-sm text-red-700">{requestsError}</p>}
        {currentUser && <ProviderRequestsPanel providerUid={currentUser.uid} title="Assigned Hospital Requests" />}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{profile.hospitalName}</h1>
              {profile.isVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Facility
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" /> Verification Pending
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {profile.address}, {profile.city}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {profile.contactNumber}</span>
              <span className="text-slate-400">Reg: {profile.registrationNumber}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-500">Self-reported status:</div>
            <div className="font-semibold text-slate-700">
              Updated {new Date(profile.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Grid: Capacity Management + Incoming Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bed & ICU Capacity Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bed className="w-5 h-5 text-blue-600" /> Bed & ICU Capacity
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">Live Sync</span>
            </div>

            {/* General Ward Beds */}
            <div className="p-3.5 bg-slate-50 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>General Emergency Beds</span>
                <span className="text-slate-500">{availBeds} / {profile.totalBeds} avail</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={profile.totalBeds}
                  value={availBeds}
                  onChange={(e) => setAvailBeds(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-900 text-center"
                />
              </div>
            </div>

            {/* ICU Beds */}
            <div className="p-3.5 bg-blue-50/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" /> ICU Critical Beds
                </span>
                <span className="text-blue-700">{availICU} / {profile.totalICU} avail</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={profile.totalICU}
                  value={availICU}
                  onChange={(e) => setAvailICU(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-blue-200 rounded-lg text-blue-950 text-center"
                />
              </div>
            </div>

            {/* Ventilators */}
            <div className="p-3.5 bg-cyan-50/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-cyan-900">
                <span className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-cyan-600" /> Invasive Ventilators
                </span>
                <span className="text-cyan-700">{availVentilators} / {profile.totalVentilators} avail</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={profile.totalVentilators}
                  value={availVentilators}
                  onChange={(e) => setAvailVentilators(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-cyan-200 rounded-lg text-cyan-950 text-center"
                />
              </div>
            </div>

            {/* Pending Coordinator Review Banner */}
            {(() => {
              const pendingUpdate = (dataStore.getProviderUpdateRequests() || []).find(
                (u) => u.providerUid === currentUser?.uid && (!u.status || u.status === 'PENDING')
              );
              if (!pendingUpdate) return null;
              return (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Pending Coordinator Review</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    Requested capacity update ({pendingUpdate.summary}) is awaiting Coordinator review and acceptance in the Admin Dashboard before going live.
                  </p>
                </div>
              );
            })()}

            <button
              onClick={handleUpdateAvailability}
              disabled={isUpdating}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Submitting to Coordinator...' : 'Submit Capacity Update for Admin Approval'}
            </button>

            <p className="text-[11px] text-slate-400 italic text-center leading-relaxed">
              Updates require review and acceptance by Central Coordinator before updating live capacity.
            </p>
          </div>

          {/* Departments Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">
              Specialized Departments
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.departments.map((dept, i) => (
                <span key={i} className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                  {dept}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Incoming Admission Requests Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Emergency Admission Requests
                  {pendingCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {pendingCount} Pending
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  Review and admit triage patients sent by emergency coordinators.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['pending', 'accepted', 'rejected', 'all'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      filter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Requests List */}
            {requestsError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{requestsError}</div>
            ) : requestsLoading ? (
              <div className="py-8 text-center text-slate-500 text-xs">Loading assigned hospital requests...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Bed className="w-10 h-10 mx-auto text-slate-300 opacity-60" />
                <p className="text-xs font-medium">No admission requests matching filter "{filter}".</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((req) => {
                  return (
                    <div
                      key={req.requestId}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-slate-50/40 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {req.patientName || 'Emergency Patient'}
                            </span>
                            <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                              {req.caseId}
                            </span>
                            {req.details.urgency && (
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  req.details.urgency === 'immediate'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}
                              >
                                {req.details.urgency}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Requested: <span className="font-semibold text-slate-800">{req.details.bedType || 'General Bed'}</span>
                            {req.details.notes && ` - "${req.details.notes}"`}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Assigned: {new Date(req.assignedAt || req.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isActionRequired(req.status) && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                              <Clock className="w-3.5 h-3.5" /> Action Required (Assigned)
                            </span>
                          )}
                          {isAccepted(req.status) && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                            </span>
                          )}
                          {isRejected(req.status) && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                              <XCircle className="w-3.5 h-3.5" /> Declined
                            </span>
                          )}
                          {isRejected(req.status) && (req.rejectionReason || req.responseDetails) && (
                            <p className="mt-1 text-[11px] text-red-700 font-medium">
                              Reason: {req.rejectionReason || req.responseDetails}
                            </p>
                          )}
                          {req.respondedAt && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Response {new Date(req.respondedAt).toLocaleString()} by {req.respondedByUid || 'provider'}
                              {req.responseDetails && isAccepted(req.status) ? ` - ${req.responseDetails}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons for Pending */}
                      {isActionRequired(req.status) && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            disabled={respondingReqId !== null}
                            onClick={() => {
                              setRejectionReason('');
                              setRejectingReqId(req.requestId);
                            }}
                            className="px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200 disabled:opacity-50"
                          >
                            Decline Admission
                          </button>
                          <button
                            type="button"
                            disabled={respondingReqId !== null}
                            onClick={() => handleAccept(req.requestId)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {respondingReqId === req.requestId ? 'Accepting...' : 'Accept Request'}
                          </button>
                        </div>
                      )}

                      {/* Rejection Modal Inline */}
                      {rejectingReqId === req.requestId && (
                        <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2 mt-2">
                          <label className="text-xs font-bold text-red-800 block">
                            Specify Reason for Declining Admission:
                          </label>
                          <textarea
                            required
                            minLength={3}
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder="Enter reason for declining admission (e.g., ICU beds full, redirect to nearby center)"
                            className="w-full text-xs p-2 bg-white border border-red-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setRejectingReqId(null)}
                              className="px-3 py-1 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={respondingReqId !== null || rejectionReason.trim().length < 3}
                              onClick={() => handleReject(req.requestId)}
                              className="px-3 py-1 text-xs bg-red-600 text-white font-bold rounded shadow-xs disabled:opacity-50"
                            >
                              {respondingReqId === req.requestId ? 'Saving...' : 'Confirm Rejection'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
