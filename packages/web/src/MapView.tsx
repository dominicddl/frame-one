import { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEMO_UNLOCKS, hasSeededDemo, type MatchResponse } from "@frame-one/shared";
import { getSpots, type SpotSummary } from "./api/client";
import { useUnlocks } from "./hooks/useUnlocks";
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
const MIST_RGB = "236, 231, 223";
const MIST_A = 0.82; // final (revealed) mist
const MIST_DENSE = 0.96; // before the first stamp: fully clouded
const REVEAL_RADIUS = 70; // px at ZOOM; scales with zoom so the hole covers the same ground
const REVEAL_DELAY = 3000; // matches .unlocking --reveal (unlock-stage plays first)
const SLAM_DELAY = 250; // no unlock-stage: slam almost straight away
const SLAM_MS = 600;
const IMPACT_MS = 370; // stamp-slam keyframe 62%: the moment it hits the map
const BURST_MS = 1800; // mist wave clearing outward from the impact
const BURST_SCALE = 3.4; // burst hole radius vs a normal stamp hole
const POP_STAGGER = 110; // reveal: stamps pop in one after another
const POP_MS = 700;
const LINE_MS = 1200; // trail line draw-in
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
const LOCKED_MIN_ZOOM = 11.5; // hide locked peeks when zoomed out further
const STAMP_PX = 36; // collected clapper
const PEEK_PX = 24; // "?" marker
const CLAPPER =
  '<svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="translate(28,28)"><rect x="6" y="24" width="44" height="26" rx="4"/><path d="M6 24 9 12h38l3 12"/><path d="M18 12 16 24M30 12l-2 12M42 12l-2 12"/></g></svg>';
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

// ponytail: nearest-neighbour walk from a fixed/southernmost start — fine for a handful of stops
function walkOrder(pts: MapSpot[], fixed: MapSpot[]): MapSpot[] {
  const order = fixed.length ? [...fixed] : pts.length ? [pts.reduce((a, b) => (b.lat < a.lat ? b : a))] : [];
  const rest = pts.filter((p) => !order.includes(p));
  const d = (a: MapSpot, b: MapSpot) => (a.lat - b.lat) ** 2 + ((a.lng - b.lng) * 0.76) ** 2;
  while (rest.length) {
    const last = order[order.length - 1];
    const i = rest.reduce((bi, p, j) => (d(last, p) < d(last, rest[bi]) ? j : bi), 0);
    order.push(...rest.splice(i, 1));
  }
  return order;
}

// Catalog of spotIds with design package stamps
const STAMP_SPOTS = [
  "tasm2-red-steps",
  "home-alone-radio-city",
  "joker-bronx-stairs",
  "cap-america-times-square",
  "friends-benefits-central-park-mall",
];

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

