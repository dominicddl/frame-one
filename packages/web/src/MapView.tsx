import type { ReactNode } from "react";
import type { MatchResponse } from "@frame-one/shared";

export interface SavedStamp {
  match: MatchResponse;
  photo: string | null;
  placeName: string;
}

interface MapViewProps {
  saved: SavedStamp | null;
  unlocking: boolean;
  onShoot: () => void;
  dock: ReactNode;
}

const ZOOM = 3.4;
const HOLE_RADIUS = 42;
const CENTER = { x: 195, y: 300 };
const TIMES_SQUARE = { lat: 40.758, lng: -73.9855, x: 174, y: 334 };

// Affine fit of the handoff map's hand-placed pins to their real coordinates.
function project(lat: number, lng: number) {
  const dLat = lat - TIMES_SQUARE.lat;
  const dLng = lng - TIMES_SQUARE.lng;
  return {
    x: TIMES_SQUARE.x - 577.7 * dLat + 1988.4 * dLng,
    y: TIMES_SQUARE.y - 3219.7 * dLat - 941.8 * dLng,
  };
}

const MANHATTAN =
  "M214 118 L196 126 L180 190 L168 258 L156 326 L146 394 L138 462 L142 516 L158 548 L174 540 L184 492 L194 420 L204 348 L216 276 L228 204 L234 146 Z";

const LAND = [
  "M0 0 L92 0 L84 96 L98 176 L86 256 L100 330 L82 402 L92 470 L64 530 L72 596 L38 660 L46 726 L0 790 Z",
  "M230 0 L336 0 L344 58 L332 110 L302 132 L268 116 L238 84 L226 44 Z",
  "M288 168 L390 152 L390 690 L322 718 L262 690 L214 638 L196 580 L212 520 L230 452 L246 384 L258 300 L270 226 Z",
  MANHATTAN,
  "M60 636 L128 616 L166 664 L160 744 L108 784 L52 752 L34 686 Z",
  "M242 342 L248 356 L246 430 L240 442 L236 428 L238 356 Z",
];

const BRIDGES = [
  "M196 152 L98 168",
  "M178 372 L258 356",
  "M166 440 L236 452",
  "M158 484 L214 506",
  "M154 502 L206 528",
  "M166 700 L228 672",
  "M322 124 L344 168",
];

const AVENUES = [-21, -14, -7, 0, 7, 14, 21];
const STREETS = Array.from({ length: 46 }, (_, i) => 170 + i * 8);

const RAYS = [
  "M53.8 24 L65.3 24",
  "M45 45 L53.2 53.2",
  "M24 53.8 L24 65.3",
  "M3 45 L-5.2 53.2",
  "M-5.8 24 L-17.3 24",
  "M3 3 L-5.2 -5.2",
  "M24 -5.8 L24 -17.3",
  "M45 3 L53.2 -5.2",
];

