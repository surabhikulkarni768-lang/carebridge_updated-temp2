/**
 * CareBridge "How to Use" Guide Video Configuration
 *
 * Configure the guide video URL without modifying LandingPage.tsx:
 *   1. Set VITE_GUIDE_VIDEO_URL (and optionally VITE_GUIDE_VIDEO_CAPTIONS_URL / VITE_GUIDE_VIDEO_POSTER_URL)
 *      in your `.env` file, OR
 *   2. Update `DEFAULT_GUIDE_VIDEO_CONFIG` below.
 *
 * Supported URL formats:
 *   - Direct video files (MP4, WebM, OGG) hosted via HTTPS or in `public/` (e.g. `/media/carebridge-guide.mp4`)
 *   - YouTube links (`https://www.youtube.com/watch?v=...`, `https://youtu.be/...`, or embed URLs)
 *   - Vimeo links (`https://vimeo.com/...` or `https://player.vimeo.com/video/...`)
 *
 * Do NOT set a fake or placeholder video URL. Leave empty until the official CareBridge walkthrough is ready.
 */

export interface GuideStep {
  stepNumber: number;
  title: string;
  role: 'Patient / Attendant' | 'Healthcare Provider' | 'Admin / Coordinator';
  summary: string;
  timestampSeconds?: number;
}

export interface GuideVideoConfig {
  /** Direct MP4/WebM URL, local `/...` video path, YouTube URL, or Vimeo URL. Empty string if not yet configured. */
  videoUrl: string;
  /** Optional WebVTT (`.vtt`) captions track URL for HTML5 video playback. */
  captionsUrl: string;
  /** Optional poster image URL displayed before playback starts. */
  posterUrl: string;
  /** Accessible title for the guide video player. */
  title: string;
  /** Short subtitle displayed in the guide modal header. */
  description: string;
  /** Ordered walkthrough steps & text instructions covering the end-to-end CareBridge workflow. */
  steps: GuideStep[];
}

export type ResolvedGuideVideoSource =
  | { kind: 'unconfigured' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'direct'; src: string; mimeType?: string }
  | { kind: 'embed'; provider: 'youtube' | 'vimeo'; embedUrl: string; originalUrl: string };

export const CAREBRIDGE_GUIDE_STEPS: GuideStep[] = [
  {
    stepNumber: 1,
    title: 'Patient Registration and Login',
    role: 'Patient / Attendant',
    summary:
      'Create a Patient or Patient Attendant account from Sign Up, verify your contact details, and log in to open your personal emergency dashboard.',
    timestampSeconds: 5
  },
  {
    stepNumber: 2,
    title: 'Creating an Emergency Case',
    role: 'Patient / Attendant',
    summary:
      'Click "Emergency Resource Requisition" or "+ New Emergency Case", enter patient details, symptoms, urgency level, and incident address to generate a unique Case ID.',
    timestampSeconds: 12
  },
  {
    stepNumber: 3,
    title: 'Selecting Required Resources',
    role: 'Patient / Attendant',
    summary:
      'Select all critical resources needed for the emergency — Hospital Beds, ICU Facilities, Blood units (by blood group), Medical Oxygen, Ambulance, or Doctor Assistance.',
    timestampSeconds: 19
  },
  {
    stepNumber: 4,
    title: 'Selecting an Available Hospital',
    role: 'Patient / Attendant',
    summary:
      'Review nearby verified hospitals with live bed and ICU availability, check distance and directions, and select the most suitable facility for admission.',
    timestampSeconds: 26
  },
  {
    stepNumber: 5,
    title: 'Tracking Emergency Requests',
    role: 'Patient / Attendant',
    summary:
      'Monitor real-time status updates for every requested resource, view live 7-step ambulance progress, and receive instant dashboard notifications.',
    timestampSeconds: 33
  },
  {
    stepNumber: 6,
    title: 'Provider Request Acceptance',
    role: 'Healthcare Provider',
    summary:
      'Verified hospitals, blood banks, oxygen depots, ambulance fleets, and physicians review incoming requisitions and accept or decline with live inventory updates.',
    timestampSeconds: 40
  },
  {
    stepNumber: 7,
    title: 'Admin Coordination and Resource Fulfilment',
    role: 'Admin / Coordinator',
    summary:
      'Central coordinators oversee active cases, assign or reassign verified providers when needed, advance lifecycle statuses through completion, and review patient feedback.',
    timestampSeconds: 47
  }
];