function StampBadge({ spotId }: { spotId: string }) {
  if (STAMP_SPOTS.includes(spotId)) return <img className="badge-art" src={`/stamps/${spotId}.svg`} alt="" width="200" height="200" draggable={false} />;
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
  const slamStart = useRef(0); // when the slam keyframes start (set when its marker is first created)
  const revealT = useRef(0); // when the post-tutorial reveal started
  const popDelay = useRef(new Map<string, number>()); // reveal: per-stamp pop-in delay
  const lineT0 = useRef(0); // trail line draw-in start
  const shownRef = useRef(new Set<string>()); // stamps already popped in (don't re-pop on marker rebuild)
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { seedDemo } = useUnlocks();
  // Demo stamps + manifest appear only after the first stamp's tutorial (or ?demo=1). Persisted in localStorage.
  const revealed = hasSeededDemo();
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
  // Selected trail in walking order (manifest trailOrder first, then nearest-neighbour); null = All
  const trailIds = useMemo(() => {
    const base: string[] | null = TRAIL_FILTERS[trailFilter].spotIds;
    if (!base) return null;
    const ids = new Set([...base, ...collected.filter((c) => c.trail === trailFilter).map((c) => c.spotId)]);
    const pts = spots.filter((s) => ids.has(s.spotId));
    const fixed = collected
      .filter((c) => ids.has(c.spotId) && typeof c.trailOrder === "number")
      .sort((a, b) => a.trailOrder! - b.trailOrder!)
      .map((c) => pts.find((p) => p.spotId === c.spotId))
      .filter((s): s is MapSpot => !!s);
    return walkOrder(pts, fixed).map((s) => s.spotId);
  }, [trailFilter, collected, spots]);

  const marvelIds = useMemo(() => {
    const ordered = collected
      .filter((c) => c.trail === "superhero" && typeof c.trailOrder === "number")
      .sort((a, b) => a.trailOrder! - b.trailOrder!)
      .map((c) => c.spotId);
    return ordered.length > 1 ? ordered : MARVEL_TRAIL;
  }, [collected]);

  // useUnlocks hands back a fresh array every render — key on content so effects don't thrash
  const unlockKey = [...unlocks, ...(revealed ? collected.map((c) => c.spotId) : []), savedId ?? "", slamId ?? ""].join(",");
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
    try {
      sessionStorage.removeItem(JUST_STAMPED_KEY);
    } catch {
      /* ignore */
    }
  }, [slamId]);

  // Trail line draws in whenever the trail changes
  useEffect(() => {
    lineT0.current = performance.now();
    schedule();
  }, [trailFilter, schedule]);

  // Fog + trail line drawing
  useEffect(() => {
    const holes = spots.filter((s) => unlocked.has(s.spotId)).map((s) => ({ id: s.spotId, lng: s.lng, lat: s.lat }));
    if (saved && !holes.some((h) => h.id === savedId)) holes.push({ id: saved.match.spotId, lng: saved.match.lng, lat: saved.match.lat });
    const byId = new Map(spots.map((s) => [s.spotId, s]));
    const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((s): s is MapSpot => !!s);
    // All: the completed Marvel line (once revealed). Trail: that trail's walking line (glowing for Superhero).
    const glow = trailFilter === "superhero" ? pick(trailIds ?? []) : trailFilter === "all" && revealed ? pick(marvelIds) : [];
    const dashed = trailFilter !== "all" && trailFilter !== "superhero" ? pick(trailIds ?? []) : [];

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
      const now = performance.now();
      let animating = false;
      const burstAt = slamStart.current ? slamStart.current + IMPACT_MS : 0;
      const tb = burstAt ? (now - burstAt) / BURST_MS : -1; // <0 before impact
      if (burstAt && tb < 1) animating = true;
      // Density: dense before the first stamp, the burst thins it, the reveal settles it to the normal mist
      let dense = 0;
      if (!revealed) dense = 1 - 0.6 * (tb > 0 ? easeOut(tb) : 0);
      else if (revealT.current) {
        const tr = (now - revealT.current) / 1000;
        dense = 0.4 * (1 - easeOut(tr));
        if (tr < 1) animating = true;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${MIST_RGB}, ${MIST_A + (MIST_DENSE - MIST_A) * dense})`;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "destination-out";
      const R = REVEAL_RADIUS * 2 ** (map.getZoom() - ZOOM);
      let burst: { x: number; y: number; r: number; t: number } | null = null;
      for (const p of holes) {
        let r = R;
        const { x, y } = map.project([p.lng, p.lat]);
        if (p.id === slamId && burstAt) {
          // Impact burst: a big soft-edged wave that clears a wide area around the new stamp
          r = BURST_SCALE * R * easeOut(tb);
          if (r < 1) continue;
          if (tb < 1) burst = { x, y, r, t: tb };
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(0.55, "rgba(0,0,0,0.92)");
          g.addColorStop(0.85, "rgba(0,0,0,0.4)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          continue;
        }
        const d = popDelay.current.get(p.id);
        if (d !== undefined && revealT.current) {
          const t = (now - revealT.current - d) / POP_MS;
          if (t < 1) animating = true;
          r = R * easeOut(t);
        }
        if (r < 1) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.4, "rgba(0,0,0,0.9)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      ctx.globalCompositeOperation = "source-over";
      if (burst) {
        // Cloud puffs pushed outward on the wave front + a fading shock ring
        const fade = 1 - burst.t;
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
          const pr = burst.r * (0.92 + (i % 4) * 0.05);
          const px = burst.x + Math.cos(a) * pr;
          const py = burst.y + Math.sin(a) * pr;
          const s = 26 + (i % 5) * 7;
          const g = ctx.createRadialGradient(px, py, 0, px, py, s);
          g.addColorStop(0, `rgba(250, 247, 242, ${0.9 * fade})`);
          g.addColorStop(1, "rgba(250, 247, 242, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(px - s, py - s, s * 2, s * 2);
        }
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.r * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * fade})`;
        ctx.lineWidth = 2 + 6 * fade;
        ctx.stroke();
      }

      // Line draw-in: trace only the first f of the path
      const f = easeOut((now - lineT0.current) / LINE_MS);
      if (f < 1) animating = true;
      const trace = (pts: MapSpot[]) => {
        const xy = pts.map((s) => map.project([s.lng, s.lat]));
        const segs = xy.slice(1).map((q, i) => Math.hypot(q.x - xy[i].x, q.y - xy[i].y));
        let left = f * segs.reduce((a, b) => a + b, 0);
        ctx.beginPath();
        ctx.moveTo(xy[0].x, xy[0].y);
        for (let i = 0; i < segs.length && left > 0; i++) {
          const k = Math.min(1, left / (segs[i] || 1));
          ctx.lineTo(xy[i].x + (xy[i + 1].x - xy[i].x) * k, xy[i].y + (xy[i + 1].y - xy[i].y) * k);
          left -= segs[i];
        }
      };
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (glow.length > 1) {
        const hi = trailFilter === "superhero";
        trace(glow);
        ctx.shadowColor = "rgba(226, 70, 30, 0.9)";
        ctx.shadowBlur = hi ? 18 : 12;
        ctx.strokeStyle = "rgba(232, 96, 42, 0.55)";
        ctx.lineWidth = hi ? 10 : 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffd7a8";
        ctx.lineWidth = hi ? 3 : 2.2;
        ctx.stroke();
      }
      if (dashed.length > 1) {
        ctx.setLineDash([6, 7]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(232, 122, 42, 0.9)";
        trace(dashed);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (animating) schedule();
    };
    schedule();
  }, [spots, unlocked, saved, slamId, trailIds, trailFilter, marvelIds, revealed, schedule]);

  // Markers: only two kinds — "?" for uncollected, clapper for collected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const markers = markersRef.current;
    markers.forEach((m) => m.remove());
    markers.clear();
    const now = performance.now();

    for (const s of spots) {
      const isUnlocked = unlocked.has(s.spotId);
      let isSlam = isUnlocked && s.spotId === slamId;
      if (isSlam && !slamStart.current) {
        slamStart.current = now + slamDelay;
        // Small shake on impact
        const shakeAt = slamDelay + IMPACT_MS;
        setTimeout(() => mapRef.current?.classList.add("is-shaking"), shakeAt);
        setTimeout(() => mapRef.current?.classList.remove("is-shaking"), shakeAt + 320);
      }
      isSlam = isSlam && now < slamStart.current + SLAM_MS + 800;
      const settled = isUnlocked && !isSlam && shownRef.current.has(s.spotId);
      const d = popDelay.current.get(s.spotId);
      const popStyle = !settled && d !== undefined && revealT.current ? ` style="animation-delay:${Math.max(0, revealT.current + d - now)}ms"` : "";
      const el = document.createElement("div");
      el.className = `map-marker ${isUnlocked ? "is-unlocked" : "is-locked"}${
        trailIds && !trailIds.includes(s.spotId) ? " off-trail" : ""
      }${isSlam ? " is-slam" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", isUnlocked ? `${s.filmTitle}, collected` : `Uncollected film spot, ${s.neighbourhood}`);
      el.tabIndex = 0;
      el.innerHTML = isUnlocked
        ? `<div class="stamp-pin${settled ? " is-settled" : ""}"${popStyle}>${isSlam ? '<span class="stamp-ripple"></span>' : ""}${
            STAMP_SPOTS.includes(s.spotId)
              ? `<span class="stamp-face has-art"><img src="/stamps/${s.spotId}.svg" alt="" draggable="false"></span>`
              : `<span class="stamp-face">${CLAPPER}</span>`
          }</div>`
        : `<div class="peek-pin">?</div>`;
      el.style.zIndex = isUnlocked ? "2" : "1";
      // Negative delay resumes a slam already in flight if markers get rebuilt mid-animation
      if (isSlam) el.style.setProperty("--slam-delay", `${slamStart.current - now}ms`);
      if (isUnlocked) shownRef.current.add(s.spotId);
      const pick = (e: Event) => {
        e.stopPropagation(); // keep the map click from closing the popup we're opening
        setSelected(s.spotId);
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e) => e.key === "Enter" && pick(e));
      markers.set(s.spotId, new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
    }

    // Trail start pointer
    startMarkerRef.current?.remove();
    startMarkerRef.current = null;
    const firstId = trailIds?.[0];
    const first = firstId ? markers.get(firstId) : undefined;
    if (first) {
      const el = document.createElement("div");
      el.className = "trail-start";
      el.innerHTML = "<span>Start</span>";
      el.style.zIndex = "4";
      startMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(first.getLngLat()).addTo(map);
    }

    // ponytail: greedy spiral declutter, O(n²) — fine for a few dozen spots; cluster source if the catalog grows
    const declutter = () => {
      const zoom = map.getZoom();
      const kept: { x: number; y: number; r: number }[] = [];
      const entries = [...markers.entries()]
        .filter(([id]) => !trailIds || trailIds.includes(id))
        .sort((a, b) => Number(unlocked.has(b[0])) - Number(unlocked.has(a[0])));
      for (const [id, m] of entries) {
        const on = unlocked.has(id);
        const hide = !on && zoom < LOCKED_MIN_ZOOM;
        m.getElement().classList.toggle("is-hidden", hide);
        if (hide) continue;
        const rad = (on ? STAMP_PX : PEEK_PX) / 2 + 3;
        const p = map.project(m.getLngLat());
        const free = (x: number, y: number) => kept.every((k) => Math.hypot(k.x - x, k.y - y) >= k.r + rad);
        let off: [number, number] = [0, 0];
        if (!free(p.x, p.y)) {
          search: for (let ring = 1; ring <= 4; ring++) {
            const n = 6 * ring;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const o: [number, number] = [Math.cos(a) * ring * rad * 2, Math.sin(a) * ring * rad * 2];
              if (free(p.x + o[0], p.y + o[1])) {
                off = o;
                break search;
              }
            }
          }
        }
        m.setOffset(off);
        kept.push({ x: p.x + off[0], y: p.y + off[1], r: rad });
      }
      if (first && startMarkerRef.current) {
        const o = first.getOffset();
        startMarkerRef.current.setOffset([o.x, o.y - ((firstId && unlocked.has(firstId) ? STAMP_PX : PEEK_PX) / 2 + 2)]);
      }
    };
    map.on("zoomend", declutter);
    map.on("moveend", declutter);
    declutter();
    schedule();

    return () => {
      map.off("zoomend", declutter);
      map.off("moveend", declutter);
    };
  }, [spots, unlocked, slamId, slamDelay, trailIds, schedule]);

  // Camera: trail → fit it; just revealed → fit every stamp; else the just-stamped spot or Midtown
  const spotsReady = spots.length > 0;
  const trailKey = trailIds?.join(",");
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !spotsReady) return;
    const fitTo = (pts: MapSpot[], maxZoom: number) => {
      const bounds = new maplibregl.LngLatBounds();
      pts.forEach((s) => bounds.extend([s.lng, s.lat]));
      map.fitBounds(bounds, { padding: { top: 150, right: 40, bottom: 110, left: 40 }, maxZoom, duration: 900 });
    };
    const fit = trailIds ? spots.filter((s) => trailIds.includes(s.spotId)) : [];
    if (fit.length) return fitTo(fit, 14.5);
    if (revealT.current) return fitTo(spots.filter((s) => unlocked.has(s.spotId)), 13.5);
    const focusSpot = spots.find((s) => s.spotId === (slamId ?? savedId));
    map.easeTo({ center: focusSpot ? [focusSpot.lng, focusSpot.lat] : MIDTOWN, zoom: ALL_ZOOM, duration: 800 });
  }, [trailKey, spotsReady, revealed]);

  // Tutorial: after the first stamp's slam+burst (and whenever it hasn't been seen); its end triggers the reveal
  const [guideDelay] = useState(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(GUIDE_KEY);
    } catch {
      /* ignore */
    }
    if (slamId) return !revealed || !seen ? slamDelay + IMPACT_MS + BURST_MS + 300 : -1;
    return revealed ? (seen ? -1 : 1500) : unlocks.length ? 1500 : -1;
  });

  // Freshly stamped spot: open its card once the slam + burst have played (unless the tutorial is coming)
  useEffect(() => {
    const id = slamId ?? savedId;
    if (!id || guideDelay >= 0) return;
    const t = setTimeout(() => setSelected(id), slamId ? slamDelay + IMPACT_MS + BURST_MS * 0.7 : 400);
    return () => clearTimeout(t);
  }, [slamId, savedId, slamDelay, guideDelay]);

  useEffect(() => {
    if (guideDelay < 0) return;
    const t = setTimeout(() => {
      setSelected(null);
      setGuideStep(0);
    }, guideDelay);
    return () => clearTimeout(t);
  }, [guideDelay]);

  // Everything shows up: seed demo/manifest stamps, pop them in outward from the new stamp, draw the Marvel line
  const reveal = () => {
    const origin = spots.find((s) => s.spotId === slamId) ?? { lat: MIDTOWN[1], lng: MIDTOWN[0] };
    const d = (id: string) => {
      const s = spots.find((x) => x.spotId === id);
      return s ? (s.lat - origin.lat) ** 2 + ((s.lng - origin.lng) * 0.76) ** 2 : 1;
    };
    const fresh = [...new Set([...collected.map((c) => c.spotId), ...DEMO_UNLOCKS])]
      .filter((id) => !unlocked.has(id))
      .sort((a, b) => d(a) - d(b));
    popDelay.current = new Map(fresh.map((id, i) => [id, 250 + i * POP_STAGGER]));
    revealT.current = performance.now();
    lineT0.current = revealT.current + 250 + fresh.length * POP_STAGGER;
    seedDemo();
    if (slamId) setTimeout(() => setSelected(slamId), lineT0.current - revealT.current + LINE_MS + 300);
  };

  const closeGuide = () => {
    setGuideStep(-1);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    if (!revealed) reveal();
    else if (slamId) setSelected(slamId);
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
      offset: [mo.x, mo.y - (unlocked.has(s.spotId) ? STAMP_PX : PEEK_PX) / 2 - 4],
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
  const selEntry = sel && revealed ? collected.find((c) => c.spotId === sel.spotId) : undefined;
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
              onClick={() => {
                setSelected(null);
                setTrailFilter(key);
              }}
            >
              {TRAIL_FILTERS[key].label}
            </button>
          ))}
        </div>
      </div>

      {trailFilter === "all"
        ? revealed && <div className="marvel-tag">Marvel trail · completed ✓</div>
        : trailIds &&
          trailIds.length > 0 && (
            <div className="marvel-tag trail-tag">
              <span>
                {TRAIL_FILTERS[trailFilter].label} trail · {trailIds.filter((id) => unlocked.has(id)).length}/{trailIds.length} found
              </span>
              <button type="button" className="trail-start-btn" onClick={() => setSelected(trailIds[0])}>
                Start trail
              </button>
            </div>
          )}

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
            <StampBadge spotId={saved.match.spotId} />
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
