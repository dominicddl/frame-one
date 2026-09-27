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
const REVEAL_RADIUS = 180;

const CLAPPER =
  '<svg width="26" height="26" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8.5" width="14" height="8.5" rx="1.5"/><path d="M3 8.5 4.6 4h12.2L17 8.5"/><path d="M7.4 4 6.6 8.5M11.4 4l-.8 4.5M15.2 4l-.8 4.5" stroke-width="1.4"/></svg>';

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
      const stamp = `<div class="stamp-pin"><span class="stamp-ripple"></span><span class="stamp-face">${CLAPPER}</span></div>`;
      new maplibregl.Marker({ element: markerEl(stamp) }).setLngLat([focus.lng, focus.lat]).addTo(map);
      saved.match.goNext.forEach((item, i) => {
        const pin = `<div class="next-pin" style="animation-delay: calc(var(--reveal) + ${600 + i * 90}ms)">?</div>`;
        new maplibregl.Marker({ element: markerEl(pin) }).setLngLat([item.lng, item.lat]).addTo(map);
      });
    }

    filteredSpots.forEach((spot) => {
      const isUnlocked = unlocks.includes(spot.spotId);
      const isSaved = saved && saved.match.spotId === spot.spotId;
      if (isSaved) return;

      const html = isUnlocked
        ? `<div class="stamp-pin unlocked-stamp"><span class="stamp-face">${CLAPPER}</span></div>`
        : `<div class="peek-pin">?</div>`;
      new maplibregl.Marker({ element: markerEl(html) }).setLngLat([spot.lng, spot.lat]).addTo(map);
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

    // Simple circle cutout for each unlocked spot (no soft gradient, just hard edge with slight feather)
    const buildHole = (x: number, y: number, z: number, isNew = false) => {
      const R = REVEAL_RADIUS * z;
      const feather = R * 0.15;
      if (isNew) {
        return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent calc(var(--reveal-r, ${R}px) - ${feather}px), rgba(128,128,128,0.6) var(--reveal-r, ${R}px))`;
      }
      return `radial-gradient(circle at ${x}px ${y}px, transparent 0%, transparent ${R - feather}px, rgba(128,128,128,0.6) ${R}px)`;
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
          const colorVar = key === "marvel" ? "--trail-marvel" : key === "romcom" ? "--trail-romcom" : key === "dark" ? "--trail-monsters" : null;
          return (
            <button
              key={key}
              type="button"
              className={`trail-chip${isActive ? " active" : ""}`}
              style={colorVar ? ({ "--trail-color": `var(${colorVar})` } as CSSProperties) : undefined}
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
                    <div key={item.spotId} className="go-next-item">
                      <span className="go-next-q">?</span>
                      <span className="go-next-text">
                        <span className="go-next-film">{film}</span>
                        {area && <span className="go-next-area">{area}</span>}
                      </span>
                    </div>
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
