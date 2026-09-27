import { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties, type ReactNode } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MatchResponse } from "@frame-one/shared";
import { getSpots, type SpotSummary } from "./api/client";
import { TRAIL_FILTERS, type TrailFilterId } from "./map/trails";

export interface SavedStamp {
  match: MatchResponse;
  photo: string | null;
  placeName: string;
}

interface MapViewProps {
  saved: SavedStamp | null;
  unlocking: boolean;
  home: { lat: number; lng: number };
  unlocks: string[];
  onShoot: () => void;
  dock: ReactNode;
}

const ZOOM = 12.5;
const STAMP_HEIGHT = 0.36;
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const REVEAL_RADIUS = 84;
const REVEAL_FEATHER = 12;

// Catalog of spotIds with design package stamps
const STAMP_SPOTS = [
  "tasm2-red-steps",
  "home-alone-radio-city",
  "joker-bronx-stairs",
  "cap-america-times-square",
  "friends-benefits-central-park-mall",
];

// Returns stamp <img> HTML loading design package SVG from /stamps/
// Falls back to inline SVG clapper for spots without custom art
function getStampHtml(spotId: string): string {
  if (STAMP_SPOTS.includes(spotId)) {
    return `<img src="/stamps/${spotId}.svg" alt="" width="56" height="56" style="display:block" />`;
  }
  // Fallback clapper icon with #e87a2a ring
  return '<svg width="56" height="56" viewBox="0 0 112 112"><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="translate(28,28)"><rect x="6" y="24" width="44" height="26" rx="4"/><path d="M6 24 9 12h38l3 12"/><path d="M18 12 16 24M30 12l-2 12M42 12l-2 12"/></g></svg>';
}

// Design peek marker (yellow ?)
const PEEK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="44" height="44"><circle cx="16" cy="16" r="14" fill="#F5C518" stroke="#1a1a1a" stroke-opacity="0.85" stroke-width="2"/><g fill="none" stroke="#1a1a1a" stroke-opacity="0.85" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 12.2c0-2.6 2-4.2 4.5-4.2s4.5 1.6 4.5 4c0 1.8-1 2.8-2.6 3.7-.9.5-1.5 1.1-1.5 2.3"/></g><circle cx="16" cy="22.8" r="1.5" fill="#1a1a1a" fill-opacity="0.85"/></svg>`;

function markerEl(html: string) {
  const el = document.createElement("div");
  el.className = "map-marker";
  el.innerHTML = html;
  return el;
}

const HANDOFF = {
  land: "#E3DACB",
  water: "#96C0D9",
  park: "#B3D4C1",
  building: "#D8CDB9",
  street: "#FFFFFF",
  casing: "#D6CBB8",
  labelLand: "#5E584D",
  labelWater: "#274E66",
};

function paintHandoff(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    const { id, type } = layer;
    if (type === "background") map.setPaintProperty(id, "background-color", HANDOFF.land);
    else if (id === "water") map.setPaintProperty(id, "fill-color", HANDOFF.water);
    else if (id === "waterway") map.setPaintProperty(id, "line-color", HANDOFF.water);
    else if (id === "park" || id === "landcover_wood") {
      map.setPaintProperty(id, "fill-color", HANDOFF.park);
      map.setPaintProperty(id, "fill-opacity", 0.9);
    } else if (id === "landuse_residential") map.setPaintProperty(id, "fill-color", HANDOFF.land);
    else if (id === "building") {
      map.setPaintProperty(id, "fill-color", HANDOFF.building);
      map.setPaintProperty(id, "fill-opacity", 0.55);
    } else if (type === "line" && id.includes("casing")) map.setPaintProperty(id, "line-color", HANDOFF.casing);
    else if (type === "line" && /highway|road|tunnel/.test(id)) map.setPaintProperty(id, "line-color", HANDOFF.street);
    else if (type === "line" && id.startsWith("boundary")) map.setLayoutProperty(id, "visibility", "none");
    else if (type === "symbol") {
      const water = id.startsWith("water");
      map.setPaintProperty(id, "text-color", water ? HANDOFF.labelWater : HANDOFF.labelLand);
      map.setPaintProperty(id, "text-halo-color", water ? HANDOFF.water : HANDOFF.land);
    }
  }
}