function rnd(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const BLOBS = Array.from({ length: 90 }, (_, i) => ({
  cx: rnd(i + 1) * 390,
  cy: rnd(i + 5001) * 844,
  r: 26 + rnd(i + 9001) * 48,
}));

function StampPin() {
  return (
    <g transform="rotate(-4)">
      <g transform="translate(-24 -24)">
        <g className="stamp-rays">
          {RAYS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      <rect x="-24" y="-24" width="48" height="48" rx="5" className="pin-paper stamp-glow" />
      <rect x="-19.5" y="-19.5" width="39" height="39" rx="2" className="stamp-ink" />
      <g transform="translate(-14 -14) scale(1.4)" className="stamp-icon">
        <rect x="3" y="8.5" width="14" height="8.5" rx="1.5" />
        <path d="M3 8.5 4.6 4h12.2L17 8.5" />
        <path d="M7.4 4 6.6 8.5M11.4 4l-.8 4.5M15.2 4l-.8 4.5" />
      </g>
    </g>
  );
}

function NextPin({ fogged }: { fogged: boolean }) {
  return (
    <g transform="rotate(-5)" className={fogged ? "pin-fogged" : "pin-next"}>
      <rect x="-18" y="-18" width="36" height="36" rx="5" className="pin-paper" />
      <rect x="-12.5" y="-12.5" width="25" height="25" rx="2" className="pin-inner" />
      <text y="6.5" textAnchor="middle" className="pin-q">
        ?
      </text>
    </g>
  );
}

function StampBadge() {
  return (
    <svg width="168" height="168" viewBox="0 0 188 188" fill="none" aria-hidden="true">
      <circle cx="94" cy="94" r="92" fill="#1C4C6B" />
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
      <circle cx="94" cy="94" r="44" fill="#123A52" />
      <circle cx="94" cy="94" r="35" stroke="#FFFFFF" strokeOpacity="0.3" strokeDasharray="3 4" />
    </svg>
  );
}

export default function MapView({ saved, unlocking, onShoot, dock }: MapViewProps) {
  const spot = saved ? project(saved.match.lat, saved.match.lng) : TIMES_SQUARE;
  const tx = CENTER.x - spot.x * ZOOM;
  const ty = CENTER.y - spot.y * ZOOM;
  const next = saved?.match.goNext ?? [];

  return (
    <div className={`screen map-screen${unlocking ? " unlocking" : ""}`}>
      <svg className="map-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of New York">
        <defs>
          <clipPath id="clip-manhattan">
            <path d={MANHATTAN} />
          </clipPath>
          <clipPath id="clip-land">
            <path d={LAND.join(" ")} />
          </clipPath>
          <radialGradient id="hole-gradient">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.62" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </radialGradient>
          <radialGradient id="blob-light">
            <stop offset="0" stopColor="#F2F7FA" stopOpacity="0.55" />
            <stop offset="1" stopColor="#F2F7FA" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="blob-shade">
            <stop offset="0" stopColor="#DFEAF1" stopOpacity="0.35" />
            <stop offset="1" stopColor="#DFEAF1" stopOpacity="0" />
          </radialGradient>
          <mask id="fog-mask" maskUnits="userSpaceOnUse" x="-50" y="-50" width="490" height="944">
            <rect x="-50" y="-50" width="490" height="944" fill="#fff" />
            {saved && <circle className="fog-hole" cx={spot.x} cy={spot.y} r={HOLE_RADIUS} fill="url(#hole-gradient)" />}
          </mask>
        </defs>

        <g className="map-base" transform={`translate(${tx} ${ty}) scale(${ZOOM})`}>
          <rect className="map-water" x="-50" y="-50" width="490" height="944" />
          <g className="map-land">
            {LAND.map((d) => (
              <path key={d} d={d} />
            ))}
            <ellipse cx="176" cy="574" rx="9" ry="6" />
          </g>
          <g className="map-park">
            <rect x="186" y="196" width="26" height="94" rx="3" transform="rotate(-11 199 243)" />
            <path d="M296 196 L332 188 L346 232 L316 246 Z" />
            <path d="M254 626 L292 616 L302 650 L264 662 Z" />
          </g>
          <g className="map-streets" clipPath="url(#clip-manhattan)">
            {STREETS.map((y) => (
              <path key={y} d={`M120 ${y} L260 ${y - 22}`} />
            ))}
          </g>
          <g className="map-avenues" clipPath="url(#clip-manhattan)">
            {AVENUES.map((dx) => (
              <path key={dx} d={`M${226 + dx} 120 L${150 + dx} 552`} />
            ))}
          </g>
          <g className="map-bridges">
            {BRIDGES.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g className="map-label-water">
            <text x="121" y="296">HUDSON</text>
            <text x="122" y="300.5">RIVER</text>
            <text x="211" y="290">EAST</text>
            <text x="211" y="294.5">RIVER</text>
          </g>
          <text className="map-label-land" transform="translate(160 372) rotate(-81.5)">
            MANHATTAN
          </text>

          <g className="map-fog" clipPath="url(#clip-land)" mask="url(#fog-mask)">
            <rect className="fog-base" x="0" y="0" width="390" height="844" />
            <g className="wisp-a">
              {BLOBS.filter((_, i) => i % 2 === 0).map((b, i) => (
                <circle key={i} {...b} fill={i % 3 ? "url(#blob-light)" : "url(#blob-shade)"} />
              ))}
            </g>
            <g className="wisp-b">
              {BLOBS.filter((_, i) => i % 2 === 1).map((b, i) => (
                <circle key={i} {...b} fill={i % 3 ? "url(#blob-light)" : "url(#blob-shade)"} />
              ))}
            </g>
          </g>
        </g>

        {next.map((item, i) => {
          const p = project(item.lat, item.lng);
          const fogged = Math.hypot(p.x - spot.x, p.y - spot.y) > HOLE_RADIUS * 0.92;
          return (
            <g key={item.spotId} transform={`translate(${p.x * ZOOM + tx} ${p.y * ZOOM + ty})`}>
              <g className="pin-pop" style={{ animationDelay: `calc(var(--beat) + ${1000 + i * 90}ms)` }}>
                <NextPin fogged={fogged} />
              </g>
            </g>
          );
        })}

        {saved && (
          <g transform={`translate(${CENTER.x} ${CENTER.y})`}>
            {unlocking && <circle className="stamp-ripple" r="24" />}
            <g className="stamp-drop">
              <StampPin />
            </g>
          </g>
        )}
      </svg>

      <div className="map-header">
        <span className="map-title">New York</span>
        <span className="map-count">{saved ? "1 stamp" : "No stamps yet"}</span>
      </div>

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
            <div className="sheet-chips">
              <span>Stamp 1</span>
              <span>Fog cleared</span>
              {next.length > 0 && <span>{next.length} scenes nearby</span>}
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
        ) : (
          <div className="sheet-empty">
            <div className="sheet-title">Nothing stamped yet</div>
            <p className="sheet-meta">Shoot a place you've seen in a film to lift the fog.</p>
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
