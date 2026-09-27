import { useState, useRef, useEffect } from "react";
import type { MatchResponse } from "@frame-one/shared";
import { postMatch } from "./api/client";
import "./tokens.css";
import "./App.css";

type Step = "capture" | "questions" | "scanning" | "result" | "merge" | "unlocked" | "map";

const DEMO_LAT = 40.758;
const DEMO_LNG = -73.9855;
const DEMO_LOCATION = "Times Square, Manhattan";

export default function App() {
  const [step, setStep] = useState<Step>("capture");
  const [movieQuery, setMovieQuery] = useState("");
  const [match, setMatch] = useState<MatchResponse | null>(null);
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

  useEffect(() => {
    if (step === "scanning") {
      const timer = setTimeout(() => {
        runMatch();
      }, 3600);
      return () => clearTimeout(timer);
    }
  }, [step]);

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

  async function runMatch() {
    try {
      const result = await postMatch({
        lat: DEMO_LAT,
        lng: DEMO_LNG,
        movieQuery: movieQuery || undefined,
        photoDataUrl: photoDataUrl || undefined,
      });
      setMatch(result);
      setStep("result");
    } catch (e) {
      console.error("Match failed:", e);
      setStep("questions");
    }
  }

  if (step === "capture") {
    return (
      <div className="screen">
        {!photoDataUrl && !showCamera && (
          <div className="capture-empty">
            <div className="capture-header">
              <div className="location-pill">
                <span className="dot blink"></span>
                <span className="location-name">{DEMO_LOCATION}</span>
                <span className="location-count">14</span>
              </div>
            </div>
            <div className="capture-well">
              <div className="capture-placeholder"></div>
            </div>
            <p className="instruction">Point at somewhere you've seen in a film</p>
            <div className="shutter-row">
              <button
                type="button"
                className="last-capture"
                aria-label="Your last capture"
              />
              <button
                type="button"
                className="shutter"
                onClick={showCamera ? capturePhoto : startCamera}
                aria-label="Take the photo"
              >
                <svg width="30" height="30" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="5.5" width="16" height="11.5" rx="3" stroke="#FFFFFF" strokeWidth="1.8" />
                  <circle cx="10" cy="11.2" r="3.4" stroke="#FFFFFF" strokeWidth="1.8" />
                  <path d="M7.4 5.5 8.7 3.2h2.6l1.3 2.3" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="switch-camera" aria-label="Switch camera">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 8a7 7 0 0 1 11.6-3.3L17 7" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M17 3.5V7h-3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 12a7 7 0 0 1-11.6 3.3L3 13" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 16.5V13h3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {showCamera && (
          <div className="capture-camera">
            <div className="capture-header">
              <div className="location-pill">
                <span className="dot blink"></span>
                <span className="location-name">{DEMO_LOCATION}</span>
                <span className="location-count">14</span>
              </div>
            </div>
            <div className="camera-well">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <div className="camera-brackets">
                <div className="bracket tl"></div>
                <div className="bracket tr"></div>
                <div className="bracket bl"></div>
                <div className="bracket br"></div>
              </div>
            </div>
            <p className="instruction">Point at somewhere you've seen in a film</p>
            <div className="shutter-row">
              <button type="button" className="last-capture" aria-label="Your last capture" />
              <button type="button" className="shutter" onClick={capturePhoto} aria-label="Take the photo">
                <svg width="30" height="30" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="5.5" width="16" height="11.5" rx="3" stroke="#FFFFFF" strokeWidth="1.8" />
                  <circle cx="10" cy="11.2" r="3.4" stroke="#FFFFFF" strokeWidth="1.8" />
                  <path d="M7.4 5.5 8.7 3.2h2.6l1.3 2.3" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="switch-camera" onClick={stopCamera} aria-label="Switch camera">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 8a7 7 0 0 1 11.6-3.3L17 7" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M17 3.5V7h-3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 12a7 7 0 0 1-11.6 3.3L3 13" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 16.5V13h3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {photoDataUrl && !showCamera && (
          <div className="capture-preview">
            <div className="capture-header">
              <div className="location-pill">
                <span className="dot blink"></span>
                <span className="location-name">{DEMO_LOCATION}</span>
                <span className="location-count">14</span>
              </div>
            </div>
            <div className="preview-well">
              <img src={photoDataUrl} alt="Captured" className="preview-image" />
            </div>
            <p className="instruction">Ready to find the scene?</p>
            <div className="shutter-row">
              <button
                type="button"
                className="last-capture"
                onClick={() => {
                  setPhotoDataUrl(null);
                  fileInputRef.current?.click();
                }}
                aria-label="Retake"
              />
              <button
                type="button"
                className="shutter primary"
                onClick={() => setStep("questions")}
                aria-label="Continue"
              >
                <span>Continue</span>
              </button>
              <button
                type="button"
                className="switch-camera"
                onClick={() => setPhotoDataUrl(null)}
                aria-label="Retake"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 8a7 7 0 0 1 11.6-3.3L17 7" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M17 3.5V7h-3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 12a7 7 0 0 1-11.6 3.3L3 13" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M3 16.5V13h3.5" stroke="#22262A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>
        )}

        <nav className="dock">
          <a href="#shoot" className="dock-item active">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="6" width="15" height="11" rx="2.5" stroke="#FFFFFF" strokeWidth="1.6" />
              <circle cx="10" cy="11.5" r="3" stroke="#FFFFFF" strokeWidth="1.6" />
              <path d="M7 6l1.2-2.2h3.6L13 6" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            Shoot
          </a>
          <button type="button" className="dock-item" onClick={() => setStep("map")}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 5.5 7.5 3.5l5 2 5-2v11l-5 2-5-2-5 2z" stroke="#22262A" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M7.5 3.5v11M12.5 5.5v11" stroke="#22262A" strokeWidth="1.6" />
            </svg>
            Map
          </button>
        </nav>
      </div>
    );
  }

  if (step === "questions") {
    return (
      <div className="screen questions">
        <div className="questions-header">
          <button type="button" onClick={() => setStep("capture")} className="back-link">
            Retake
          </button>
          <span className="counter">2 / 2</span>
        </div>

        <div className="questions-body">
          {photoDataUrl && (
            <div className="thumbnail">
              <img src={photoDataUrl} alt="Captured" />
            </div>
          )}

          <div className="location-card">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" className="check-icon">
              <circle cx="10" cy="10" r="9" fill="#1C4C6B" />
              <path d="m5.6 10.3 2.9 2.8 5.9-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="location-info">
              <span className="micro-label">Where you are</span>
              <span className="location-title">{DEMO_LOCATION}</span>
            </div>
            <button type="button" className="edit-button">
              Edit
            </button>
          </div>

          <h1 className="question-title">Know what was filmed here?</h1>
          <p className="question-subtitle">A guess narrows it a lot. A wrong one costs nothing.</p>

          <label htmlFor="movie-input" className="micro-label">
            Your guess
          </label>
          <input
            id="movie-input"
            type="text"
            value={movieQuery}
            onChange={(e) => setMovieQuery(e.target.value)}
            placeholder="Spider-Man"
            className="movie-input"
            autoFocus
          />

          <div className="spacer" />

          <button
            type="button"
            onClick={() => setStep("scanning")}
            disabled={!movieQuery.trim()}
            className="primary-button"
          >
            Find the scene
          </button>
        </div>
      </div>
    );
  }

  if (step === "scanning") {
    return (
      <div className="screen scanning">
        <div className="frozen-frame">
          {photoDataUrl && <img src={photoDataUrl} alt="Scanning" />}
          <div className="scan-line"></div>
          <div className="geometry-outline outline-1"></div>
          <div className="geometry-outline outline-2"></div>
          <div className="geometry-outline outline-3"></div>
        </div>

        <div className="scanning-readout">
          <h1 className="scanning-title">Reading the frame</h1>
          <p className="scanning-subtitle">{DEMO_LOCATION}, 14 scenes, narrowing on your guess.</p>

          <div className="scanning-steps">
            <div className="step done">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#1C4C6B" />
                <path d="m5.6 10.3 2.9 2.8 5.9-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>14 candidates within 300 m</span>
            </div>
            <div className="step done">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" fill="#1C4C6B" />
                <path d="m5.6 10.3 2.9 2.8 5.9-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Narrowed to 3</span>
            </div>
            <div className="step active">
              <span className="spinner"></span>
              <span>Matching the skyline</span>
            </div>
            <div className="step waiting">
              <span className="spinner"></span>
              <span>Locking the camera position</span>
            </div>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill"></div>
        </div>

        <button type="button" onClick={() => setStep("questions")} className="cancel-button">
          Cancel
        </button>
      </div>
    );
  }

  if (step === "result" && match) {
    return (
      <div className="screen result">
        <button type="button" onClick={() => setStep("capture")} className="back-button">
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 4 6.5 10l6 6" stroke="#22262A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="result-body">
          <div className="chip guessed">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="m3 8.4 3.2 3.1L13 4.8" stroke="#1C4C6B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Guessed it</span>
          </div>

          <h1 className="verdict">Exact match.</h1>

          <div className="frame-row">
            <div className="frame-col">
              <div className="frame-well">
                {photoDataUrl && <img src={photoDataUrl} alt="Yours" />}
              </div>
              <div className="frame-label">Yours</div>
            </div>
            <div className="frame-col">
              <div className="frame-well placeholder">
                <span>[ still ]</span>
              </div>
              <div className="frame-label">Film</div>
            </div>
          </div>

          <div className="match-score">
            <span className="score-number">87</span>
            <span className="score-label">% framing match</span>
          </div>

          <div className="film-card">
            <h2 className="film-title">{match.filmTitle}</h2>
            <div className="film-meta">
              {match.year} · Marc Webb
            </div>
            <div className="clip-tile">
              <button type="button" className="play-button">
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                  <path d="M5.5 3.5 12 8l-6.5 4.5v-9Z" fill="#FFFFFF" />
                </svg>
              </button>
            </div>
            <p className="film-description">
              The Times Square fight. Garfield and Foxx, shot on the block you are standing on.
            </p>
          </div>

          <div className="fun-fact-card">
            <div className="fun-fact-text">[ fun fact: one line from TMDB ]</div>
          </div>

          <button type="button" onClick={() => setStep("merge")} className="primary-button recreate">
            Recreate this shot
          </button>
          <button type="button" onClick={() => setStep("map")} className="text-link">
            Just save it
          </button>
        </div>
      </div>
    );
  }

  if (step === "merge" && match) {
    return (
      <div className="screen merge">
        <h1 className="merge-title">Merge Demo</h1>
        <p className="merge-description">
          In this demo, the film still ({match.filmTitle}) would overlay onto your photo here.
          The composite image IS the recreate.
        </p>
        <div className="merge-preview">
          {photoDataUrl && <img src={photoDataUrl} alt="Base photo" />}
          {match.stillUrl && (
            <img
              src={match.stillUrl}
              alt="Film still overlay"
              className="merge-overlay"
              style={{ opacity: 0.5 }}
            />
          )}
        </div>
        <button type="button" onClick={() => setStep("unlocked")} className="primary-button">
          Claim the stamp
        </button>
      </div>
    );
  }

  if (step === "unlocked") {
    return (
      <div className="screen unlocked">
        <div className="unlocked-stage">
          <div className="stamp-eyebrow">Stamp 12 of 118</div>
          <div className="badge-large">
            <svg width="188" height="188" viewBox="0 0 188 188" fill="none">
              <circle cx="94" cy="94" r="92" fill="#1C4C6B" />
              <circle cx="94" cy="94" r="80" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
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
              <circle cx="94" cy="94" r="44" fill="#123A52" fillOpacity="1" />
            </svg>
          </div>
          <h1 className="unlocked-title">
            Times Square
            <br />
            is yours.
          </h1>
          <div className="trail-card">
            <div className="trail-header">
              <span className="trail-name">Marvel trail</span>
              <span className="trail-progress">1 / 6</span>
            </div>
            <div className="trail-segments">
              <span className="segment filled"></span>
              <span className="segment"></span>
              <span className="segment"></span>
              <span className="segment"></span>
              <span className="segment"></span>
              <span className="segment"></span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setStep("map")} className="primary-button">
          See the map
        </button>
      </div>
    );
  }

  if (step === "map") {
    return (
      <div className="screen map">
        <div className="map-placeholder">
          <div className="map-header">
            <div className="map-title">New York</div>
            <div className="map-count">3 of 14 zones</div>
          </div>
          <div className="map-canvas">
            <div className="stamp-pin">
              <div className="stamp-icon">🎬</div>
              <div className="stamp-label">Times Square</div>
            </div>
          </div>
        </div>

        <div className="map-sheet">
          <div className="sheet-handle"></div>
          <div className="sheet-content">
            <div className="sheet-row">
              <div className="sheet-thumbnail"></div>
              <div className="sheet-info">
                <div className="sheet-title">Times Square</div>
                <div className="sheet-meta">{match?.filmTitle} · {match?.year} · 87% match</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 4l6 6-6 6" stroke="#1C4C6B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {match?.goNext && match.goNext.length > 0 && (
              <div className="go-next-section">
                <div className="micro-label">Where to go next</div>
                {match.goNext.map((item) => (
                  <div key={item.spotId} className="go-next-item">
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="dock">
          <button type="button" onClick={() => setStep("capture")} className="dock-item">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="6" width="15" height="11" rx="2.5" stroke="#22262A" strokeWidth="1.6" />
              <circle cx="10" cy="11.5" r="3" stroke="#22262A" strokeWidth="1.6" />
              <path d="M7 6l1.2-2.2h3.6L13 6" stroke="#22262A" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            Shoot
          </button>
          <a href="#map" className="dock-item active">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 5.5 7.5 3.5l5 2 5-2v11l-5 2-5-2-5 2z" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M7.5 3.5v11M12.5 5.5v11" stroke="#FFFFFF" strokeWidth="1.6" />
            </svg>
            Map
          </a>
        </nav>
      </div>
    );
  }

  return null;
}
