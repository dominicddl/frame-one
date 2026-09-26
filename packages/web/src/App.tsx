import { useState, type CSSProperties } from "react";
import type { MatchResponse } from "@frame-one/shared";
import { postMatch } from "./api/client";

type Step =
  | "capture"
  | "context"
  | "matching"
  | "merge"
  | "vantage"
  | "map";

const DEMO_LAT = 40.758;
const DEMO_LNG = -73.9855;

export default function App() {
  const [step, setStep] = useState<Step>("capture");
  const [movieQuery, setMovieQuery] = useState("Spider-Man");
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runMatch() {
    setLoading(true);
    setError(null);
    setStep("matching");
    try {
      const result = await postMatch({
        lat: DEMO_LAT,
        lng: DEMO_LNG,
        movieQuery,
      });
      setMatch(result);
      setStep(result.mergeOk ? "merge" : "vantage");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("context");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "0.05em" }}>
          FRAME ONE
        </h1>
        <p style={{ margin: "0.25rem 0 0", opacity: 0.7, fontSize: "0.9rem" }}>
          Movie Map — stub flow
        </p>
      </header>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          marginBottom: "1.25rem",
          fontSize: "0.7rem",
        }}
      >
        {(
          [
            "capture",
            "context",
            "matching",
            "merge",
            "vantage",
            "map",
          ] as Step[]
        ).map((s) => (
          <span
            key={s}
            style={{
              padding: "0.2rem 0.5rem",
              borderRadius: 999,
              background: step === s ? "#e94560" : "#1a1a2e",
              opacity: step === s ? 1 : 0.6,
            }}
          >
            {s}
          </span>
        ))}
      </nav>

      {step === "capture" && (
        <section>
          <h2>1. Capture</h2>
          <p style={{ opacity: 0.8 }}>
            Stub: photo capture / upload lives here (getUserMedia).
          </p>
          <button
            type="button"
            onClick={() => setStep("context")}
            style={btnStyle}
          >
            Next: Context
          </button>
        </section>
      )}

      {step === "context" && (
        <section>
          <h2>2. Context</h2>
          <p style={{ opacity: 0.8 }}>
            GPS pin: {DEMO_LAT}, {DEMO_LNG} (Times Square demo)
          </p>
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            Movie / vibe
            <input
              value={movieQuery}
              onChange={(e) => setMovieQuery(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "0.5rem",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#1a1a2e",
                color: "#fff",
              }}
            />
          </label>
          <button
            type="button"
            onClick={runMatch}
            disabled={loading}
            style={btnStyle}
          >
            {loading ? "Matching…" : "Call POST /api/match"}
          </button>
          {error && (
            <p style={{ color: "#e94560", marginTop: "0.75rem" }}>{error}</p>
          )}
        </section>
      )}

      {step === "matching" && (
        <section>
          <h2>3. Matching</h2>
          <p>Your photo ↔ film scene…</p>
        </section>
      )}

      {step === "merge" && match && (
        <section>
          <h2>4. Merge</h2>
          <p>
            Overlay <strong>{match.filmTitle}</strong> ({match.year}) — mergeOk:{" "}
            <code>{String(match.mergeOk)}</code>
          </p>
          <img
            src={`http://localhost:3001${match.stillUrl}`}
            alt="film still"
            style={{ width: "100%", borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={() => setStep("map")}
            style={{ ...btnStyle, marginTop: "0.75rem" }}
          >
            Unlock map
          </button>
          <pre>{JSON.stringify(match, null, 2)}</pre>
        </section>
      )}

      {step === "vantage" && match && (
        <section>
          <h2>5. Vantage</h2>
          <p>Stand here / shoot from this angle, then retake.</p>
          <img
            src={`http://localhost:3001${match.vantageUrl}`}
            alt="vantage"
            style={{ width: "100%", borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={runMatch}
            style={{ ...btnStyle, marginTop: "0.75rem" }}
          >
            Retake / re-match
          </button>
          <pre>{JSON.stringify(match, null, 2)}</pre>
        </section>
      )}

      {step === "map" && (
        <section>
          <h2>6. Map unlock</h2>
          <p style={{ opacity: 0.8 }}>
            Stub: shadowed icon → colourful stamp; fog clears; goNext peeks.
          </p>
          {match && (
            <ul>
              {match.goNext.map((g) => (
                <li key={g.spotId}>
                  {g.label} ({g.lat.toFixed(4)}, {g.lng.toFixed(4)})
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setMatch(null);
              setStep("capture");
            }}
            style={btnStyle}
          >
            Start over
          </button>
        </section>
      )}
    </div>
  );
}

const btnStyle: CSSProperties = {
  background: "#e94560",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0.65rem 1rem",
  width: "100%",
};
