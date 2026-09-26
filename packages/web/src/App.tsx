import { useState, useRef, useEffect, type CSSProperties } from "react";
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
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraStream(stream);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      setError("Camera access denied. Please use upload instead.");
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhotoDataUrl(dataUrl);
    stopCamera();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoDataUrl(null);
    setError(null);
  }

  async function runMatch() {
    setLoading(true);
    setError(null);
    setStep("matching");
    try {
      const result = await postMatch({
        lat: DEMO_LAT,
        lng: DEMO_LNG,
        movieQuery,
        photoDataUrl: photoDataUrl || undefined,
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
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            letterSpacing: "0.05em",
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          FRAME ONE
        </h1>
        <p
          style={{
            margin: "0.25rem 0 0",
            opacity: 0.7,
            fontSize: "0.9rem",
            fontFamily: "var(--font-ui)",
          }}
        >
          Movie Map — cinephile location capture
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
              borderRadius: "var(--radius-pill)",
              background:
                step === s ? "var(--ember-orange)" : "var(--warm-surface)",
              color: step === s ? "var(--ink)" : "var(--ink)",
              opacity: step === s ? 1 : 0.5,
              border: "1px solid var(--warm-border)",
            }}
          >
            {s}
          </span>
        ))}
      </nav>

      {step === "capture" && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            1. Capture
          </h2>

          {!photoDataUrl && !showCamera && (
            <>
              <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
                Take a photo of your location or upload an existing image.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={startCamera}
                  style={btnStyle}
                >
                  📷 Use Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...btnStyle,
                    background: "var(--warm-surface)",
                    color: "var(--ink)",
                    border: "2px solid var(--warm-border)",
                  }}
                >
                  📁 Upload Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </div>
            </>
          )}

          {showCamera && (
            <div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-lg)",
                  border: "2px solid var(--warm-border)",
                  marginBottom: "0.75rem",
                }}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={capturePhoto}
                  style={{ ...btnStyle, flex: 1 }}
                >
                  Capture
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  style={{
                    ...btnStyle,
                    flex: 1,
                    background: "var(--warm-surface)",
                    color: "var(--ink)",
                    border: "2px solid var(--warm-border)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {photoDataUrl && (
            <div>
              <p style={{ opacity: 0.8, marginBottom: "0.75rem" }}>
                Preview:
              </p>
              <img
                src={photoDataUrl}
                alt="Captured"
                style={{
                  width: "100%",
                  borderRadius: "var(--radius-lg)",
                  border: "2px solid var(--warm-border)",
                  marginBottom: "0.75rem",
                }}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setStep("context")}
                  style={{ ...btnStyle, flex: 1 }}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={clearPhoto}
                  style={{
                    ...btnStyle,
                    flex: 1,
                    background: "var(--warm-surface)",
                    color: "var(--ink)",
                    border: "2px solid var(--warm-border)",
                  }}
                >
                  Retake
                </button>
              </div>
            </div>
          )}

          {error && (
            <p
              style={{
                color: "var(--ember-orange)",
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "var(--warm-surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--warm-border)",
              }}
            >
              {error}
            </p>
          )}
        </section>
      )}

      {step === "context" && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            2. Context
          </h2>
          <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
            GPS pin: {DEMO_LAT}, {DEMO_LNG} (Times Square demo)
          </p>
          {photoDataUrl && (
            <div style={{ marginBottom: "1rem" }}>
              <p
                style={{
                  fontSize: "0.85rem",
                  opacity: 0.7,
                  marginBottom: "0.5rem",
                }}
              >
                Your photo:
              </p>
              <img
                src={photoDataUrl}
                alt="Captured"
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "cover",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--warm-border)",
                }}
              />
            </div>
          )}
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>
              Movie / vibe
            </span>
            <input
              value={movieQuery}
              onChange={(e) => setMovieQuery(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: "0.65rem",
                borderRadius: "var(--radius-sm)",
                border: "2px solid var(--warm-border)",
                background: "var(--warm-surface)",
                color: "var(--ink)",
              }}
            />
          </label>
          <button
            type="button"
            onClick={runMatch}
            disabled={loading}
            style={btnStyle}
          >
            {loading ? "Matching…" : "Find Match"}
          </button>
          {error && (
            <p
              style={{
                color: "var(--ember-orange)",
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "var(--warm-surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--warm-border)",
              }}
            >
              {error}
            </p>
          )}
        </section>
      )}

      {step === "matching" && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            3. Matching
          </h2>
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              background: "var(--warm-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--warm-border)",
            }}
          >
            <p style={{ opacity: 0.8 }}>Your photo ↔ film scene…</p>
          </div>
        </section>
      )}

      {step === "merge" && match && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            4. Merge
          </h2>
          <div
            style={{
              padding: "1rem",
              background: "var(--forest-teal)",
              color: "var(--canvas)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "1rem",
            }}
          >
            <p style={{ margin: "0 0 0.5rem" }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
                {match.filmTitle}
              </strong>{" "}
              ({match.year})
            </p>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "0.85rem" }}>
              Match quality: {match.mergeOk ? "✓ Excellent" : "⚠ Needs adjustment"}
            </p>
          </div>
          <img
            src={match.stillUrl}
            alt="film still"
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              border: "2px solid var(--warm-border)",
              marginBottom: "0.75rem",
            }}
          />
          <button
            type="button"
            onClick={() => setStep("map")}
            style={{ ...btnStyle, marginBottom: "0.75rem" }}
          >
            Unlock Map
          </button>
          <pre>{JSON.stringify(match, null, 2)}</pre>
        </section>
      )}

      {step === "vantage" && match && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            5. Vantage
          </h2>
          <div
            style={{
              padding: "1rem",
              background: "var(--warm-surface)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--warm-border)",
              marginBottom: "1rem",
            }}
          >
            <p style={{ margin: 0, opacity: 0.8 }}>
              Stand here / shoot from this angle, then retake.
            </p>
          </div>
          <img
            src={match.vantageUrl}
            alt="vantage"
            style={{
              width: "100%",
              borderRadius: "var(--radius-lg)",
              border: "2px solid var(--warm-border)",
              marginBottom: "0.75rem",
            }}
          />
          <button
            type="button"
            onClick={runMatch}
            style={{ ...btnStyle, marginBottom: "0.75rem" }}
          >
            Retake / Re-match
          </button>
          <pre>{JSON.stringify(match, null, 2)}</pre>
        </section>
      )}

      {step === "map" && (
        <section>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              marginTop: 0,
            }}
          >
            6. Map Unlock
          </h2>
          
          <div
            style={{
              position: "relative",
              minHeight: "300px",
              background: "linear-gradient(180deg, #c5dff8 0%, #a6cee3 100%)",
              borderRadius: "var(--radius-xl)",
              border: "2px solid var(--warm-border)",
              padding: "1rem",
              marginBottom: "1rem",
              overflow: "hidden",
            }}
          >
            <svg
              viewBox="0 0 300 400"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0.3,
              }}
            >
              <path
                d="M100,50 L120,80 L140,70 L160,120 L180,140 L200,180 L210,220 L200,260 L180,300 L160,340 L140,360 L120,350 L100,320 L80,280 L70,240 L80,200 L90,160 L95,120 L100,80 Z"
                fill="var(--canvas)"
                stroke="var(--warm-border)"
                strokeWidth="2"
              />
            </svg>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  justifyContent: "center",
                  padding: "1rem 0",
                }}
              >
                {match && (
                  <div
                    key={match.spotId}
                    style={{
                      width: "80px",
                      height: "80px",
                      background: "linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%)",
                      border: "3px solid var(--ink)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.5rem",
                      boxShadow: "0 2px 0 rgba(0,0,0,0.2)",
                      cursor: "pointer",
                      transition: "transform 0.2s",
                    }}
                    title={`${match.filmTitle} (${match.year})`}
                  >
                    <div style={{ fontSize: "1.5rem" }}>🎬</div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        textAlign: "center",
                        marginTop: "0.25rem",
                        color: "var(--canvas)",
                        lineHeight: 1.1,
                      }}
                    >
                      {match.filmTitle.split(" ")[0]}
                    </div>
                  </div>
                )}

                {match?.goNext.slice(0, 3).map((g, idx) => {
                  const colors = [
                    "linear-gradient(135deg, #a8e6cf 0%, #56c596 100%)",
                    "linear-gradient(135deg, #ffd93d 0%, #f6b93b 100%)", 
                    "linear-gradient(135deg, #a8d8ea 0%, #6eb5d0 100%)",
                  ];
                  return (
                    <div
                      key={g.spotId}
                      style={{
                        width: "80px",
                        height: "80px",
                        background: colors[idx % colors.length],
                        border: "3px solid var(--ink)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0.5rem",
                        boxShadow: "0 2px 0 rgba(0,0,0,0.2)",
                        cursor: "pointer",
                      }}
                      title={g.label}
                    >
                      <div style={{ fontSize: "1.5rem" }}>🎞️</div>
                      <div
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          textAlign: "center",
                          marginTop: "0.25rem",
                          color: "var(--ink)",
                          lineHeight: 1.1,
                        }}
                      >
                        {g.label.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  );
                })}

                {[1, 2, 3].map((i) => (
                  <div
                    key={`locked-${i}`}
                    style={{
                      width: "80px",
                      height: "80px",
                      background: "#d4d4d4",
                      border: "3px solid #999",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.5rem",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.15)",
                      opacity: 0.5,
                      filter: "grayscale(1)",
                    }}
                  >
                    <div style={{ fontSize: "1.5rem", opacity: 0.5 }}>🔒</div>
                    <div
                      style={{
                        fontSize: "0.6rem",
                        fontWeight: 600,
                        textAlign: "center",
                        marginTop: "0.25rem",
                        color: "#666",
                      }}
                    >
                      Locked
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: "var(--canvas)",
                  border: "2px solid var(--ink)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.75rem",
                  margin: "1rem auto 0",
                  maxWidth: "220px",
                  textAlign: "center",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.1rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  I 🎞️ NY
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                  {match ? "1 spot unlocked" : "Keep exploring"}
                </div>
              </div>
            </div>
          </div>

          <details
            style={{
              background: "var(--warm-surface)",
              border: "1px solid var(--warm-border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.9rem",
              }}
            >
              Unlocked Locations
            </summary>
            {match && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0.75rem 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <li
                  style={{
                    padding: "0.5rem",
                    background: "var(--accent-lavender)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--warm-border)",
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>{match.filmTitle} ({match.year})</strong>
                  <br />
                  <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
                    {match.lat.toFixed(4)}, {match.lng.toFixed(4)}
                  </span>
                </li>
                {match.goNext.slice(0, 3).map((g) => (
                  <li
                    key={g.spotId}
                    style={{
                      padding: "0.5rem",
                      background: "var(--canvas)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--warm-border)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <strong>{g.label}</strong>
                    <br />
                    <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
                      {g.lat.toFixed(4)}, {g.lng.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </details>

          <button
            type="button"
            onClick={() => {
              setMatch(null);
              setPhotoDataUrl(null);
              setStep("capture");
            }}
            style={btnStyle}
          >
            Start Over
          </button>
        </section>
      )}
    </div>
  );
}

const btnStyle: CSSProperties = {
  background: "var(--accent-lavender)",
  color: "var(--ink)",
  border: "2px solid var(--warm-border)",
  borderRadius: "var(--radius-sm)",
  padding: "0.75rem 1rem",
  width: "100%",
  fontWeight: 500,
  fontSize: "1rem",
};
