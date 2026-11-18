import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Subtitles,
  X,
  Video,
  AlertCircle,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import {
  getGuideVideoConfig,
  resolveGuideVideoSource,
  type GuideVideoConfig
} from '../../config/guideVideo';

interface HowToUseVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  configOverride?: Partial<Pick<GuideVideoConfig, 'videoUrl' | 'captionsUrl' | 'posterUrl'>>;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const HowToUseVideoModal: React.FC<HowToUseVideoModalProps> = ({
  isOpen,
  onClose,
  configOverride
}) => {
  const config = useMemo(() => getGuideVideoConfig(configOverride), [configOverride]);
  const source = useMemo(() => resolveGuideVideoSource(config.videoUrl), [config.videoUrl]);

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(Boolean(config.captionsUrl));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeStepNumber, setActiveStepNumber] = useState<number>(1);
  const [showTextGuide, setShowTextGuide] = useState(true);

  // Close on Escape key & pause playback when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sync fullscreen state across browsers
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    };
  }, []);

  // Sync captions track visibility when toggled
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks || video.textTracks.length === 0) return;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = captionsEnabled ? 'showing' : 'hidden';
    }
  }, [captionsEnabled, isOpen]);

  if (!isOpen) return null;

  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoError(null);
    try {
      if (video.paused || video.ended) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (err) {
      setVideoError(
        err instanceof Error
          ? `Playback could not start: ${err.message}`
          : 'Playback could not start. Please try again.'
      );
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const nextTime = Number(event.target.value);
    if (!video || Number.isNaN(nextTime)) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleFullscreen = async () => {
    const container = playerContainerRef.current;
    const video = videoRef.current;
    if (!container && !video) return;

    try {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void> | void;
        webkitFullscreenElement?: Element | null;
      };
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        return;
      }

      const target = container as (HTMLDivElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      }) | null;

      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target?.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else if (
        video &&
        typeof (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen === 'function'
      ) {
        // Mobile iOS Safari fallback for native fullscreen video
        (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } catch (err) {
      console.warn('[CareBridge Guide Video] Fullscreen toggle notice:', err);
    }
  };

  const jumpToStep = (stepNumber: number, timestampSeconds?: number) => {
    setActiveStepNumber(stepNumber);
    if (
      source.kind === 'direct' &&
      videoRef.current &&
      typeof timestampSeconds === 'number' &&
      timestampSeconds >= 0
    ) {
      videoRef.current.currentTime = timestampSeconds;
      setCurrentTime(timestampSeconds);
      void videoRef.current.play().catch(() => {});
    }
  };

  const handleRetryDirectVideo = () => {
    const video = videoRef.current;
    setVideoError(null);
    if (video) {
      video.load();
    }
  };

  const getRolePillStyle = (role: string) => {
    if (role.includes('Patient')) return 'bg-teal-50 text-teal-800 border-teal-200';
    if (role.includes('Provider')) return 'bg-blue-50 text-blue-800 border-blue-200';
    return 'bg-purple-50 text-purple-800 border-purple-200';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-use-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 id="how-to-use-modal-title" className="text-base sm:text-lg font-extrabold text-slate-900">
                {config.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {config.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Use guide"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Responsive Video Player Container */}
          {source.kind === 'direct' && (
            <div
              ref={playerContainerRef}
              className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-lg border border-slate-800 group"
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain bg-black cursor-pointer"
                playsInline
                preload="metadata"
                poster={config.posterUrl || undefined}
                crossOrigin="anonymous"
                aria-label={config.title}
                onClick={() => void togglePlayPause()}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
                    setDuration(e.currentTarget.duration);
                  }
                  const matchedStep = [...config.steps]
                    .reverse()
                    .find((s) => typeof s.timestampSeconds === 'number' && t >= s.timestampSeconds);
                  if (matchedStep) {
                    setActiveStepNumber(matchedStep.stepNumber);
                  }
                }}
                onDurationChange={(e) => {
                  if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
                    setDuration(e.currentTarget.duration);
                  }
                }}
                onLoadedMetadata={(e) => {
                  if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
                    setDuration(e.currentTarget.duration);
                  }
                  setVideoError(null);
                  const tracks = e.currentTarget.textTracks;
                  if (tracks && tracks.length > 0) {
                    tracks[0].mode = captionsEnabled ? 'showing' : 'hidden';
                  }
                }}
                onError={() =>
                  setVideoError(
                    'Unable to load the configured guide video. Please verify the video URL and format (MP4/WebM) or follow the step-by-step instructions below.'
                  )
                }
              >
                <source src={source.src} type={source.mimeType} />
                {config.captionsUrl && (
                  <track
                    kind="captions"
                    src={config.captionsUrl}
                    srcLang="en"
                    label="English captions"
                    default
                  />
                )}
                Your browser does not support HTML5 video playback.
              </video>

              {/* Center Play Button Overlay when paused */}
              {!isPlaying && !videoError && (
                <button
                  type="button"
                  onClick={() => void togglePlayPause()}
                  aria-label="Play guide video"
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/30 hover:bg-slate-950/20 transition-colors cursor-pointer"
                >
                  <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-teal-600/95 hover:bg-teal-500 text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-105">
                    <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-white ml-1" />
                  </span>
                </button>
              )}

              {/* Error Overlay */}
              {videoError && (
                <div
                  role="alert"
                  className="absolute inset-0 bg-slate-950/90 text-white p-6 flex flex-col items-center justify-center text-center gap-3"
                >
                  <AlertCircle className="w-9 h-9 text-amber-400" />
                  <p className="text-xs sm:text-sm text-slate-200 max-w-md">{videoError}</p>
                  <button
                    type="button"
                    onClick={handleRetryDirectVideo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Video</span>
                  </button>
                </div>
              )}

              {/* Accessible Responsive Control Bar */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent px-3 sm:px-4 pt-6 pb-3 space-y-2">
                {/* Seek Bar */}
                <input
                  type="range"
                  aria-label="Seek video timeline"
                  min={0}
                  max={duration > 0 ? duration : 58}
                  step={0.1}
                  value={Math.min(currentTime, duration > 0 ? duration : 58)}
                  onChange={handleSeek}
                  className="w-full h-1.5 accent-teal-400 cursor-pointer"
                />

                {/* Buttons Row */}
                <div className="flex items-center justify-between gap-2 text-white">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => void togglePlayPause()}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                      className="p-2 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    <span className="text-[11px] sm:text-xs font-mono text-slate-200 tabular-nums">
                      {formatTime(currentTime)}
                      {duration > 0 ? ` / ${formatTime(duration)}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {config.captionsUrl && (
                      <button
                        type="button"
                        onClick={() => setCaptionsEnabled((prev) => !prev)}
                        aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
                        aria-pressed={captionsEnabled}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          captionsEnabled
                            ? 'bg-teal-500 text-white'
                            : 'bg-white/15 text-slate-200 hover:bg-white/25'
                        }`}
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        <span>CC</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleFullscreen()}
                      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                      className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {source.kind === 'embed' && (
            <div className="space-y-2">
              <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
                <iframe
                  src={source.embedUrl}
                  title={config.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-1">
                <span>
                  Use the player controls for Play/Pause, Closed Captions (CC), and Full-Screen on desktop or mobile.
                </span>
                <a
                  href={source.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                >
                  <span>Open video in new tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {source.kind === 'invalid' && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3 text-xs sm:text-sm text-amber-900"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Guide Video URL Configuration Issue</p>
                <p className="text-amber-800">{source.reason}</p>
                <p className="text-xs text-amber-700">
                  Update <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">VITE_GUIDE_VIDEO_URL</code> in{' '}
                  <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">.env</code> or{' '}
                  <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">src/config/guideVideo.ts</code>.
                </p>
              </div>
            </div>
          )}

          {source.kind === 'unconfigured' && (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-[#0F3868] to-teal-950 text-white p-6 sm:p-8 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-300">
                <Video className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold">
                Official Guide Video Ready for Configuration
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 max-w-xl mx-auto leading-relaxed">
                No walkthrough video URL is configured yet. To attach your recorded CareBridge guide video (MP4, WebM, YouTube, or Vimeo) without editing the landing page, set{' '}
                <code className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-teal-200">
                  VITE_GUIDE_VIDEO_URL
                </code>{' '}
                (and optional{' '}
                <code className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-teal-200">
                  VITE_GUIDE_VIDEO_CAPTIONS_URL
                </code>
                ) in <code className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-teal-200">.env</code> or{' '}
                <code className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-teal-200">
                  src/config/guideVideo.ts
                </code>
                .
              </p>
              <p className="text-[11px] text-teal-200/90">
                In the meantime, follow the complete 7-step text instructions below.
              </p>
            </div>
          )}

          {/* Step-by-Step Text Instructions & Captions Companion */}
          <section className="space-y-3" aria-label="Step-by-step CareBridge text instructions">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Step-by-Step Guide &amp; Text Instructions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTextGuide((prev) => !prev)}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
              >
                {showTextGuide ? 'Hide text instructions' : 'Show text instructions'}
              </button>
            </div>

            {showTextGuide && (
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {config.steps.map((step) => {
                  const isActive = activeStepNumber === step.stepNumber;
                  return (
                    <li
                      key={step.stepNumber}
                      onClick={() => jumpToStep(step.stepNumber, step.timestampSeconds)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-50/70 border-teal-300 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200 hover:border-teal-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-teal-800 border border-teal-200'
                          }`}
                        >
                          {step.stepNumber}
                        </span>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                              {step.title}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRolePillStyle(
                                step.role
                              )}`}
                            >
                              {step.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{step.summary}</p>
                          {typeof step.timestampSeconds === 'number' && source.kind === 'direct' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-teal-700 pt-0.5">
                              <Play className="w-3 h-3" />
                              Jump to {formatTime(step.timestampSeconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>Responsive video &amp; step instructions for desktop and mobile browsers.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
