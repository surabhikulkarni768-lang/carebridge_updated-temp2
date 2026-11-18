import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Plus,
  Minus,
  Crosshair,
  Check,
  ExternalLink,
  Bed,
  HeartPulse,
  Building2,
  X,
  Database
} from 'lucide-react';
import {
  DEFAULT_SEARCH_RADIUS_KM,
  formatAccuracyMeters,
  formatDistanceKm,
  getGoogleMapsDirectionsUrl,
  type GpsAccuracyAssessment,
  type GpsLocationReading,
  type HospitalProvider,
  type NearbyEmergencyResource
} from '../../services/hospitalDirectoryService';

interface NearbyHospitalsMapProps {
  patientLocation: GpsLocationReading | null;
  accuracyAssessment: GpsAccuracyAssessment | null;
  hospitals: HospitalProvider[];
  nearbyResources?: NearbyEmergencyResource[];
  selectedHospitalId: string;
  onSelectHospital: (hospitalId: string) => void;
  searchRadiusKm?: number;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 9;
const MAX_ZOOM = 17;

// Exact Web Mercator (EPSG:3857) projection helpers
const latLngToWorldPoint = (lat: number, lng: number, zoom: number): { x: number; y: number } => {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
};

const worldPointToLatLng = (x: number, y: number, zoom: number): { lat: number; lng: number } => {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
};

const metersPerPixelAtLat = (lat: number, zoom: number): number => {
  const earthCircumferenceMeters = 40075016.686;
  return (Math.cos((lat * Math.PI) / 180) * earthCircumferenceMeters) / (TILE_SIZE * Math.pow(2, zoom));
};

const chooseInitialZoom = (
  origin: { lat: number; lng: number },
  hospitals: HospitalProvider[],
  radiusKm: number
): number => {
  const within = hospitals.some((h) => h.distanceKm <= radiusKm);
  if (within) return 14;
  const closestDist = hospitals[0]?.distanceKm ?? radiusKm;
  if (closestDist <= 3) return 13;
  if (closestDist <= 7) return 12;
  if (closestDist <= 18) return 11;
  if (closestDist <= 40) return 10;
  return 9;
};

export const NearbyHospitalsMap: React.FC<NearbyHospitalsMapProps> = ({
  patientLocation,
  accuracyAssessment,
  hospitals,
  nearbyResources = [],
  selectedHospitalId,
  onSelectHospital,
  searchRadiusKm = DEFAULT_SEARCH_RADIUS_KM
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 560, height: 300 });

  const defaultCenter = useMemo(() => {
    if (patientLocation) return { lat: patientLocation.lat, lng: patientLocation.lng };
    if (hospitals[0]?.coordinates) return hospitals[0].coordinates;
    return { lat: 15.3524, lng: 75.1328 };
  }, [patientLocation, hospitals]);

  const [center, setCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
  const [zoom, setZoom] = useState<number>(() =>
    chooseInitialZoom(defaultCenter, hospitals, searchRadiusKm)
  );
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [tileErrors, setTileErrors] = useState<Record<string, boolean>>({});
  const dragStateRef = useRef<{
    dragging: boolean;
    startClientX: number;
    startClientY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);

  // Recenter smoothly when patientLocation changes
  useEffect(() => {
    if (!patientLocation) return;
    setCenter({ lat: patientLocation.lat, lng: patientLocation.lng });
    setZoom(chooseInitialZoom(patientLocation, hospitals, searchRadiusKm));
  }, [patientLocation?.lat, patientLocation?.lng, patientLocation?.capturedAt]);

  // Observe container dimensions so marker positions stay pixel-exact on desktop & mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const centerWorld = useMemo(
    () => latLngToWorldPoint(center.lat, center.lng, zoom),
    [center.lat, center.lng, zoom]
  );

  const projectToScreen = (lat: number, lng: number) => {
    const pt = latLngToWorldPoint(lat, lng, zoom);
    return {
      x: pt.x - centerWorld.x + viewport.width / 2,
      y: pt.y - centerWorld.y + viewport.height / 2
    };
  };

