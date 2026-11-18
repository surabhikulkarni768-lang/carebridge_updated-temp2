import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Truck,
  Clock,
  MessageSquare,
  Sparkles,
  FileText
} from 'lucide-react';
import type { CaseFeedback, EmergencyCase, ResourceRequest, UserProfile } from '../../types';
import {
  extractFeedbackProviderMetadata,
  isAmbulanceApplicableForCase,
  submitCaseFeedbackToFirestore,
  validateCaseFeedbackInput
} from '../../services/dataService';

interface StarRatingInputProps {
  id: string;
  label: string;
  subtitle?: string;
  value: number;
  onChange: (rating: number) => void;
  labels?: string[];
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const DEFAULT_STAR_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const RESPONSE_TIME_LABELS = [
  'Very Dissatisfied',
  'Dissatisfied',
  'Neutral',
  'Satisfied',
  'Very Satisfied'
];

const StarRatingInput: React.FC<StarRatingInputProps> = ({
  id,
  label,
  subtitle,
  value,
  onChange,
  labels = DEFAULT_STAR_LABELS,
  error,
  disabled = false,
  icon
}) => {
  const [hovered, setHovered] = useState(0);
  const displayValue = hovered || value;

  return (
    <div className={`p-4 rounded-2xl border transition-colors ${error ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2">
          {icon && <div className="mt-0.5 text-[#00707E] shrink-0">{icon}</div>}
          <div>
            <label htmlFor={id} className="block text-xs sm:text-sm font-bold text-slate-900">
              {label} <span className="text-red-500">*</span>
            </label>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
            displayValue > 0
              ? 'bg-amber-100 text-amber-900 border border-amber-200'
              : 'bg-slate-200/70 text-slate-500'
          }`}
        >
          {displayValue > 0 ? `${displayValue}/5 · ${labels[displayValue - 1]}` : 'Select rating'}
        </span>
      </div>

      <div
        id={id}
        role="radiogroup"
        aria-label={label}
        className="flex items-center gap-1.5"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= displayValue;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star > 1 ? 's' : ''} - ${labels[star - 1]}`}
              disabled={disabled}
              onMouseEnter={() => !disabled && setHovered(star)}
              onFocus={() => !disabled && setHovered(star)}
              onBlur={() => setHovered(0)}
              onClick={() => !disabled && onChange(star)}
              className="p-1.5 rounded-xl hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-transform active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  active
                    ? 'fill-amber-400 text-amber-500 drop-shadow-2xs'
                    : 'fill-transparent text-slate-300 hover:text-amber-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export interface CaseFeedbackModalProps {
  emergencyCase: {
    caseId: string;
    patientUid?: string;
    patientId?: string;
    patientName: string;
    status: string;
    providerName?: string;
    matchedHospitalName?: string;
    assignedHospitalUid?: string;
    assignedHospitalName?: string;
    assignedAmbulanceUid?: string;
    assignedAmbulanceName?: string;
    assignedBloodBankUid?: string;
    assignedBloodBankName?: string;
    assignedOxygenUid?: string;
    assignedOxygenName?: string;
    resourcesNeeded?: string[];
    requiredServices?: string[];
    resourcesList?: string[];
    quotas?: EmergencyCase['quotas'];
    individualStatuses?: Array<{ resource: string; detail: string; status: string; code?: string }>;
    updatedAt?: string;
  };
  caseRequests?: ResourceRequest[];
  currentUser: UserProfile;
  existingFeedback?: CaseFeedback | null;
  onClose: () => void;
  onSubmitted?: (feedback: CaseFeedback) => void;
}

export const CaseFeedbackModal: React.FC<CaseFeedbackModalProps> = ({
  emergencyCase,
  caseRequests = [],
  currentUser,
  existingFeedback = null,
  onClose,
  onSubmitted
}) => {
  const ambulanceApplicable = useMemo(
    () => isAmbulanceApplicableForCase(emergencyCase, caseRequests),
    [emergencyCase, caseRequests]
  );

  const providerMeta = useMemo(
    () => extractFeedbackProviderMetadata(emergencyCase, caseRequests),
    [emergencyCase, caseRequests]
  );

  const [overallRating, setOverallRating] = useState(0);
  const [hospitalProviderRating, setHospitalProviderRating] = useState(0);
  const [ambulanceRating, setAmbulanceRating] = useState(0);
  const [responseTimeSatisfaction, setResponseTimeSatisfaction] = useState(0);
  const [comments, setComments] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<CaseFeedback | null>(null);

  useEffect(() => {
    setOverallRating(0);
    setHospitalProviderRating(0);
    setAmbulanceRating(0);
    setResponseTimeSatisfaction(0);
    setComments('');
    setFieldErrors({});
    setSubmitError(null);
    setSubmittedRecord(null);
  }, [emergencyCase.caseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const payload = {
      caseId: emergencyCase.caseId,
      caseStatus: String(emergencyCase.status || ''),
      patientUid: emergencyCase.patientUid || emergencyCase.patientId || currentUser.uid,
      patientName: emergencyCase.patientName || currentUser.displayName || 'Patient',
      submittedByUid: currentUser.uid,
      submittedByName: currentUser.displayName || 'Patient',
      submittedByRole: currentUser.role,
      overallRating,
      hospitalProviderRating,
      ambulanceApplicable,
      ambulanceRating: ambulanceApplicable ? ambulanceRating : null,
      responseTimeSatisfaction,
      comments: comments.trim(),
      hospitalUid: providerMeta.hospitalUid,
      hospitalName: providerMeta.hospitalName,
      ambulanceUid: providerMeta.ambulanceUid,
      ambulanceName: providerMeta.ambulanceName,
      providerUids: providerMeta.providerUids,
      providerNames: providerMeta.providerNames,
      providers: providerMeta.providers,
      caseCompletedAt: emergencyCase.updatedAt
    };

    const validation = validateCaseFeedbackInput(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const saved = await submitCaseFeedbackToFirestore(payload);
      setSubmittedRecord(saved);
      if (onSubmitted) onSubmitted(saved);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to save your feedback right now. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderReadOnlyStars = (rating: number) => (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
          }`}
        />
      ))}
      <span className="ml-1.5 text-xs font-bold text-slate-800">{rating}/5</span>
    </div>
  );

  // Thank-you screen immediately after submission
  if (submittedRecord) {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-thankyou-title"
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-100 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h3 id="feedback-thankyou-title" className="text-xl font-extrabold text-slate-900">
              Thank You for Your Feedback!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Your response for emergency case{' '}
              <span className="font-mono font-bold text-[#0F3868] bg-slate-100 px-1.5 py-0.5 rounded">
                {submittedRecord.caseId}
              </span>{' '}
              has been saved. Your input helps our hospitals, ambulance teams, and coordinators deliver faster, better emergency care.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Overall Experience</span>
              {renderReadOnlyStars(submittedRecord.overallRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Hospital / Provider Service</span>
              {renderReadOnlyStars(submittedRecord.hospitalProviderRating)}
            </div>
            {submittedRecord.ambulanceApplicable && submittedRecord.ambulanceRating !== null && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Ambulance Service</span>
                {renderReadOnlyStars(submittedRecord.ambulanceRating)}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Response Time Satisfaction</span>
              {renderReadOnlyStars(submittedRecord.responseTimeSatisfaction)}
            </div>
            {submittedRecord.comments && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block mb-1">Your Comments</span>
                <p className="text-slate-700 italic">&ldquo;{submittedRecord.comments}&rdquo;</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-5 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Already-submitted read-only receipt (enforces 1 submission per completed case)
  if (existingFeedback) {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-submitted-title"
      >
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 id="feedback-submitted-title" className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Submitted Feedback Summary</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Case Reference:{' '}
                <span className="font-mono font-bold text-[#0F3868]">{existingFeedback.caseId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feedback summary"
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Feedback has already been submitted on{' '}
              <strong>{new Date(existingFeedback.createdAt).toLocaleString()}</strong>. Only one feedback submission is allowed per completed case.
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Overall Experience</span>
              {renderReadOnlyStars(existingFeedback.overallRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Hospital / Provider Service</span>
              {renderReadOnlyStars(existingFeedback.hospitalProviderRating)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Ambulance Service</span>
              {existingFeedback.ambulanceApplicable && existingFeedback.ambulanceRating !== null ? (
                renderReadOnlyStars(existingFeedback.ambulanceRating)
              ) : (
                <span className="text-slate-400 italic">Not applicable</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Response Time Satisfaction</span>
              {renderReadOnlyStars(existingFeedback.responseTimeSatisfaction)}
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="text-slate-500 font-semibold block mb-1">Comments & Suggestions</span>
              {existingFeedback.comments ? (
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{existingFeedback.comments}</p>
              ) : (
                <p className="text-slate-400 italic">No comments provided.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#00707E] hover:bg-[#005B66] text-white text-xs font-bold shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active feedback submission form
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-form-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 mb-4 gap-3">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-teal-50 border border-teal-200 text-[#00707E] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 id="feedback-form-title" className="font-extrabold text-slate-900 text-base sm:text-lg">
                Emergency Care Feedback
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Optional post-completion survey — your insights help improve CareBridge emergency services.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback form"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Case ID Reference Banner */}
        <div className="mb-4 p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00707E] shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 block">
                Case ID Reference
              </span>
              <span className="font-mono font-extrabold text-[#0F3868] text-sm">
                {emergencyCase.caseId}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
              Patient
            </span>
            <span className="font-bold text-slate-900">{emergencyCase.patientName}</span>
          </div>
          {(providerMeta.hospitalName || providerMeta.ambulanceName || providerMeta.providerNames.length > 0) && (
            <div className="w-full pt-2 mt-1 border-t border-teal-200/70 flex flex-wrap gap-1.5 text-[11px]">
              {providerMeta.hospitalName && (
                <span className="bg-white text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                  Hospital: {providerMeta.hospitalName}
                </span>
              )}
              {providerMeta.ambulanceName && (
                <span className="bg-white text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                  Ambulance: {providerMeta.ambulanceName}
                </span>
              )}
              {providerMeta.providers
                .filter((p) => p.role !== 'hospital' && p.role !== 'ambulanceProvider')
                .map((p) => (
                  <span
                    key={`${p.role}-${p.name}`}
                    className="bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold"
                  >
                    {p.name}
                  </span>
                ))}
            </div>
          )}
        </div>

        {submitError && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {/* 1. Overall Experience Rating */}
          <StarRatingInput
            id="feedback-overall-rating"
            label="Overall Experience Rating"
            subtitle="How would you rate your overall emergency coordination experience?"
            value={overallRating}
            onChange={(val) => {
              setOverallRating(val);
              if (fieldErrors.overallRating) setFieldErrors((prev) => ({ ...prev, overallRating: '' }));
            }}
            error={fieldErrors.overallRating}
            disabled={isSubmitting}
            icon={<Star className="w-4 h-4" />}
          />

          {/* 2. Hospital / Provider Service Rating */}
          <StarRatingInput
            id="feedback-hospital-rating"
            label="Hospital / Provider Service Rating"
            subtitle={
              providerMeta.hospitalName
                ? `Quality of care and coordination by ${providerMeta.hospitalName}`
                : 'Quality of care and coordination by the assigned hospital or healthcare provider(s)'
            }
            value={hospitalProviderRating}
            onChange={(val) => {
              setHospitalProviderRating(val);
              if (fieldErrors.hospitalProviderRating) {
                setFieldErrors((prev) => ({ ...prev, hospitalProviderRating: '' }));
              }
            }}
            error={fieldErrors.hospitalProviderRating}
            disabled={isSubmitting}
            icon={<Building2 className="w-4 h-4" />}
          />

          {/* 3. Ambulance Service Rating (where applicable) */}
          {ambulanceApplicable ? (
            <StarRatingInput
              id="feedback-ambulance-rating"
              label="Ambulance Service Rating"
              subtitle={
                providerMeta.ambulanceName
                  ? `Dispatch, paramedic care, and transport by ${providerMeta.ambulanceName}`
                  : 'Rate the emergency ambulance dispatch, vehicle readiness, and paramedic support'
              }
              value={ambulanceRating}
              onChange={(val) => {
                setAmbulanceRating(val);
                if (fieldErrors.ambulanceRating) setFieldErrors((prev) => ({ ...prev, ambulanceRating: '' }));
              }}
              error={fieldErrors.ambulanceRating}
              disabled={isSubmitting}
              icon={<Truck className="w-4 h-4" />}
            />
          ) : (
            <div className="p-3.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 flex items-center gap-2.5 text-xs text-slate-500">
              <Truck className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                <strong className="text-slate-600">Ambulance Service Rating:</strong> Not applicable (no ambulance service was used in this emergency case).
              </span>
            </div>
          )}

          {/* 4. Response Time Satisfaction */}
          <StarRatingInput
            id="feedback-response-time-rating"
            label="Response Time Satisfaction"
            subtitle="How satisfied were you with how quickly emergency help and resources were coordinated?"
            value={responseTimeSatisfaction}
            onChange={(val) => {
              setResponseTimeSatisfaction(val);
              if (fieldErrors.responseTimeSatisfaction) {
                setFieldErrors((prev) => ({ ...prev, responseTimeSatisfaction: '' }));
              }
            }}
            labels={RESPONSE_TIME_LABELS}
            error={fieldErrors.responseTimeSatisfaction}
            disabled={isSubmitting}
            icon={<Clock className="w-4 h-4" />}
          />

          {/* 5. Comments and Suggestions */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="feedback-comments" className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#00707E]" />
                <span>Comments & Suggestions</span>
                <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400">{comments.length}/2000</span>
            </div>
            <textarea
              id="feedback-comments"
              rows={3}
              maxLength={2000}
              disabled={isSubmitting}
              value={comments}
              onChange={(e) => {
                setComments(e.target.value);
                if (fieldErrors.comments) setFieldErrors((prev) => ({ ...prev, comments: '' }));
              }}
              placeholder="Share what went well or how our emergency coordination, hospital intake, or transport could be improved..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00707E] text-slate-900 placeholder:text-slate-400"
            />
            {fieldErrors.comments && (
              <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.comments}</p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              One optional submission per completed case.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#00707E] hover:bg-[#005B66] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
