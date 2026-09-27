import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

// Per-character stamp art (56px display, 112px @2x source)
const STAMP_ART: Record<string, string> = {
  "tasm2-red-steps": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="56" height="56"><defs><clipPath id="clip-tasm"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-tasm)"><ellipse cx="56" cy="48" rx="22" ry="26" fill="#c62828"/><ellipse cx="47" cy="46" rx="8" ry="10" fill="#90caf9" transform="rotate(-12 47 46)"/><ellipse cx="65" cy="46" rx="8" ry="10" fill="#90caf9" transform="rotate(12 65 46)"/><ellipse cx="47" cy="46" rx="4.5" ry="6" fill="#1565c0" transform="rotate(-12 47 46)"/><ellipse cx="65" cy="46" rx="4.5" ry="6" fill="#1565c0" transform="rotate(12 65 46)"/><path d="M56 28 L56 74 M40 40 L72 56 M72 40 L40 56" fill="none" stroke="#8b1a1a" stroke-width="1.2" opacity="0.55"/><path d="M34 78 Q56 68 78 78 L78 112 L34 112 Z" fill="#1565c0"/><path d="M44 78 Q56 72 68 78 L68 112 L44 112 Z" fill="#c62828"/></g></svg>`,
  "home-alone-radio-city": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="56" height="56"><defs><clipPath id="clip-kevin"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#f7f1ea"/><g clip-path="url(#clip-kevin)"><ellipse cx="56" cy="54" rx="20" ry="22" fill="#e8c4a8"/><path d="M34 48 Q34 28 56 26 Q78 28 78 48 L78 52 Q56 48 34 52 Z" fill="#2a241f"/><ellipse cx="56" cy="28" rx="7" ry="5" fill="#e87a2a"/><circle cx="48" cy="54" r="3.2" fill="#2a241f"/><circle cx="64" cy="54" r="3.2" fill="#2a241f"/><ellipse cx="56" cy="66" rx="5" ry="6" fill="#2a241f"/><path d="M38 74 Q56 70 74 74 L78 88 Q56 92 34 88 Z" fill="#c62828"/><rect x="62" y="78" width="10" height="28" rx="3" fill="#c62828"/><rect x="62" y="100" width="10" height="6" rx="2" fill="#f7f1ea" opacity="0.7"/></g></svg>`,
  "joker-bronx-stairs": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="56" height="56"><defs><clipPath id="clip-joker"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-joker)"><path d="M28 58 Q26 22 56 18 Q86 22 84 58 Q78 42 56 40 Q34 42 28 58 Z" fill="#4caf50"/><path d="M30 50 Q28 30 42 26 Q36 40 30 50 M82 50 Q84 30 70 26 Q76 40 82 50" fill="#66bb6a"/><ellipse cx="56" cy="58" rx="18" ry="20" fill="#f5f0e8"/><ellipse cx="48" cy="56" rx="3.5" ry="4" fill="#1a1a1a"/><ellipse cx="64" cy="56" rx="3.5" ry="4" fill="#1a1a1a"/><path d="M42 68 Q56 80 70 68" fill="none" stroke="#c62828" stroke-width="2.5" stroke-linecap="round"/><path d="M36 82 Q56 76 76 82 L80 112 L32 112 Z" fill="#6a1b9a"/><path d="M52 82 L56 96 L60 82" fill="#f5f0e8"/></g></svg>`,
  "cap-america-times-square": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="56" height="56"><defs><clipPath id="clip-cap"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#f7f1ea"/><g clip-path="url(#clip-cap)"><circle cx="56" cy="56" r="34" fill="#c62828"/><circle cx="56" cy="56" r="26" fill="#f7f1ea"/><circle cx="56" cy="56" r="18" fill="#c62828"/><circle cx="56" cy="56" r="11" fill="#1565c0"/><path d="M56 47 L58.5 53.5 L65.5 53.5 L60 58 L62.2 64.5 L56 60.5 L49.8 64.5 L52 58 L46.5 53.5 L53.5 53.5 Z" fill="#f7f1ea"/></g></svg>`,
  "friends-benefits-central-park-mall": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="56" height="56"><defs><clipPath id="clip-fwb"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-fwb)"><ellipse cx="56" cy="90" rx="40" ry="14" fill="#3d5a3d" opacity="0.45"/><circle cx="42" cy="44" r="11" fill="#e8c4a8"/><path d="M30 58 Q42 52 54 58 L54 92 L30 92 Z" fill="#5d4e37"/><path d="M32 38 Q42 30 52 38 Q48 48 42 48 Q36 48 32 38 Z" fill="#2a241f"/><circle cx="70" cy="44" r="11" fill="#e8c4a8"/><path d="M58 58 Q70 52 82 58 L82 92 L58 92 Z" fill="#8b4513"/><path d="M58 40 Q62 28 70 28 Q78 28 82 40 L80 56 Q70 60 60 56 Z" fill="#4a3728"/><path d="M50 62 Q56 56 62 62 Q56 70 50 62 Z" fill="#e87a2a"/></g></svg>`,
};

// Fallback stamp (clapper icon) for spots without custom art
const STAMP_FALLBACK = '<svg width="56" height="56" viewBox="0 0 112 112"><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="translate(28,28)"><rect x="6" y="24" width="44" height="26" rx="4"/><path d="M6 24 9 12h38l3 12"/><path d="M18 12 16 24M30 12l-2 12M42 12l-2 12"/></g></svg>';