  // Compute visible OSM tiles
  const tiles = useMemo(() => {
    const numTiles = Math.pow(2, zoom);
    const minTileX = Math.floor((centerWorld.x - viewport.width / 2) / TILE_SIZE) - 1;
    const maxTileX = Math.floor((centerWorld.x + viewport.width / 2) / TILE_SIZE) + 1;
    const minTileY = Math.floor((centerWorld.y - viewport.height / 2) / TILE_SIZE) - 1;
    const maxTileY = Math.floor((centerWorld.y + viewport.height / 2) / TILE_SIZE) + 1;

    const result: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      for (let ty = minTileY; ty <= maxTileY; ty += 1) {
        if (ty < 0 || ty >= numTiles) continue;
        const wrappedX = ((tx % numTiles) + numTiles) % numTiles;
        const left = tx * TILE_SIZE - centerWorld.x + viewport.width / 2;
        const top = ty * TILE_SIZE - centerWorld.y + viewport.height / 2;
        const key = `${zoom}/${wrappedX}/${ty}`;
        result.push({
          key,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left,
          top
        });
      }
    }
    return result;
  }, [centerWorld.x, centerWorld.y, viewport.width, viewport.height, zoom]);

  const patientScreen = patientLocation
    ? projectToScreen(patientLocation.lat, patientLocation.lng)
    : null;

  const mpp = patientLocation
    ? metersPerPixelAtLat(patientLocation.lat, zoom)
    : metersPerPixelAtLat(center.lat, zoom);

  const searchRadiusPx = (searchRadiusKm * 1000) / mpp;
  const accuracyRadiusPx =
    patientLocation?.accuracyMeters && patientLocation.accuracyMeters > 0
      ? Math.min(2000, patientLocation.accuracyMeters / mpp)
      : 0;

  const activePopupHospital = useMemo(
    () => hospitals.find((h) => h.id === activePopupId) || null,
    [hospitals, activePopupId]
  );

  // Pointer drag panning (works for mouse and touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      dragging: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWorldX: centerWorld.x,
      startWorldY: centerWorld.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !drag.dragging) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const next = worldPointToLatLng(drag.startWorldX - dx, drag.startWorldY - dy, zoom);
    setCenter(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.dragging) {
      dragStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleRecenter = () => {
    if (patientLocation) {
      setCenter({ lat: patientLocation.lat, lng: patientLocation.lng });
      setZoom(chooseInitialZoom(patientLocation, hospitals, searchRadiusKm));
    } else if (hospitals[0]?.coordinates) {
      setCenter(hospitals[0].coordinates);
      setZoom(13);
    }
  };

  const originQueryString = patientLocation
    ? `${patientLocation.lat},${patientLocation.lng}`
    : undefined;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
      {/* Interactive Map Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="region"
        aria-label="Interactive nearby hospitals and patient GPS map"
        className="relative w-full h-64 sm:h-72 bg-[#e8eef3] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
      >
        {/* Subtle coordinate grid backdrop (visible while loading or if offline) */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />

        {/* OpenStreetMap Tiles */}
        <div className="absolute inset-0 pointer-events-none">
          {tiles.map((tile) =>
            tileErrors[tile.key] ? null : (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable={false}
                onError={() =>
                  setTileErrors((prev) => (prev[tile.key] ? prev : { ...prev, [tile.key]: true }))
                }
                style={{
                  position: 'absolute',
                  left: Math.round(tile.left),
                  top: Math.round(tile.top),
                  width: TILE_SIZE,
                  height: TILE_SIZE
                }}
              />
            )
          )}
        </div>

        {/* Geometric Overlay SVG: 2 km Search Radius Ring & Separate GPS Accuracy Ring */}
        {patientScreen && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={viewport.width}
            height={viewport.height}
          >
            {/* 2 km Search Radius Circle */}
            <circle
              cx={patientScreen.x}
              cy={patientScreen.y}
              r={Math.max(8, searchRadiusPx)}
              fill="rgba(13, 148, 136, 0.09)"
              stroke={accuracyAssessment?.tier === 'poor' ? '#d97706' : '#00707E'}
              strokeWidth="2"
              strokeDasharray={accuracyAssessment?.tier === 'poor' ? '6 5' : 'none'}
            />

            {/* Separate GPS Accuracy Uncertainty Ring (when device reports accuracy) */}
            {accuracyRadiusPx >= 4 && accuracyAssessment && accuracyAssessment.tier !== 'manual' && (
              <circle
                cx={patientScreen.x}
                cy={patientScreen.y}
                r={accuracyRadiusPx}
                fill={
                  accuracyAssessment.tier === 'poor'
                    ? 'rgba(220, 38, 38, 0.14)'
                    : accuracyAssessment.tier === 'caution'
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'rgba(37, 99, 235, 0.16)'
                }
                stroke={
                  accuracyAssessment.tier === 'poor'
                    ? '#dc2626'
                    : accuracyAssessment.tier === 'caution'
                      ? '#d97706'
                      : '#2563eb'
                }
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            )}
          </svg>
        )}

        {/* Nearby Non-Hospital Emergency Resource Dots (Blood / Oxygen / Ambulance) */}
        {nearbyResources.map((res) => {
          const pos = projectToScreen(res.coordinates.lat, res.coordinates.lng);
          if (pos.x < -30 || pos.x > viewport.width + 30 || pos.y < -30 || pos.y > viewport.height + 30) {
            return null;
          }
          const color =
            res.resourceKind === 'bloodBank'
              ? 'bg-rose-600'
              : res.resourceKind === 'oxygenProvider'
                ? 'bg-sky-600'
                : 'bg-amber-600';
          return (
            <div
              key={`res-${res.id}`}
              title={`${res.name} (${formatDistanceKm(res.distanceKm)}) — ${res.availabilitySummary}`}
              style={{ left: pos.x, top: pos.y }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${color} z-10`}
            />
          );
        })}

        {/* Hospital Pins */}
        {hospitals.map((hospital) => {
          const pos = projectToScreen(hospital.coordinates.lat, hospital.coordinates.lng);
          if (pos.x < -40 || pos.x > viewport.width + 40 || pos.y < -40 || pos.y > viewport.height + 40) {
            return null;
          }
          const isSelected = hospital.id === selectedHospitalId;
          const isWithin = hospital.withinSearchRadius ?? hospital.distanceKm <= searchRadiusKm;
          const isPopupOpen = activePopupId === hospital.id;

          return (
            <button
              key={hospital.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopupId(isPopupOpen ? null : hospital.id);
              }}
              style={{ left: pos.x, top: pos.y }}
              aria-label={`${hospital.name}, ${formatDistanceKm(hospital.distanceKm)}, ${hospital.availableResources.beds} general beds, ${hospital.availableResources.icu} ICU beds`}
              className={`absolute -translate-x-1/2 -translate-y-full transition-transform cursor-pointer group ${
                isSelected || isPopupOpen ? 'z-30 scale-110' : 'z-20 hover:scale-105'
              }`}
            >
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold shadow-md border whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#0F3868] text-white border-white ring-2 ring-teal-400'
                    : isWithin
                      ? 'bg-emerald-600 text-white border-white'
                      : 'bg-indigo-600 text-white border-white'
                }`}
              >
                <Building2 className="w-3 h-3 shrink-0" />
                <span>{hospital.availableResources.beds}B · {hospital.availableResources.icu} ICU</span>
              </div>
              <div
                className={`w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 border-r border-b border-white ${
                  isSelected ? 'bg-[#0F3868]' : isWithin ? 'bg-emerald-600' : 'bg-indigo-600'
                }`}
              />
            </button>
          );
        })}

        {/* Patient Current Location Marker */}
        {patientScreen && patientLocation && (
          <div
            style={{ left: patientScreen.x, top: patientScreen.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <span className="absolute -inset-2.5 rounded-full bg-blue-500/35 animate-ping" />
            <span className="relative block w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
            <div className="absolute left-1/2 -translate-x-1/2 top-5 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-xs">
              You ({patientLocation.lat.toFixed(4)}, {patientLocation.lng.toFixed(4)})
            </div>
          </div>
        )}

        {/* Top-Left Radius & Accuracy Chip */}
        <div className="absolute top-2.5 left-2.5 z-30 flex flex-wrap items-center gap-1.5 max-w-[75%]">
          <span className="px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 text-[10px] font-bold text-[#0F3868] shadow-xs">
            Search Radius: {searchRadiusKm} km
            {accuracyAssessment?.tier === 'poor' ? ' (approx.)' : ''}
          </span>
          {patientLocation?.accuracyMeters != null && (
            <span
              className={`px-2.5 py-1 rounded-lg backdrop-blur-xs border text-[10px] font-bold shadow-xs ${
                accuracyAssessment?.tier === 'good'
                  ? 'bg-emerald-50/95 text-emerald-800 border-emerald-300'
                  : accuracyAssessment?.tier === 'caution'
                    ? 'bg-amber-50/95 text-amber-900 border-amber-300'
                    : 'bg-red-50/95 text-red-800 border-red-300'
              }`}
            >
              GPS Accuracy: {formatAccuracyMeters(patientLocation.accuracyMeters)}
            </span>
          )}
        </div>

        {/* Top-Right Map Zoom & Recenter Controls */}
        <div className="absolute top-2.5 right-2.5 z-30 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            aria-label="Zoom in map"
            className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-slate-200 text-slate-700 shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            aria-label="Zoom out map"
            className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-slate-200 text-slate-700 shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            title="Re-center on patient location"
            aria-label="Re-center on patient location"
            className="w-8 h-8 rounded-lg bg-white/95 hover:bg-white border border-slate-200 text-[#00707E] shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Selected Pin Popup */}
        {activePopupHospital && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-40 bg-white/98 backdrop-blur-xs rounded-2xl border border-slate-200 shadow-xl p-3 text-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                    {activePopupHospital.name}
                  </span>
                  {activePopupHospital.isLiveFirestoreData && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <Database className="w-2.5 h-2.5" /> Live Firestore
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                  {activePopupHospital.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePopupId(null)}
                aria-label="Close hospital popup"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-bold text-[#00707E] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                  {formatDistanceKm(activePopupHospital.distanceKm)}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Bed className="w-3 h-3 text-teal-700" />
                  General: {activePopupHospital.availableResources.beds}/{activePopupHospital.availableResources.totalBeds}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  <HeartPulse className="w-3 h-3 text-indigo-600" />
                  ICU: {activePopupHospital.availableResources.icu}/{activePopupHospital.availableResources.totalIcu}
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <a
                  href={getGoogleMapsDirectionsUrl(activePopupHospital, originQueryString)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-semibold text-[#00707E] hover:underline inline-flex items-center gap-0.5"
                >
                  Directions <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onSelectHospital(activePopupHospital.id);
                    setActivePopupId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                    activePopupHospital.id === selectedHospitalId
                      ? 'bg-[#0F3868] text-white'
                      : 'bg-[#00707E] hover:bg-[#005B66] text-white'
                  }`}
                >
                  {activePopupHospital.id === selectedHospitalId ? (
                    <>
                      <Check className="w-3 h-3" /> Selected
                    </>
                  ) : (
                    'Select Hospital'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attribution */}
        <div className="absolute bottom-1 right-1.5 z-20 text-[9px] text-slate-600 bg-white/80 px-1.5 py-0.5 rounded pointer-events-none">
          © OpenStreetMap contributors
        </div>
      </div>

      {/* Compact Map Legend */}
      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Your Location
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Within {searchRadiusKm} km
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" /> Outside {searchRadiusKm} km
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#00707E] inline-block" /> {searchRadiusKm} km Search Radius
          </span>
        </div>
        <span className="text-slate-400">Drag to pan · Tap pin for details</span>
      </div>
    </div>
  );
};