function StampBadge() {
  return (
    <svg width="168" height="168" viewBox="0 0 188 188" fill="none" aria-hidden="true">
      <circle cx="94" cy="94" r="92" fill="var(--action, #e87a2a)" />
      <circle cx="94" cy="94" r="80" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      <g fill="#FFFFFF" fillOpacity="0.9">
        <circle cx="94" cy="28" r="8" />
        <circle cx="94" cy="160" r="8" />
        <circle cx="28" cy="94" r="8" />
        <circle cx="160" cy="94" r="8" />
        <circle cx="47" cy="47" r="8" />
        <circle cx="141" cy="47" r="8" />
        <circle cx="47" cy="141" r="8" />
        <circle cx="141" cy="141" r="8" />
      </g>
      <circle cx="94" cy="94" r="44" fill="var(--accent-dark, #c45a1a)" />
      <circle cx="94" cy="94" r="35" stroke="#FFFFFF" strokeOpacity="0.3" strokeDasharray="3 4" />
    </svg>
  );
}

// Open directions to a location via Google Maps
function openDirections(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, "_blank", "noopener");
}

export default function MapView({ saved, unlocking, home, unlocks, onShoot, dock }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const greyRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [trailFilter, setTrailFilter] = useState<TrailFilterId>("all");
  const focus = saved ? { lat: saved.match.lat, lng: saved.match.lng } : home;
  const next = saved?.match.goNext ?? [];

  useEffect(() => {
    getSpots().then(setSpots).catch(console.error);
  }, []);

  // Memoize filteredSpots to prevent trail filter remounting MapLibre
  const filteredSpots = useMemo(() => {
    const config = TRAIL_FILTERS[trailFilter];
    return spots.filter((spot) => config.spotIds === null || config.spotIds.includes(spot.spotId));
  }, [spots, trailFilter]);

  // Initialize map once
  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstanceRef.current) return;
    
    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      center: [focus.lng, focus.lat],
      zoom: ZOOM,
      minZoom: 10,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapInstanceRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.on("style.load", () => paintHandoff(map));
    map.panBy([0, el.clientHeight * (0.5 - STAMP_HEIGHT)], { duration: 0 });

    return () => {
      mapInstanceRef.current = null;
      map.remove();
    };
  }, []);

  // Update markers when filteredSpots/unlocks/saved changes (without remounting map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add saved stamp marker
    if (saved) {
      const stampHtml = getStampHtml(saved.match.spotId);
      const stamp = `<div class="stamp-pin"><span class="stamp-ripple"></span><span class="stamp-face">${stampHtml}</span></div>`;
      const marker = new maplibregl.Marker({ element: markerEl(stamp) }).setLngLat([focus.lng, focus.lat]).addTo(map);
      markersRef.current.push(marker);
      
      // Go-next peek markers with directions click
      saved.match.goNext.forEach((item, i) => {
        const pinEl = markerEl(`<div class="next-pin" style="animation-delay: calc(var(--reveal) + ${600 + i * 90}ms)">${PEEK_SVG}</div>`);
        pinEl.style.cursor = "pointer";
        pinEl.addEventListener("click", () => openDirections(item.lat, item.lng));
        const m = new maplibregl.Marker({ element: pinEl }).setLngLat([item.lng, item.lat]).addTo(map);
        markersRef.current.push(m);
      });
    }

    // Add filtered spot markers
    filteredSpots.forEach((spot) => {
      const isUnlocked = unlocks.includes(spot.spotId);
      const isSaved = saved && saved.match.spotId === spot.spotId;
      if (isSaved) return;

      if (isUnlocked) {
        const stampEl = markerEl(`<div class="stamp-pin unlocked-stamp"><span class="stamp-face">${getStampHtml(spot.spotId)}</span></div>`);
        const m = new maplibregl.Marker({ element: stampEl }).setLngLat([spot.lng, spot.lat]).addTo(map);
        markersRef.current.push(m);
      } else {
        const peekEl = markerEl(`<div class="peek-pin">${PEEK_SVG}</div>`);
        peekEl.style.cursor = "pointer";
        peekEl.addEventListener("click", () => openDirections(spot.lat, spot.lng));
        const m = new maplibregl.Marker({ element: peekEl }).setLngLat([spot.lng, spot.lat]).addTo(map);
        markersRef.current.push(m);
      }
    });

    // Go-chip markers with directions click (fix #7)
    if (!saved && next.length === 0 && filteredSpots.length > 0) {
      const lockedSpots = filteredSpots.filter((s) => !unlocks.includes(s.spotId));
      const goNextSpots = lockedSpots.slice(0, 2);
      goNextSpots.forEach((spot, i) => {
        const chipEl = markerEl(`<div class="go-chip" style="animation-delay: ${600 + i * 90}ms">${spot.neighbourhood}</div>`);
        chipEl.style.cursor = "pointer";
        chipEl.addEventListener("click", () => openDirections(spot.lat, spot.lng));
        const m = new maplibregl.Marker({ element: chipEl, anchor: "bottom" }).setLngLat([spot.lng, spot.lat]).addTo(map);
        markersRef.current.push(m);
      });
    }

    // Fit bounds to visible spots
    if (filteredSpots.length > 0) {
      const unlockedFiltered = filteredSpots.filter((s) => unlocks.includes(s.spotId));
      const spotsToFit = unlockedFiltered.length > 0 ? unlockedFiltered : filteredSpots;
      const bounds = new maplibregl.LngLatBounds();
      spotsToFit.forEach((spot) => bounds.extend([spot.lng, spot.lat]));
      if (saved) bounds.extend([focus.lng, focus.lat]);
      map.fitBounds(bounds, { padding: { top: 140, right: 40, bottom: 300, left: 40 }, maxZoom: 14, duration: 800 });
    }
  }, [saved, focus.lat, focus.lng, filteredSpots, unlocks, next.length]);

  // Grey mask update logic with throttled pan updates (fixes #4, #5)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const unlockedSpots = filteredSpots.filter((s) => unlocks.includes(s.spotId));

    // Build hole gradient for multi-unlock mask
    // Each gradient: transparent at center (hole), black at edge
    // With intersect composite: result is transparent where ANY gradient is transparent
    // BRIEF: R=84px, feather=12px, rgba(28,28,30,0.72)
    const buildHole = (x: number, y: number, z: number, isNew = false) => {
      const R = REVEAL_RADIUS * z;
      const feather = REVEAL_FEATHER * z;
      if (isNew) {
        // Animated reveal: use CSS var for radius
        return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent calc(var(--reveal-r, ${R}px) - ${feather}px), black var(--reveal-r, ${R}px))`;
      }
      // Static hole: transparent center → black edge
      return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent ${R - feather}px, black ${R}px)`;
    };

    const updateGreyMask = () => {
      const style = greyRef.current?.style;
      if (!style) return;

      const z = 2 ** (map.getZoom() - ZOOM);
      const holes: string[] = [];

      if (saved) {
        const p = map.project([focus.lng, focus.lat]);
        holes.push(buildHole(p.x, p.y, z, unlocking));
      }

      unlockedSpots.forEach((s) => {
        if (saved && s.spotId === saved.match.spotId) return;
        const p = map.project([s.lng, s.lat]);
        holes.push(buildHole(p.x, p.y, z, false));
      });

      if (holes.length > 0) {
        // Multiple gradients with intersect: transparent = hole, black = grey shows
        // intersect gives UNION of all transparent regions (all holes visible)
        style.setProperty("-webkit-mask-image", holes.join(", "));
        style.setProperty("mask-image", holes.join(", "));
        style.setProperty("-webkit-mask-composite", "source-in");
        style.setProperty("mask-composite", "intersect");
      } else {
        style.removeProperty("-webkit-mask-image");
        style.removeProperty("mask-image");
        style.removeProperty("-webkit-mask-composite");
        style.removeProperty("mask-composite");
      }
    };

    // Throttled update during pan (fix #4)
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledUpdate = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        updateGreyMask();
      }, 32); // ~30fps
    };

    updateGreyMask();
    map.on("move", throttledUpdate);
    map.on("moveend", updateGreyMask);
    map.on("zoomend", updateGreyMask);

    return () => {
      map.off("move", throttledUpdate);
      map.off("moveend", updateGreyMask);
      map.off("zoomend", updateGreyMask);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [saved, focus.lat, focus.lng, filteredSpots, unlocks, unlocking]);

  const savedAlreadyCounted = saved && unlocks.includes(saved.match.spotId);
  const stampCount = saved && !savedAlreadyCounted ? unlocks.length + 1 : unlocks.length;
  const hasUnlocks = unlocks.length > 0 || saved;

  return (
    <div className={`screen map-screen${unlocking ? " unlocking" : ""}${hasUnlocks ? " has-unlocks" : ""}`}>
      <div ref={mapRef} className="map-canvas" />
      <div ref={greyRef} className="grey-overlay" />

      <div className="map-header">
        <span className="map-title">New York</span>
        <span className="map-count">{stampCount > 0 ? `${stampCount} stamp${stampCount !== 1 ? "s" : ""}` : "No stamps yet"}</span>
      </div>

      <div className="trail-filters">
        {(Object.keys(TRAIL_FILTERS) as TrailFilterId[]).map((key) => {
          const config = TRAIL_FILTERS[key];
          const isActive = trailFilter === key;
          return (
            <button
              key={key}
              type="button"
              className={`trail-chip${isActive ? " active" : ""}`}
              onClick={() => setTrailFilter(key)}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap contributors · OpenFreeMap
      </a>

      {saved && unlocking && (
        <div className="unlock-stage" role="status">
          <div className="stamp-eyebrow">Stamp unlocked</div>
          <div className="badge-large">
            <StampBadge />
          </div>
          <h1 className="unlocked-title">
            {saved.placeName}
            <br />
            is yours.
          </h1>
          <p className="unlocked-film">
            {saved.match.filmTitle} · {saved.match.year}
          </p>
        </div>
      )}

      <div className="map-sheet">
        <span className="sheet-handle" />
        {saved ? (
          <>
            <div className="sheet-row">
              <div className="mini-merge">
                {saved.photo && <img src={saved.photo} alt="" className="merge-base" />}
                <img src={saved.match.stillUrl} alt="" className="mini-inset" />
              </div>
              <div className="sheet-info">
                <div className="sheet-title">{saved.placeName}</div>
                <div className="sheet-meta">
                  {saved.match.filmTitle} · {saved.match.year}
                </div>
              </div>
            </div>
            {next.length > 0 && (
              <div className="go-next">
                <div className="micro-label">Where to go next</div>
                {next.map((item) => {
                  const [film, area] = item.label.split(" — ");
                  return (
                    <button
                      key={item.spotId}
                      type="button"
                      className="go-next-item"
                      onClick={() => openDirections(item.lat, item.lng)}
                    >
                      <span className="go-next-q">?</span>
                      <span className="go-next-text">
                        <span className="go-next-film">{film}</span>
                        {area && <span className="go-next-area">{area}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : unlocks.length > 0 ? (
          <div className="sheet-unlocked">
            <div className="sheet-title">{unlocks.length} stamp{unlocks.length !== 1 ? "s" : ""} collected</div>
            <p className="sheet-meta">Keep exploring to unlock more film locations.</p>
            <button type="button" className="primary-button" onClick={onShoot}>
              Find another
            </button>
          </div>
        ) : (
          <div className="sheet-empty">
            <div className="sheet-title">Nothing stamped yet</div>
            <p className="sheet-meta">Shoot a place you've seen in a film to reveal the map.</p>
            <button type="button" className="primary-button" onClick={onShoot}>
              Start shooting
            </button>
          </div>
        )}
      </div>

      {dock}
    </div>
  );
}