const readEnvString = (key: string): string => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    return typeof env?.[key] === 'string' ? env[key]!.trim() : '';
  } catch {
    return '';
  }
};

export const DEFAULT_GUIDE_VIDEO_CONFIG: GuideVideoConfig = {
  videoUrl: '/media/carebridge-how-to-use.mp4',
  captionsUrl: '/media/carebridge-how-to-use.vtt',
  posterUrl: '/media/carebridge-how-to-use-poster.png',
  title: 'How to Use CareBridge — Step-by-Step Guide',
  description:
    'Learn how patients, attendants, healthcare providers, and central coordinators use CareBridge during a medical emergency.',
  steps: CAREBRIDGE_GUIDE_STEPS
};

export function getGuideVideoConfig(
  overrides?: Partial<Pick<GuideVideoConfig, 'videoUrl' | 'captionsUrl' | 'posterUrl'>>
): GuideVideoConfig {
  const videoUrl = (overrides?.videoUrl ?? readEnvString('VITE_GUIDE_VIDEO_URL')) || DEFAULT_GUIDE_VIDEO_CONFIG.videoUrl;
  const captionsUrl =
    (overrides?.captionsUrl ?? readEnvString('VITE_GUIDE_VIDEO_CAPTIONS_URL')) ||
    DEFAULT_GUIDE_VIDEO_CONFIG.captionsUrl;
  const posterUrl =
    (overrides?.posterUrl ?? readEnvString('VITE_GUIDE_VIDEO_POSTER_URL')) ||
    DEFAULT_GUIDE_VIDEO_CONFIG.posterUrl;

  return {
    ...DEFAULT_GUIDE_VIDEO_CONFIG,
    videoUrl: videoUrl.trim(),
    captionsUrl: captionsUrl.trim(),
    posterUrl: posterUrl.trim()
  };
}

const inferDirectVideoMimeType = (url: string): string | undefined => {
  const cleanPath = url.split('?')[0].split('#')[0].toLowerCase();
  if (cleanPath.endsWith('.mp4') || cleanPath.endsWith('.m4v')) return 'video/mp4';
  if (cleanPath.endsWith('.webm')) return 'video/webm';
  if (cleanPath.endsWith('.ogv') || cleanPath.endsWith('.ogg')) return 'video/ogg';
  return undefined;
};

const extractYouTubeVideoId = (parsed: URL): string | null => {
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = parsed.pathname.replace(/^\//, '').split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v') || '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const pathMatch = parsed.pathname.match(/^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    if (pathMatch) return pathMatch[2];
  }
  return null;
};

const extractVimeoVideoId = (parsed: URL): string | null => {
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'vimeo.com') {
    const match = parsed.pathname.match(/^\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }
  if (host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/^\/video\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }
  return null;
};

export function resolveGuideVideoSource(rawUrl?: string): ResolvedGuideVideoSource {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { kind: 'unconfigured' };
  }

  // Allow safe root-relative paths (e.g. `/media/carebridge-guide.mp4`)
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      return { kind: 'invalid', reason: 'Protocol-relative URLs are not supported. Use an https:// URL or a root-relative path.' };
    }
    return {
      kind: 'direct',
      src: trimmed,
      mimeType: inferDirectVideoMimeType(trimmed)
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { kind: 'invalid', reason: 'The configured guide video URL is not a valid URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { kind: 'invalid', reason: 'Only http://, https://, or root-relative video URLs are supported.' };
  }

  const youtubeId = extractYouTubeVideoId(parsed);
  if (youtubeId) {
    return {
      kind: 'embed',
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1&cc_load_policy=1&modestbranding=1`,
      originalUrl: trimmed
    };
  }

  const vimeoId = extractVimeoVideoId(parsed);
  if (vimeoId) {
    return {
      kind: 'embed',
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      originalUrl: trimmed
    };
  }

  return {
    kind: 'direct',
    src: trimmed,
    mimeType: inferDirectVideoMimeType(trimmed)
  };
}
