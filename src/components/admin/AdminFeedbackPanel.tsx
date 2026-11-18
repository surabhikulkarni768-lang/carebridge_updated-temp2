import React, { useState, useMemo } from 'react';
import {
  Star,
  Building2,
  Truck,
  Clock,
  MessageSquare,
  Filter,
  Search,
  RotateCcw,
  AlertTriangle,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import type {
  CaseFeedback,
  HospitalProfile,
  BloodBankProfile,
  OxygenProfile,
  AmbulanceProfile,
  UserProfile
} from '../../types';
import { calculateFeedbackAverages, filterCaseFeedback } from '../../services/dataService';

interface AdminFeedbackPanelProps {
  feedbackList: CaseFeedback[];
  loading?: boolean;
  error?: string | null;
  hospitals?: HospitalProfile[];
  bloodBanks?: BloodBankProfile[];
  oxygenDepots?: OxygenProfile[];
  ambulances?: AmbulanceProfile[];
  users?: UserProfile[];
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date unavailable';
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const renderStarRow = (rating: number, size: 'sm' | 'md' = 'sm') => {
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconClass} ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-500'
              : 'text-slate-300'
          }`}
        />
      ))}
    </div>
  );
};

export const AdminFeedbackPanel: React.FC<AdminFeedbackPanelProps> = ({
  feedbackList,
  loading = false,
  error = null,
  hospitals = [],
  bloodBanks = [],
  oxygenDepots = [],
  ambulances = [],
  users = []
}) => {
  const [providerFilter, setProviderFilter] = useState('all');
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect deduplicated hospital filter options from feedback + registered hospitals
  const hospitalOptions = useMemo(() => {
    const map = new Map<string, string>();
    hospitals.forEach((h) => {
      if (h.hospitalName) map.set(h.hospitalName.toLowerCase(), h.hospitalName);
    });
    feedbackList.forEach((f) => {
      if (f.hospitalName) map.set(f.hospitalName.toLowerCase(), f.hospitalName);
      f.providers
        .filter((p) => p.role === 'hospital' && p.name)
        .forEach((p) => map.set(p.name.toLowerCase(), p.name));
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [hospitals, feedbackList]);

  // Collect deduplicated provider filter options (all provider types + feedback records)
  const providerOptions = useMemo(() => {
    const map = new Map<string, string>();
    hospitals.forEach((h) => h.hospitalName && map.set(h.hospitalName.toLowerCase(), h.hospitalName));
    ambulances.forEach((a) => a.providerName && map.set(a.providerName.toLowerCase(), a.providerName));
    bloodBanks.forEach((b) => b.bankName && map.set(b.bankName.toLowerCase(), b.bankName));
    oxygenDepots.forEach((o) => o.providerName && map.set(o.providerName.toLowerCase(), o.providerName));
    users
      .filter((u) => ['hospital', 'bloodBank', 'oxygenProvider', 'ambulanceProvider', 'doctor'].includes(u.role))
      .forEach((u) => u.displayName && map.set(u.displayName.toLowerCase(), u.displayName));
    feedbackList.forEach((f) => {
      if (f.hospitalName) map.set(f.hospitalName.toLowerCase(), f.hospitalName);
      if (f.ambulanceName) map.set(f.ambulanceName.toLowerCase(), f.ambulanceName);
      f.providerNames.forEach((name) => name && map.set(name.toLowerCase(), name));
      f.providers.forEach((p) => p.name && map.set(p.name.toLowerCase(), p.name));
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [hospitals, ambulances, bloodBanks, oxygenDepots, users, feedbackList]);

  const filteredFeedback = useMemo(
    () =>
      filterCaseFeedback(feedbackList, {
        provider: providerFilter,
        hospital: hospitalFilter,
        dateFrom,
        dateTo,
        search: searchQuery
      }),
    [feedbackList, providerFilter, hospitalFilter, dateFrom, dateTo, searchQuery]
  );

  const averages = useMemo(
    () => calculateFeedbackAverages(filteredFeedback),
    [filteredFeedback]
  );

  const hasActiveFilters =
    providerFilter !== 'all' ||
    hospitalFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    setProviderFilter('all');
    setHospitalFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              <span>Patient Feedback & Service Ratings</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Post-completion patient feedback, average satisfaction scores, and comments across providers and hospitals.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Showing <span className="font-bold text-slate-900">{filteredFeedback.length}</span> of{' '}
            <span className="font-bold text-slate-900">{feedbackList.length}</span>{' '}
            {feedbackList.length === 1 ? 'submission' : 'submissions'}
          </div>
        </div>

        {/* Average Rating KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Overall Experience Avg */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
              <span>Overall Experience</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {averages.overallAvg !== null ? averages.overallAvg.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ 5.0</span>
            </div>
            {averages.overallAvg !== null ? (
              <div className="flex items-center gap-2">
                {renderStarRow(averages.overallAvg)}
                <span className="text-[11px] text-slate-500">({averages.totalCount})</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">No ratings yet</span>
            )}
          </div>

          {/* Hospital / Provider Service Avg */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
              <span>Hospital / Provider Service</span>
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {averages.hospitalProviderAvg !== null ? averages.hospitalProviderAvg.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ 5.0</span>
            </div>
            {averages.hospitalProviderAvg !== null ? (
              <div className="flex items-center gap-2">
                {renderStarRow(averages.hospitalProviderAvg)}
                <span className="text-[11px] text-slate-500">({averages.totalCount})</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">No ratings yet</span>
            )}
          </div>

          {/* Ambulance Service Avg */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span>Ambulance Service</span>
              <Truck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {averages.ambulanceAvg !== null ? averages.ambulanceAvg.toFixed(1) : 'N/A'}
              </span>
              {averages.ambulanceAvg !== null && (
                <span className="text-xs text-slate-500 font-semibold">/ 5.0</span>
              )}
            </div>
            {averages.ambulanceAvg !== null ? (
              <div className="flex items-center gap-2">
                {renderStarRow(averages.ambulanceAvg)}
                <span className="text-[11px] text-slate-500">
                  ({averages.ambulanceResponseCount} applicable)
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">No ambulance ratings</span>
            )}
          </div>

          {/* Response Time Satisfaction Avg */}
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
              <span>Response Time Satisfaction</span>
              <Clock className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {averages.responseTimeAvg !== null ? averages.responseTimeAvg.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-slate-500 font-semibold">/ 5.0</span>
            </div>
            {averages.responseTimeAvg !== null ? (
              <div className="flex items-center gap-2">
                {renderStarRow(averages.responseTimeAvg)}
                <span className="text-[11px] text-slate-500">({averages.totalCount})</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400">No ratings yet</span>
            )}
          </div>
        </div>

        {/* Filters Bar: Provider, Hospital, Date From/To, Search */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-[#00707E]" />
              <span>Filter Feedback</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#00707E] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search feedback by case ID, patient, or comment"
                placeholder="Search Case ID, patient, comment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00707E]"
              />
            </div>

            {/* Filter by Provider */}
            <select
              aria-label="Filter feedback by provider"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#00707E]"
            >
              <option value="all">All Providers</option>
              {providerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Filter by Hospital */}
            <select
              aria-label="Filter feedback by hospital"
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#00707E]"
            >
              <option value="all">All Hospitals</option>
              {hospitalOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Date From */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label className="text-[10px] font-semibold text-slate-500 whitespace-nowrap" htmlFor="fb-date-from">
                From
              </label>
              <input
                id="fb-date-from"
                type="date"
                aria-label="Filter feedback from date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
              />
            </div>

            {/* Date To */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label className="text-[10px] font-semibold text-slate-500 whitespace-nowrap" htmlFor="fb-date-to">
                To
              </label>
              <input
                id="fb-date-to"
                type="date"
                aria-label="Filter feedback through date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Feedback Records List */}
      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 text-sm">
          Loading submitted patient feedback...
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
          <div className="font-bold text-slate-800 text-sm">
            {feedbackList.length === 0
              ? 'No Patient Feedback Submitted Yet'
              : 'No Feedback Matches Your Selected Filters'}
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {feedbackList.length === 0
              ? 'When emergency cases are marked Completed, patients receive an optional feedback form on their dashboard. Submitted responses will appear here in real time.'
              : 'Try clearing or widening the provider, hospital, or date filters to view more responses.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredFeedback.map((item) => (
            <article
              key={item.caseId}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-teal-300 transition-colors space-y-3.5"
            >
              {/* Top Row: Case ID, Patient, Timestamp, Overall Score Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-[#0F3868] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                    <FileText className="w-3.5 h-3.5 text-[#00707E]" />
                    {item.caseId}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {item.patientName}
                  </span>
                  {item.submittedByName && item.submittedByName !== item.patientName && (
                    <span className="text-[11px] text-slate-500">
                      (Submitted by {item.submittedByName})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateTime(item.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {item.overallRating}.0 / 5
                  </span>
                </div>
              </div>

              {/* Ratings Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Overall</span>
                  <div className="flex items-center gap-1.5">
                    {renderStarRow(item.overallRating)}
                    <span className="font-bold text-slate-900">{item.overallRating}/5</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Hospital / Provider</span>
                  <div className="flex items-center gap-1.5">
                    {renderStarRow(item.hospitalProviderRating)}
                    <span className="font-bold text-slate-900">{item.hospitalProviderRating}/5</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Ambulance</span>
                  {item.ambulanceApplicable && item.ambulanceRating !== null ? (
                    <div className="flex items-center gap-1.5">
                      {renderStarRow(item.ambulanceRating)}
                      <span className="font-bold text-slate-900">{item.ambulanceRating}/5</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic font-medium">Not applicable</span>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Response Time</span>
                  <div className="flex items-center gap-1.5">
                    {renderStarRow(item.responseTimeSatisfaction)}
                    <span className="font-bold text-slate-900">{item.responseTimeSatisfaction}/5</span>
                  </div>
                </div>
              </div>

              {/* Provider & Hospital Tags */}
              {(item.hospitalName || item.ambulanceName || item.providerNames.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">
                    Assigned Facilities:
                  </span>
                  {item.hospitalName && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">
                      <Building2 className="w-3 h-3" />
                      Hospital: {item.hospitalName}
                    </span>
                  )}
                  {item.ambulanceName && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
                      <Truck className="w-3 h-3" />
                      Ambulance: {item.ambulanceName}
                    </span>
                  )}
                  {item.providerNames
                    .filter((name) => name !== item.hospitalName && name !== item.ambulanceName)
                    .map((name) => (
                      <span
                        key={name}
                        className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-semibold"
                      >
                        {name}
                      </span>
                    ))}
                </div>
              )}

              {/* Patient Comments & Suggestions */}
              <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-100">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-900 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-[#00707E]" />
                  <span>Patient Comments & Suggestions</span>
                </div>
                {item.comments ? (
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {item.comments}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No written comments provided.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