// Design peek marker (yellow ?)
const PEEK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="44" height="44"><circle cx="16" cy="16" r="14" fill="#F5C518" stroke="#1a1a1a" stroke-opacity="0.85" stroke-width="2"/><g fill="none" stroke="#1a1a1a" stroke-opacity="0.85" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 12.2c0-2.6 2-4.2 4.5-4.2s4.5 1.6 4.5 4c0 1.8-1 2.8-2.6 3.7-.9.5-1.5 1.1-1.5 2.3"/></g><circle cx="16" cy="22.8" r="1.5" fill="#1a1a1a" fill-opacity="0.85"/></svg>`;

function getStampArt(spotId: string): string {
  return STAMP_ART[spotId] || STAMP_FALLBACK;
}

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
  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [trailFilter, setTrailFilter] = useState<TrailFilterId>("all");
  const focus = saved ? { lat: saved.match.lat, lng: saved.match.lng } : home;
  const next = saved?.match.goNext ?? [];

  useEffect(() => {
    getSpots().then(setSpots).catch(console.error);
  }, []);

  const filteredSpots = spots.filter((spot) => {
    const config = TRAIL_FILTERS[trailFilter];
    return config.spotIds === null || config.spotIds.includes(spot.spotId);
  });

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
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
    map.touchZoomRotate.disableRotation();
    map.on("style.load", () => paintHandoff(map));
    map.panBy([0, el.clientHeight * (0.5 - STAMP_HEIGHT)], { duration: 0 });

    if (saved) {
      const stampArt = getStampArt(saved.match.spotId);
      const stamp = `<div class="stamp-pin"><span class="stamp-ripple"></span><span class="stamp-face">${stampArt}</span></div>`;
      new maplibregl.Marker({ element: markerEl(stamp) }).setLngLat([focus.lng, focus.lat]).addTo(map);
      saved.match.goNext.forEach((item, i) => {
        const pinEl = markerEl(`<div class="next-pin" style="animation-delay: calc(var(--reveal) + ${600 + i * 90}ms)">${PEEK_SVG}</div>`);
        pinEl.style.cursor = "pointer";
        pinEl.addEventListener("click", () => openDirections(item.lat, item.lng));
        new maplibregl.Marker({ element: pinEl }).setLngLat([item.lng, item.lat]).addTo(map);
      });
    }

    filteredSpots.forEach((spot) => {
      const isUnlocked = unlocks.includes(spot.spotId);
      const isSaved = saved && saved.match.spotId === spot.spotId;
      if (isSaved) return;

      if (isUnlocked) {
        const stampEl = markerEl(`<div class="stamp-pin unlocked-stamp"><span class="stamp-face">${getStampArt(spot.spotId)}</span></div>`);
        new maplibregl.Marker({ element: stampEl }).setLngLat([spot.lng, spot.lat]).addTo(map);
      } else {
        const peekEl = markerEl(`<div class="peek-pin">${PEEK_SVG}</div>`);
        peekEl.style.cursor = "pointer";
        peekEl.addEventListener("click", () => openDirections(spot.lat, spot.lng));
        new maplibregl.Marker({ element: peekEl }).setLngLat([spot.lng, spot.lat]).addTo(map);
      }
    });

    if (!saved && next.length === 0 && filteredSpots.length > 0) {
      const lockedSpots = filteredSpots.filter((s) => !unlocks.includes(s.spotId));
      const goNextSpots = lockedSpots.slice(0, 2);
      goNextSpots.forEach((spot, i) => {
        const pin = `<div class="go-chip" style="animation-delay: ${600 + i * 90}ms">${spot.neighbourhood}</div>`;
        new maplibregl.Marker({ element: markerEl(pin), anchor: "bottom" }).setLngLat([spot.lng, spot.lat]).addTo(map);
      });
    }

    if (filteredSpots.length > 0) {
      const unlockedFiltered = filteredSpots.filter((s) => unlocks.includes(s.spotId));
      const spotsToFit = unlockedFiltered.length > 0 ? unlockedFiltered : filteredSpots;
      const bounds = new maplibregl.LngLatBounds();
      spotsToFit.forEach((spot) => bounds.extend([spot.lng, spot.lat]));
      if (saved) bounds.extend([focus.lng, focus.lat]);
      map.fitBounds(bounds, { padding: { top: 140, right: 40, bottom: 300, left: 40 }, maxZoom: 14, duration: 800 });
    }

    const unlockedSpots = filteredSpots.filter((s) => unlocks.includes(s.spotId));

    // Circle cutout for each unlocked spot - neighbourhood "lights up"
    // BRIEF: 84px radius, 12px feather, rgba(28,28,30,0.72) wash
    const buildHole = (x: number, y: number, z: number, isNew = false) => {
      const R = REVEAL_RADIUS * z;
      const feather = REVEAL_FEATHER * z;
      if (isNew) {
        return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent calc(var(--reveal-r, ${R}px) - ${feather}px), rgba(28,28,30,0.72) var(--reveal-r, ${R}px))`;
      }
      return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent ${R - feather}px, rgba(28,28,30,0.72) ${R}px)`;
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
        style.setProperty("-webkit-mask-image", holes.join(", "));
        style.setProperty("mask-image", holes.join(", "));
        style.setProperty("-webkit-mask-composite", "source-in");
        style.setProperty("mask-composite", "intersect");
      } else {
        style.removeProperty("-webkit-mask-image");
        style.removeProperty("mask-image");
      }
    };

    updateGreyMask();
    map.on("moveend", updateGreyMask);
    map.on("zoomend", updateGreyMask);

    return () => {
      map.remove();
    };
  }, [saved, focus.lat, focus.lng, filteredSpots, unlocks, next.length]);

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
