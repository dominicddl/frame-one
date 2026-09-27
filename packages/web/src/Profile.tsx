import { useEffect, useState, type ReactNode } from "react";
import { TRAIL_FILTERS } from "./map/trails";

type ManifestEntry = { spotId: string; trail?: string };

// ponytail: hard-coded for the demo; mirrors the art in public/stamps/
const CHARACTER_BADGES = [
  { spotId: "tasm2-red-steps", name: "Spidey" },
  { spotId: "cap-america-times-square", name: "Cap" },
  { spotId: "home-alone-radio-city", name: "Kevin" },
  { spotId: "joker-bronx-stairs", name: "Joker" },
  { spotId: "friends-benefits-central-park-mall", name: "The Couple" },
];

const TRAILS = [
  { id: "superhero", label: "Marvel" },
  { id: "romance", label: "Romance" },
  { id: "comedy", label: "Comedy" },
  { id: "thriller", label: "Thriller" },
] as const;

function MarvelTrailBadge() {
  return (
    <svg viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" strokeWidth="5" />
      <circle cx="56" cy="56" r="50" fill="#c45a1a" />
      <circle cx="56" cy="56" r="40" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="3 4" />
      <path d="M56 26l8.8 17.8 19.7 2.9-14.3 13.9 3.4 19.6L56 71l-17.6 9.2 3.4-19.6-14.3-13.9 19.7-2.9z" fill="#fff" />
      <text x="56" y="98" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" letterSpacing="1.5" fontFamily="system-ui, sans-serif">
        MARVEL
      </text>
    </svg>
  );
}

export default function Profile({ unlocks, dock }: { unlocks: string[]; dock: ReactNode }) {
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);

  useEffect(() => {
    fetch("/collected/manifest.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((m) => Array.isArray(m) && setManifest(m))
      .catch(() => {});
  }, []);

  // Manifest spots count as collected once the user has any stamp.
  const collected = new Set([...unlocks, ...(unlocks.length > 0 ? manifest.map((m) => m.spotId) : [])]);

  const trails = TRAILS.map((t) => {
    const ids = new Set<string>([
      ...TRAIL_FILTERS[t.id].spotIds,
      ...manifest.filter((m) => m.trail === t.id).map((m) => m.spotId),
    ]);
    const done = [...ids].filter((id) => collected.has(id)).length;
    return { ...t, done, total: ids.size, complete: ids.size > 0 && done === ids.size };
  });

  const marvelDone = trails[0].complete;
  const badges = [
    ...CHARACTER_BADGES.map((b) => ({ key: b.spotId, name: b.name, won: collected.has(b.spotId), art: <img src={`/stamps/${b.spotId}.svg`} alt="" /> })),
    { key: "marvel-trail", name: "Marvel trail", won: marvelDone, art: <MarvelTrailBadge /> },
  ];
  const badgesWon = badges.filter((b) => b.won).length;

  return (
    <div className="screen profile">
      <header className="profile-head">
        <div className="profile-avatar" aria-hidden="true">
          VP
        </div>
        <div>
          <h1 className="profile-name">Vansh</h1>
          <p className="profile-meta">
            New York · {collected.size} stamp{collected.size === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <dl className="profile-stats">
        <div>
          <dd>{collected.size}</dd>
          <dt>Stamps collected</dt>
        </div>
        <div>
          <dd>{trails.filter((t) => t.complete).length}</dd>
          <dt>Trails completed</dt>
        </div>
        <div>
          <dd>{badgesWon}</dd>
          <dt>Badges</dt>
        </div>
      </dl>

      <section className="profile-section">
        <h2 className="micro-label">Trails</h2>
        <ul className="profile-trails">
          {trails.map((t) => (
            <li key={t.id} className={t.complete ? "is-complete" : ""}>
              <div className="profile-trail-row">
                <span className="profile-trail-name">{t.label}</span>
                <span className="profile-trail-count">{t.complete ? "Completed ✓" : `${t.done}/${t.total}`}</span>
              </div>
              <div className="profile-bar" role="progressbar" aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={t.done} aria-label={`${t.label} trail`}>
                <span style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="profile-section">
        <h2 className="micro-label">Badges won</h2>
        <ul className="profile-badges">
          {badges.map((b) => (
            <li key={b.key} className={b.won ? "" : "is-locked"}>
              <div className="profile-badge-art">{b.won ? b.art : <span aria-hidden="true">?</span>}</div>
              <span className="profile-badge-name">{b.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {dock}
    </div>
  );
}
