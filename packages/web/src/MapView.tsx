import { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

// /api/spots also returns year + stillUrl (SpotSummary type just doesn't declare them)
type MapSpot = SpotSummary & { year?: number; stillUrl?: string };

/**
 * Pre-collected demo stamps + "your photo" per spot: public/collected/manifest.json.
 * Every entry counts as collected. isNewSpot entries aren't in the catalog, so they become client-side pins.
 * To swap photos, edit that manifest (popup shows composite ?? userPhoto).
 */
interface CollectedEntry {
  spotId: string;
  isNewSpot: boolean;
  filmTitle: string;
  year: number;
  placeName: string;
  lat: number;
  lng: number;
  userPhoto: string;
  still: string;
  composite: string | null;
  trail: string;
  trailOrder?: number;
}

const ZOOM = 12.5;
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
// Mist: light warm grey over the whole map; each collected spot dissolves a soft hole.
// Drawn on a 2D canvas with destination-out (reliable on iOS Safari, unlike CSS mask-composite).
const MIST = "rgba(236, 231, 223, 0.82)";
const REVEAL_RADIUS = 70; // px at ZOOM; scales with zoom so the hole covers the same ground
const REVEAL_DELAY = 3000; // matches .unlocking --reveal (unlock-stage plays first)
const SLAM_DELAY = 250; // no unlock-stage: slam almost straight away
const SLAM_MS = 600;
const MIDTOWN: [number, number] = [-73.981, 40.758];
const ALL_ZOOM = 13.2;
const GUIDE_KEY = "frame_one_guide_seen";
// Completed Marvel trail: manifest trailOrder wins; this is the fallback order
const MARVEL_TRAIL = ["tasm2-red-steps", "cap-america-times-square", "spider-man-nypl", "avengers-park-avenue-viaduct"];
const GUIDE = [
  { target: ".map-marker.is-unlocked", text: "Lit stamps = scenes you've recreated. Tap one to see your shot." },
  { target: ".map-marker.is-locked:not(.is-hidden)", text: "? = a film scene nearby you haven't found yet. Tap for a hint and directions." },
  { target: ".trail-filters", text: "Mist clears as you explore. Trails link scenes from the same world. Pick one up top." },
];
const JUST_STAMPED_KEY = "frame_one_just_stamped"; // sessionStorage spotId set by "Stamp & save"
const REVEAL_MS = 1200;
const LOCKED_MIN_ZOOM = 11.5; // hide locked peeks when zoomed out further
const STAMP_GAP = 30; // min px between stamp centres before nudging apart
const PEEK_GAP = 22; // min px between a peek and anything already shown

// Catalog of spotIds with design package stamps
const STAMP_SPOTS = [
  "tasm2-red-steps",
  "home-alone-radio-city",
  "joker-bronx-stairs",
  "cap-america-times-square",
  "friends-benefits-central-park-mall",
];

function getStampHtml(spotId: string): string {
  if (STAMP_SPOTS.includes(spotId)) return `<img src="/stamps/${spotId}.svg" alt="" draggable="false" />`;
  // Fallback clapper icon with #e87a2a ring
  return '<svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="translate(28,28)"><rect x="6" y="24" width="44" height="26" rx="4"/><path d="M6 24 9 12h38l3 12"/><path d="M18 12 16 24M30 12l-2 12M42 12l-2 12"/></g></svg>';
}

const HANDOFF = {
  land: "#E3DACB",
  water: "#A9C6D6",
  park: "#BFD5C3",
  building: "#D8CDB9",
  street: "#F6F1E8",
  casing: "#D6CBB8",
  labelLand: "#6B6457",
  labelWater: "#3D5F73",
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
    else if (type === "line" && /highway|road|tunnel|bridge/.test(id)) map.setPaintProperty(id, "line-color", HANDOFF.street);
    else if (type === "line" && id.startsWith("boundary")) map.setLayoutProperty(id, "visibility", "none");
    else if (type === "symbol") {
      // Quiet chrome: drop POI / transit / shield clutter, keep place + street + water names
      if (/poi|transit|shield|aeroway|housenumber/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
        continue;
      }
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
  const fogRef = useRef<HTMLCanvasElement | null>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const revealAt = useRef(0);
  const [catalog, setCatalog] = useState<MapSpot[]>([]);
  const [collected, setCollected] = useState<CollectedEntry[]>([]);
  const [trailFilter, setTrailFilter] = useState<TrailFilterId>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [popupEl] = useState(() => document.createElement("div"));
  const [justStamped] = useState(() => {
    try {
      return sessionStorage.getItem(JUST_STAMPED_KEY);
    } catch {
      return null;
    }
  });
  const slamPlayed = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [showThen, setShowThen] = useState(false);
  const [guideStep, setGuideStep] = useState(-1);
  const focus = saved ? { lat: saved.match.lat, lng: saved.match.lng } : home;
  const savedId = saved?.match.spotId;
  // Spot whose character stamp slams onto the map this visit (capture signal, or the in-app unlock flow)
  const slamId = justStamped ?? (unlocking ? savedId : undefined) ?? null;
  const slamDelay = unlocking ? REVEAL_DELAY : SLAM_DELAY;
  const spots = useMemo<MapSpot[]>(
    () => [
      ...catalog,
      ...collected
        .filter((c) => c.isNewSpot && !catalog.some((s) => s.spotId === c.spotId))
        .map((c) => ({ spotId: c.spotId, filmTitle: c.filmTitle, year: c.year, lat: c.lat, lng: c.lng, neighbourhood: c.placeName, stillUrl: c.still })),
    ],
    [catalog, collected],
  );
  const trailIds = useMemo(() => {
    const base: string[] | null = TRAIL_FILTERS[trailFilter].spotIds;
    return base && [...base, ...collected.filter((c) => c.trail === trailFilter).map((c) => c.spotId)];
  }, [trailFilter, collected]);

  const marvelIds = useMemo(() => {
    const ordered = collected
      .filter((c) => c.trail === "superhero" && typeof c.trailOrder === "number")
      .sort((a, b) => a.trailOrder! - b.trailOrder!)
      .map((c) => c.spotId);
    return ordered.length > 1 ? ordered : MARVEL_TRAIL;
  }, [collected]);

  // useUnlocks hands back a fresh array every render — key on content so effects don't thrash
  const unlockKey = [...unlocks, ...collected.map((c) => c.spotId), savedId ?? "", slamId ?? ""].join(",");
  const unlocked = useMemo(() => new Set(unlockKey.split(",").filter(Boolean)), [unlockKey]);

  useEffect(() => {
    getSpots()
      .then((s) => setCatalog(s as MapSpot[]))
      .catch(console.error);
    fetch("/collected/manifest.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((m: CollectedEntry[]) => setCollected(Array.isArray(m) ? m : []))
      .catch(() => {});
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

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

    // Fog canvas lives inside the canvas container: above the basemap, below markers (appended later)
    const fog = document.createElement("canvas");
    fog.className = "map-fog";
    map.getCanvasContainer().appendChild(fog);
    fogRef.current = fog;
    map.on("move", schedule);
    map.on("resize", schedule);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      mapInstanceRef.current = null;
      fogRef.current = null;
      map.remove();
    };
  }, []);

  // Play the slam once, then drop the signal so a reload doesn't replay it
  useEffect(() => {
    if (!slamId) return;
    revealAt.current = performance.now() + slamDelay;
    try {
      sessionStorage.removeItem(JUST_STAMPED_KEY);
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => (slamPlayed.current = true), slamDelay + SLAM_MS);
    return () => clearTimeout(t);
  }, [slamId, slamDelay]);

  // Fog + trail line drawing
  useEffect(() => {
    const holes = spots.filter((s) => unlocked.has(s.spotId)).map((s) => ({ id: s.spotId, lng: s.lng, lat: s.lat }));
    if (saved && !holes.some((h) => h.id === savedId)) holes.push({ id: saved.match.spotId, lng: saved.match.lng, lat: saved.match.lat });
    const byId = new Map(spots.map((s) => [s.spotId, s]));
    // ponytail: walk order = south→north; good enough for Manhattan-shaped trails
    const marvel = marvelIds.map((id) => byId.get(id)).filter((s): s is MapSpot => !!s);
    const marvelOn = trailFilter === "all" || trailFilter === "superhero";
    const line = [...new Set(trailFilter === "superhero" ? [] : trailIds ?? [])]
      .map((id) => byId.get(id))
      .filter((s): s is MapSpot => !!s)
      .sort((a, b) => a.lat - b.lat);

    drawRef.current = () => {
      const map = mapInstanceRef.current;
      const canvas = fogRef.current;
      if (!map || !canvas) return;
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = MIST;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "destination-out";
      const R = REVEAL_RADIUS * 2 ** (map.getZoom() - ZOOM);
      let animating = false;
      for (const p of holes) {
        let r = R;
        if (p.id === slamId && revealAt.current) {
          const t = (performance.now() - revealAt.current) / REVEAL_MS;
          if (t < 1) {
            animating = true;
            r = t <= 0 ? 0 : R * (1 - (1 - t) ** 3);
          }
        }
        if (r < 1) continue;
        const { x, y } = map.project([p.lng, p.lat]);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.4, "rgba(0,0,0,0.9)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      ctx.globalCompositeOperation = "source-over";
      const trace = (pts: MapSpot[]) => {
        ctx.beginPath();
        pts.forEach((s, i) => {
          const { x, y } = map.project([s.lng, s.lat]);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
      };
      if (marvel.length > 1) {
        // Glowing completed Marvel trail: blurred wide glow + bright core
        const hi = trailFilter === "superhero";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = marvelOn ? 1 : 0.3;
        trace(marvel);
        ctx.shadowColor = "rgba(226, 70, 30, 0.9)";
        ctx.shadowBlur = hi ? 18 : 12;
        ctx.strokeStyle = "rgba(232, 96, 42, 0.55)";
        ctx.lineWidth = hi ? 10 : 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffd7a8";
        ctx.lineWidth = hi ? 3 : 2.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (line.length > 1) {
        ctx.setLineDash([6, 7]);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(232, 122, 42, 0.9)";
        ctx.beginPath();
        line.forEach((s, i) => {
          const { x, y } = map.project([s.lng, s.lat]);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (animating) schedule();
    };
    schedule();
  }, [spots, unlocked, saved, slamId, trailIds, trailFilter, marvelIds, schedule]);

  // Markers: small muted peeks for locked spots, lit stamps for collected ones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const markers = markersRef.current;
    markers.forEach((m) => m.remove());
    markers.clear();

    for (const s of spots) {
      const isUnlocked = unlocked.has(s.spotId);
      const isSlam = s.spotId === slamId && !slamPlayed.current;
      const el = document.createElement("div");
      el.className = `map-marker ${isUnlocked ? "is-unlocked" : "is-locked"}${
        trailIds && !trailIds.includes(s.spotId) ? " off-trail" : ""
      }${isSlam ? " is-slam" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", isUnlocked ? `${s.filmTitle}, collected` : `Uncollected film spot, ${s.neighbourhood}`);
      el.tabIndex = 0;
      el.innerHTML = isUnlocked
        ? `<div class="stamp-pin">${isSlam ? '<span class="stamp-ripple"></span>' : ""}<span class="stamp-face">${getStampHtml(s.spotId)}</span></div>`
        : `<div class="peek-pin">?</div>`;
      el.style.zIndex = isUnlocked ? "2" : "1";
      const pick = (e: Event) => {
        e.stopPropagation(); // keep the map click from closing the popup we're opening
        setSelected(s.spotId);
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e) => e.key === "Enter" && pick(e));
      markers.set(s.spotId, new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
    }

    // ponytail: greedy O(n²) declutter — fine for a ~dozen spots; cluster source if the catalog grows
    const declutter = () => {
      const zoom = map.getZoom();
      const kept: { x: number; y: number }[] = [];
      const entries = [...markers.entries()].sort((a, b) => Number(unlocked.has(b[0])) - Number(unlocked.has(a[0])));
      for (const [id, m] of entries) {
        const p = map.project(m.getLngLat());
        if (!unlocked.has(id)) {
          const hide = zoom < LOCKED_MIN_ZOOM || kept.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < PEEK_GAP);
          m.getElement().classList.toggle("is-hidden", hide);
          if (!hide) kept.push(p);
          continue;
        }
        let dx = 0;
        let dy = 0;
        kept.forEach((k, i) => {
          const d = Math.hypot(k.x - p.x, k.y - p.y);
          if (d >= STAMP_GAP) return;
          const ang = d > 0.5 ? Math.atan2(p.y - k.y, p.x - k.x) : (i + 1) * 1.3;
          dx += Math.cos(ang) * (STAMP_GAP - d);
          dy += Math.sin(ang) * (STAMP_GAP - d);
        });
        m.setOffset([dx, dy]);
        kept.push({ x: p.x + dx, y: p.y + dy });
      }
    };
    map.on("zoomend", declutter);
    map.on("moveend", declutter);
    declutter();

    // "All": sit on the just-stamped spot, else Midtown (where the stamps live). Trail: fit the trail.
    const fit = trailIds ? spots.filter((s) => trailIds.includes(s.spotId)) : [];
    if (!trailIds) {
      const focusSpot = spots.find((s) => s.spotId === (slamId ?? savedId));
      map.easeTo({ center: focusSpot ? [focusSpot.lng, focusSpot.lat] : MIDTOWN, zoom: ALL_ZOOM, duration: 800 });
    } else if (fit.length) {
      const pts = fit;
      const bounds = new maplibregl.LngLatBounds();
      pts.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: { top: 130, right: 40, bottom: 110, left: 40 }, maxZoom: 14.5, duration: 800 });
    }

    return () => {
      map.off("zoomend", declutter);
      map.off("moveend", declutter);
    };
  }, [spots, unlocked, slamId, savedId, trailIds]);

  // Freshly stamped spot: open its card once the slam + reveal have played
  useEffect(() => {
    const id = slamId ?? savedId;
    if (!id) return;
    const t = setTimeout(() => setSelected(id), slamId ? slamDelay + REVEAL_MS : 400);
    return () => clearTimeout(t);
  }, [slamId, savedId, slamDelay]);

  // Coach overlay: once per device, after the slam if there is one
  useEffect(() => {
    try {
      if (localStorage.getItem(GUIDE_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => {
      setSelected(null);
      setGuideStep(0);
    }, slamId ? slamDelay + REVEAL_MS + 900 : 1500);
    return () => clearTimeout(t);
  }, [slamId, slamDelay]);

  const closeGuide = () => {
    setGuideStep(-1);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    if (slamId) setSelected(slamId);
  };

  useEffect(() => setShowThen(false), [selected]);

  // Popup anchored to the tapped stamp; tapping the map closes it
  useEffect(() => {
    const map = mapInstanceRef.current;
    const s = spots.find((x) => x.spotId === selected);
    if (!map || !s) return;
    const marker = markersRef.current.get(s.spotId);
    const mo = marker?.getOffset() ?? { x: 0, y: 0 };
    let cleaning = false;
    const popup = new maplibregl.Popup({
      anchor: "bottom",
      offset: [mo.x, mo.y - (unlocked.has(s.spotId) ? 18 : 14)],
      closeButton: false,
      maxWidth: "280px",
      className: "spot-popup",
      focusAfterOpen: false,
    })
      .setLngLat([s.lng, s.lat])
      .setDOMContent(popupEl)
      .addTo(map);
    popup.on("close", () => {
      if (!cleaning) setSelected(null);
    });
    map.easeTo({ center: [s.lng, s.lat], offset: [0, 90], duration: 500 });
    return () => {
      cleaning = true;
      popup.remove();
    };
  }, [selected, spots, unlocked, popupEl]);

  const sel = spots.find((s) => s.spotId === selected);
  const selUnlocked = !!sel && unlocked.has(sel.spotId);
  const selIsSaved = !!sel && sel.spotId === savedId;
  const selEntry = sel && collected.find((c) => c.spotId === sel.spotId);
  const selPhoto = selIsSaved ? saved?.photo : selEntry ? selEntry.composite ?? selEntry.userPhoto : null;
  const selStill = selEntry?.still ?? sel?.stillUrl ?? (selIsSaved ? saved?.match.stillUrl : undefined);
  // Then/Now: tap a recreate photo to flip to the film still (composites already contain both)
  const canFlip = !!selPhoto && !!selStill && !selEntry?.composite;
  const selThumb = (canFlip && showThen ? selStill : selPhoto) || selStill;

  let guideRect: DOMRect | undefined;
  if (guideStep >= 0) {
    const vh = window.innerHeight;
    guideRect = [...(rootRef.current?.querySelectorAll(GUIDE[guideStep].target) ?? [])]
      .map((el) => el.getBoundingClientRect())
      .find((r) => r.top > 100 && r.bottom < vh - 220);
  }
  const nextSpot = useMemo(() => {
    if (!sel) return null;
    const pool = spots.filter((s) => !unlocked.has(s.spotId) && s.spotId !== sel.spotId);
    const onTrail = trailIds ? pool.filter((s) => trailIds.includes(s.spotId)) : [];
    const cands = onTrail.length ? onTrail : pool;
    const d = (s: MapSpot) => (s.lat - sel.lat) ** 2 + ((s.lng - sel.lng) * 0.76) ** 2; // 0.76 ≈ cos(NYC lat)
    return cands.reduce<MapSpot | null>((best, s) => (!best || d(s) < d(best) ? s : best), null);
  }, [sel, spots, unlocked, trailIds]);

  const stampCount = unlocked.size;

  return (
    <div
      ref={rootRef}
      className={`screen map-screen${unlocking ? " unlocking" : ""}${slamId ? " slamming" : ""}`}
      style={{ "--slam-delay": `${slamDelay}ms` } as CSSProperties}
    >
      <div ref={mapRef} className="map-canvas" />

      <div className="map-top">
        <div className="map-header">
          <span className="map-title">New York</span>
          <span className="map-count">{stampCount > 0 ? `${stampCount} stamp${stampCount !== 1 ? "s" : ""}` : "No stamps yet"}</span>
        </div>
        <div className="trail-filters">
          {(Object.keys(TRAIL_FILTERS) as TrailFilterId[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`trail-chip${trailFilter === key ? " active" : ""}`}
              aria-pressed={trailFilter === key}
              onClick={() => setTrailFilter(key)}
            >
              {TRAIL_FILTERS[key].label}
            </button>
          ))}
        </div>
      </div>

      {(trailFilter === "all" || trailFilter === "superhero") && <div className="marvel-tag">Marvel trail · completed ✓</div>}

      {guideStep >= 0 && (
        <div className="guide" onClick={closeGuide}>
          {guideRect && (
            <span
              className="guide-ring"
              style={{ left: guideRect.left - 8, top: guideRect.top - 8, width: guideRect.width + 16, height: guideRect.height + 16 }}
            />
          )}
          <div className="guide-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How the map works">
            <div className="guide-step">
              {guideStep + 1} / {GUIDE.length}
            </div>
            <p className="guide-text">{GUIDE[guideStep].text}</p>
            <div className="guide-actions">
              <button type="button" className="guide-skip" onClick={closeGuide}>
                Skip
              </button>
              <button
                type="button"
                className="guide-next"
                onClick={() => (guideStep + 1 < GUIDE.length ? setGuideStep(guideStep + 1) : closeGuide())}
              >
                {guideStep + 1 < GUIDE.length ? "Next" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap · OpenFreeMap
      </a>

      {stampCount === 0 && !unlocking && (
        <button type="button" className="map-hint" onClick={onShoot}>
          Shoot a film spot to clear the mist
        </button>
      )}

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

      {sel &&
        createPortal(
          <div className="spot-card">
            <div className="spot-card-row">
              {selThumb &&
                (canFlip ? (
                  <button type="button" className="spot-card-flip" onClick={() => setShowThen((v) => !v)} aria-label="Switch then and now">
                    <img className="spot-card-thumb" src={selThumb} alt="" />
                    <span className="spot-card-flip-tag">{showThen ? "Then" : "Now"}</span>
                  </button>
                ) : (
                  <img className={`spot-card-thumb${selUnlocked ? "" : " is-locked"}`} src={selThumb} alt="" />
                ))}
              <div className="spot-card-info">
                <div className="spot-card-film">{sel.filmTitle}</div>
                <div className="spot-card-meta">
                  {sel.year ? `${sel.year} · ` : ""}
                  {selIsSaved && saved ? saved.placeName : selEntry?.placeName ?? sel.neighbourhood}
                </div>
                <div className={`spot-card-status${selUnlocked ? " is-collected" : ""}`}>
                  {selUnlocked ? "Collected" : "Scene nearby · not found yet"}
                </div>
              </div>
            </div>
            {selUnlocked && nextSpot ? (
              <button type="button" className="spot-card-go" onClick={() => openDirections(nextSpot.lat, nextSpot.lng)}>
                <span>Go next</span>
                <span className="spot-card-go-sub">
                  {nextSpot.filmTitle} · {nextSpot.neighbourhood}
                </span>
              </button>
            ) : (
              <button type="button" className="spot-card-go" onClick={() => openDirections(sel.lat, sel.lng)}>
                <span>Go here</span>
              </button>
            )}
            {selEntry && !selIsSaved && <div className="spot-card-credit">Photos: filminglocations via Imgur</div>}
          </div>,
          popupEl,
        )}

      {dock}
    </div>
  );
}
