import { useState, useRef, useEffect, useCallback } from "react";
import type { MatchResponse, SoftMissSuggestion } from "@frame-one/shared";
import { getSpots, postMatch, geocodePlace, type GeocodeSuggestion } from "./api/client";
import { useUnlocks } from "./hooks/useUnlocks";
import MapView, { type SavedStamp } from "./MapView";
import "./tokens.css";
import "./App.css";

type Step = "capture" | "questions" | "scanning" | "result" | "soft-miss" | "recreate" | "map";

interface Place {
  name: string;
  lat: number;
  lng: number;
}

const DEFAULT_PLACE: Place = { name: "Times Square", lat: 40.758, lng: -73.9855 };
const MIN_SCAN_MS = 2400;

// Per-character stamp art for polaroid cutout (same as MapView)
const STAMP_ART: Record<string, string> = {
  "tasm2-red-steps": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><defs><clipPath id="clip-tasm"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-tasm)"><ellipse cx="56" cy="48" rx="22" ry="26" fill="#c62828"/><ellipse cx="47" cy="46" rx="8" ry="10" fill="#90caf9" transform="rotate(-12 47 46)"/><ellipse cx="65" cy="46" rx="8" ry="10" fill="#90caf9" transform="rotate(12 65 46)"/><ellipse cx="47" cy="46" rx="4.5" ry="6" fill="#1565c0" transform="rotate(-12 47 46)"/><ellipse cx="65" cy="46" rx="4.5" ry="6" fill="#1565c0" transform="rotate(12 65 46)"/><path d="M56 28 L56 74 M40 40 L72 56 M72 40 L40 56" fill="none" stroke="#8b1a1a" stroke-width="1.2" opacity="0.55"/><path d="M34 78 Q56 68 78 78 L78 112 L34 112 Z" fill="#1565c0"/><path d="M44 78 Q56 72 68 78 L68 112 L44 112 Z" fill="#c62828"/></g></svg>`,
  "home-alone-radio-city": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><defs><clipPath id="clip-kevin"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#f7f1ea"/><g clip-path="url(#clip-kevin)"><ellipse cx="56" cy="54" rx="20" ry="22" fill="#e8c4a8"/><path d="M34 48 Q34 28 56 26 Q78 28 78 48 L78 52 Q56 48 34 52 Z" fill="#2a241f"/><ellipse cx="56" cy="28" rx="7" ry="5" fill="#e87a2a"/><circle cx="48" cy="54" r="3.2" fill="#2a241f"/><circle cx="64" cy="54" r="3.2" fill="#2a241f"/><ellipse cx="56" cy="66" rx="5" ry="6" fill="#2a241f"/><path d="M38 74 Q56 70 74 74 L78 88 Q56 92 34 88 Z" fill="#c62828"/><rect x="62" y="78" width="10" height="28" rx="3" fill="#c62828"/><rect x="62" y="100" width="10" height="6" rx="2" fill="#f7f1ea" opacity="0.7"/></g></svg>`,
  "joker-bronx-stairs": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><defs><clipPath id="clip-joker"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-joker)"><path d="M28 58 Q26 22 56 18 Q86 22 84 58 Q78 42 56 40 Q34 42 28 58 Z" fill="#4caf50"/><path d="M30 50 Q28 30 42 26 Q36 40 30 50 M82 50 Q84 30 70 26 Q76 40 82 50" fill="#66bb6a"/><ellipse cx="56" cy="58" rx="18" ry="20" fill="#f5f0e8"/><ellipse cx="48" cy="56" rx="3.5" ry="4" fill="#1a1a1a"/><ellipse cx="64" cy="56" rx="3.5" ry="4" fill="#1a1a1a"/><path d="M42 68 Q56 80 70 68" fill="none" stroke="#c62828" stroke-width="2.5" stroke-linecap="round"/><path d="M36 82 Q56 76 76 82 L80 112 L32 112 Z" fill="#6a1b9a"/><path d="M52 82 L56 96 L60 82" fill="#f5f0e8"/></g></svg>`,
  "cap-america-times-square": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><defs><clipPath id="clip-cap"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#f7f1ea"/><g clip-path="url(#clip-cap)"><circle cx="56" cy="56" r="34" fill="#c62828"/><circle cx="56" cy="56" r="26" fill="#f7f1ea"/><circle cx="56" cy="56" r="18" fill="#c62828"/><circle cx="56" cy="56" r="11" fill="#1565c0"/><path d="M56 47 L58.5 53.5 L65.5 53.5 L60 58 L62.2 64.5 L56 60.5 L49.8 64.5 L52 58 L46.5 53.5 L53.5 53.5 Z" fill="#f7f1ea"/></g></svg>`,
  "friends-benefits-central-park-mall": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><defs><clipPath id="clip-fwb"><circle cx="56" cy="56" r="50"/></clipPath></defs><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g clip-path="url(#clip-fwb)"><ellipse cx="56" cy="90" rx="40" ry="14" fill="#3d5a3d" opacity="0.45"/><circle cx="42" cy="44" r="11" fill="#e8c4a8"/><path d="M30 58 Q42 52 54 58 L54 92 L30 92 Z" fill="#5d4e37"/><path d="M32 38 Q42 30 52 38 Q48 48 42 48 Q36 48 32 38 Z" fill="#2a241f"/><circle cx="70" cy="44" r="11" fill="#e8c4a8"/><path d="M58 58 Q70 52 82 58 L82 92 L58 92 Z" fill="#8b4513"/><path d="M58 40 Q62 28 70 28 Q78 28 82 40 L80 56 Q70 60 60 56 Z" fill="#4a3728"/><path d="M50 62 Q56 56 62 62 Q56 70 50 62 Z" fill="#e87a2a"/></g></svg>`,
};

const STAMP_FALLBACK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112" width="112" height="112"><circle cx="56" cy="56" r="53.5" fill="none" stroke="#e87a2a" stroke-width="5"/><circle cx="56" cy="56" r="50" fill="#2a241f"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" transform="translate(28,28)"><rect x="6" y="24" width="44" height="26" rx="4"/><path d="M6 24 9 12h38l3 12"/><path d="M18 12 16 24M30 12l-2 12M42 12l-2 12"/></g></svg>';

function getStampArt(spotId: string): string {
  return STAMP_ART[spotId] || STAMP_FALLBACK;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFile(file: Blob, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result as string);
  reader.readAsDataURL(file);
}

function Dock({ active, onShoot, onMap, className = "" }: { active: "shoot" | "map"; onShoot: () => void; onMap: () => void; className?: string }) {
  return (
    <nav className={`dock ${className}`} aria-label="Main">
      <button type="button" className={`dock-item${active === "shoot" ? " active" : ""}`} onClick={onShoot} aria-current={active === "shoot" ? "page" : undefined}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="2.5" y="6" width="15" height="11" rx="2.5" />
          <circle cx="10" cy="11.5" r="3" />
          <path d="M7 6l1.2-2.2h3.6L13 6" strokeLinejoin="round" />
        </svg>
        Shoot
      </button>
      <button type="button" className={`dock-item${active === "map" ? " active" : ""}`} onClick={onMap} aria-current={active === "map" ? "page" : undefined}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 5.5 7.5 3.5l5 2 5-2v11l-5 2-5-2-5 2z" strokeLinejoin="round" />
          <path d="M7.5 3.5v11M12.5 5.5v11" />
        </svg>
        Map
      </button>
    </nav>
  );
}

function BackIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 4 6.5 10l6 6" stroke="#22262A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22262A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13V4M6.5 7.5 10 4l3.5 3.5" />
      <path d="M3.5 12.5v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function RetakeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#22262A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a7 7 0 0 1 11.6-3.3L17 7" />
      <path d="M17 3.5V7h-3.5" />
      <path d="M17 12a7 7 0 0 1-11.6 3.3L3 13" />
      <path d="M3 16.5V13h3.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v10M6.5 6.5 10 3l3.5 3.5" />
      <path d="M3.5 12.5v2a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>("capture");
  const [movieQuery, setMovieQuery] = useState("");
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedStamp | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [editingPlace, setEditingPlace] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [geocodedPlaces, setGeocodedPlaces] = useState<GeocodeSuggestion[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<SoftMissSuggestion[]>([]);
  const [spotsCache, setSpotsCache] = useState<{ spotId: string; lat: number; lng: number; neighbourhood: string }[]>([]);
  const [recreateSubStep, setRecreateSubStep] = useState<"align" | "stamp">("align");
  const [recreatePhotoUrl, setRecreatePhotoUrl] = useState<string | null>(null);
  const [recreateCameraStream, setRecreateCameraStream] = useState<MediaStream | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recreateVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recreateFileInputRef = useRef<HTMLInputElement>(null);

  // Use the useUnlocks hook as the single source of truth
  const { unlocks, unlock, seedDemo } = useUnlocks();

  // Seed demo unlocks if ?demo=1 is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      seedDemo();
    }
  }, [seedDemo]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (recreateCameraStream && recreateVideoRef.current) {
      recreateVideoRef.current.srcObject = recreateCameraStream;
    }
  }, [recreateCameraStream]);

  useEffect(() => {
    if (step !== "scanning") return;
    let cancelled = false;
    Promise.all([
      postMatch({ lat: place.lat, lng: place.lng, movieQuery, photoDataUrl: photoDataUrl || undefined }),
      wait(MIN_SCAN_MS),
    ])
      .then(([result]) => {
        if (cancelled) return;
        setMatch(result);
        
        // Soft-miss ONLY when matchConfidence is low (wrong/weak film match)
        // Do NOT soft-miss on medium/high just because suggestions exist
        if (result.matchConfidence === "low") {
          // Show soft-miss "Did you mean...?" with curated suggestions
          setSuggestions(result.suggestions || []);
          setStep("soft-miss");
        } else {
          // Good match (high/medium confidence) — proceed to result screen
          // Even if mergeOk is false (GPS distance), we show result then recreate
          setStep("result");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Match failed:", e);
        // On API error, try to fetch nearby spots for soft-miss fallback
        getSpots()
          .then((spots) => {
            setSpotsCache(spots); // Cache for goToSuggestion navigation
            const nearby: SoftMissSuggestion[] = spots
              .slice(0, 3)
              .map((s) => ({
                spotId: s.spotId,
                filmTitle: "Unknown",
                neighbourhood: s.neighbourhood,
                distanceM: 0,
                reason: "nearby" as const,
              }));
            if (nearby.length > 0) {
              setSuggestions(nearby);
              setStep("soft-miss");
            } else {
              setError("Couldn't reach the matcher. Try again.");
              setStep("questions");
            }
          })
          .catch(() => {
            setError("Couldn't reach the matcher. Try again.");
            setStep("questions");
          });
      });
    return () => {
      cancelled = true;
    };
  }, [step, place.lat, place.lng, movieQuery, photoDataUrl]);

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }

  function acceptPhoto(dataUrl: string) {
    stopCamera();
    setPhotoDataUrl(dataUrl);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCameraStream(stream);
    } catch (err) {
      console.error("Camera access failed:", err);
      fileInputRef.current?.click();
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    acceptPhoto(canvas.toDataURL("image/jpeg", 0.9));
  }

  async function loadDemoPhoto() {
    const response = await fetch("/demo/user-photo.jpg");
    readFile(await response.blob(), acceptPhoto);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) readFile(file, acceptPhoto);
  }

  function retake() {
    setPhotoDataUrl(null);
    setStep("capture");
  }

  // Recreate camera functions
  function stopRecreateCamera() {
    recreateCameraStream?.getTracks().forEach((track) => track.stop());
    setRecreateCameraStream(null);
  }

  async function startRecreateCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setRecreateCameraStream(stream);
    } catch (err) {
      console.error("Recreate camera access failed:", err);
      recreateFileInputRef.current?.click();
    }
  }

  function captureRecreatePhoto() {
    const video = recreateVideoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    
    // Trigger flash animation (≤300ms shutter feel)
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
      stopRecreateCamera();
      setRecreatePhotoUrl(dataUrl);
      setRecreateSubStep("stamp");
    }, 200);
  }

  function handleRecreateFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      readFile(file, (dataUrl) => {
        setRecreatePhotoUrl(dataUrl);
        setRecreateSubStep("stamp");
      });
    }
  }

  function goToRecreate() {
    setRecreatePhotoUrl(null);
    setRecreateSubStep("align");
    setStep("recreate");
    startRecreateCamera();
  }

  function backFromRecreate() {
    stopRecreateCamera();
    setRecreatePhotoUrl(null);
    setRecreateSubStep("align");
    setStep("result");
  }

  function toggleEditPlace() {
    setEditingPlace(!editingPlace);
    setPlaceError(null);
    setGeocodedPlaces([]);
    if (places.length) return;
    getSpots()
      .then((spots) => {
        const byName = new Map(spots.map((s) => [s.neighbourhood, { name: s.neighbourhood, lat: s.lat, lng: s.lng }]));
        setPlaces([...byName.values()]);
      })
      .catch(() => setPlaceError("Couldn't load places. Try again."));
  }

  // Debounced geocoding for typed place queries
  useEffect(() => {
    if (!editingPlace || placeQuery.trim().length < 2) {
      setGeocodedPlaces([]);
      return;
    }
    setIsGeocoding(true);
    const timer = setTimeout(() => {
      geocodePlace(placeQuery.trim())
        .then((results) => {
          setGeocodedPlaces(results);
          setIsGeocoding(false);
        })
        .catch(() => {
          setGeocodedPlaces([]);
          setIsGeocoding(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [placeQuery, editingPlace]);

  function pickPlace(next: Place) {
    setPlace(next);
    setEditingPlace(false);
    setPlaceQuery("");
    setGeocodedPlaces([]);
  }

  function locateWithGps() {
    if (!navigator.geolocation) {
      setPlaceError("GPS isn't available here. Pick a place instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => pickPlace({ name: "Your location", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPlaceError("Couldn't get your GPS. Pick a place instead."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function saveToMap() {
    if (!match) return;
    // Use the recreate photo for the saved stamp (not original recognize photo)
    const finalPhoto = recreatePhotoUrl || photoDataUrl;
    unlock(match.spotId);
    setSaved({ match, photo: finalPhoto, placeName: place.name });
    stopRecreateCamera();
    setJustUnlocked(true);
    setStep("map");
  }

  // Download polaroid image file with character stamp cutout
  const downloadOverlay = useCallback(async () => {
    const sourcePhoto = recreatePhotoUrl || photoDataUrl;
    if (!match || !sourcePhoto) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Load user photo
    const userImg = new Image();
    userImg.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      userImg.onload = () => resolve();
      userImg.src = sourcePhoto;
    });

    // Polaroid frame: white border with larger bottom for label
    const borderSide = 20;
    const borderTop = 20;
    const borderBottom = 64;
    const photoWidth = userImg.width;
    const photoHeight = userImg.height;
    
    canvas.width = photoWidth + borderSide * 2;
    canvas.height = photoHeight + borderTop + borderBottom;

    // White polaroid background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw user photo as polaroid body
    ctx.drawImage(userImg, borderSide, borderTop, photoWidth, photoHeight);

    // Load character stamp SVG as image for centered cutout
    const stampSvg = getStampArt(match.spotId);
    const stampImg = new Image();
    const svgBlob = new Blob([stampSvg], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    await new Promise<void>((resolve) => {
      stampImg.onload = () => resolve();
      stampImg.onerror = () => resolve();
      stampImg.src = svgUrl;
    });
    URL.revokeObjectURL(svgUrl);

    if (stampImg.complete && stampImg.naturalWidth > 0) {
      // Draw character stamp centered (40% of photo width)
      const stampSize = Math.min(photoWidth, photoHeight) * 0.4;
      const stampX = borderSide + (photoWidth - stampSize) / 2;
      const stampY = borderTop + (photoHeight - stampSize) / 2;

      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(stampImg, stampX, stampY, stampSize, stampSize);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    // Film title in bottom polaroid area
    ctx.font = "italic 20px Georgia, serif";
    ctx.fillStyle = "#2a241f";
    ctx.textAlign = "center";
    ctx.fillText(match.filmTitle, canvas.width / 2, canvas.height - borderBottom / 2 + 6);
    
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#8a8580";
    ctx.fillText(String(match.year), canvas.width / 2, canvas.height - borderBottom / 2 + 24);

    // Download as real image file (data URL a-download)
    const link = document.createElement("a");
    link.download = `frame-one-${match.spotId}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.92);
    link.click();
  }, [match, photoDataUrl, recreatePhotoUrl]);

  function openMap() {
    stopCamera();
    setJustUnlocked(false);
    setStep("map");
  }

  function startOver() {
    setPhotoDataUrl(null);
    setMatch(null);
    setMovieQuery("");
    setJustUnlocked(false);
    setStep("capture");
  }

  if (step === "capture") {
    const mode = cameraStream ? "camera" : photoDataUrl ? "preview" : "empty";
    return (
      <div className="screen capture">
        <div className="location-pill">
          <span className="dot blink" />
          <span className="location-name">{place.name}</span>
        </div>

        <div className="capture-well">
          {mode === "camera" && <video ref={videoRef} autoPlay playsInline muted className="well-media" />}
          {mode === "preview" && photoDataUrl && <img src={photoDataUrl} alt="Your photo" className="well-media" />}
          {mode !== "preview" && (
            <div className="camera-brackets" aria-hidden="true">
              <span className="bracket tl" />
              <span className="bracket tr" />
              <span className="bracket bl" />
              <span className="bracket br" />
            </div>
          )}
        </div>

        <p className="instruction">{mode === "preview" ? "Ready to find the scene?" : "Point at somewhere you've seen in a film"}</p>

        <div className="shutter-row">
          {mode === "preview" ? (
            <>
              <button type="button" className="round-button" onClick={() => setPhotoDataUrl(null)} aria-label="Retake">
                <RetakeIcon />
              </button>
              <button type="button" className="shutter wide" onClick={() => setStep("questions")}>
                Continue
              </button>
            </>
          ) : (
            <>
              <button type="button" className="round-button demo-thumb" onClick={loadDemoPhoto} aria-label="Use the demo photo" />
              <button type="button" className="shutter" onClick={mode === "camera" ? capturePhoto : startCamera} aria-label="Take the photo">
                <svg width="30" height="30" viewBox="0 0 20 20" fill="none" stroke="#FFFFFF" strokeWidth="1.8" aria-hidden="true">
                  <rect x="2" y="5.5" width="16" height="11.5" rx="3" />
                  <circle cx="10" cy="11.2" r="3.4" />
                  <path d="M7.4 5.5 8.7 3.2h2.6l1.3 2.3" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <button type="button" className="round-button" onClick={() => fileInputRef.current?.click()} aria-label="Upload a photo">
            <UploadIcon />
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileUpload} />
        <Dock active="shoot" onShoot={() => {}} onMap={openMap} />
      </div>
    );
  }

  if (step === "questions") {
    return (
      <form
        className="screen questions"
        onSubmit={(e) => {
          e.preventDefault();
          if (!movieQuery.trim()) return;
          setError(null);
          setStep("scanning");
        }}
      >
        <button type="button" onClick={retake} className="back-link">
          Retake
        </button>

        {photoDataUrl && <img src={photoDataUrl} alt="Your photo" className="context-photo" />}

        <div className="location-card">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="9" fill="var(--action, #e87a2a)" />
            <path d="m5.6 10.3 2.9 2.8 5.9-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="location-info">
            <span className="micro-label">Where you are</span>
            <span className="location-title">{place.name}</span>
          </div>
          <button type="button" className="edit-button" onClick={toggleEditPlace} aria-expanded={editingPlace} aria-controls="place-editor">
            {editingPlace ? "Done" : "Edit"}
          </button>
        </div>

        {editingPlace && (
          <div id="place-editor" className="place-editor">
            <input
              type="search"
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Search a place (Times Square, Radio City...)"
              className="place-search"
              aria-label="Search a place in NYC"
              autoFocus
            />
            <div className="place-options">
              <button type="button" className="place-option gps" onClick={locateWithGps}>
                Use my GPS
              </button>
              {isGeocoding && placeQuery.trim().length >= 2 && (
                <span className="place-hint">Searching...</span>
              )}
              {geocodedPlaces.length > 0 && (
                <>
                  <span className="place-section-label">Map results</span>
                  {geocodedPlaces.map((p, i) => (
                    <button
                      key={`geo-${i}-${p.lat}-${p.lng}`}
                      type="button"
                      className="place-option geocoded"
                      onClick={() => pickPlace(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              {placeQuery.trim().length < 2 && geocodedPlaces.length === 0 && (
                <>
                  <span className="place-section-label">Quick picks</span>
                  {places.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className={`place-option${p.name === place.name ? " selected" : ""}`}
                      onClick={() => pickPlace(p)}
                    >
                      {p.name}
                    </button>
                  ))}
                </>
              )}
              {placeQuery.trim().length >= 2 && geocodedPlaces.length === 0 && !isGeocoding && (
                <span className="place-hint">No places found. Try another search.</span>
              )}
            </div>
            {placeError && <p className="form-error">{placeError}</p>}
          </div>
        )}

        <h1 className="question-title">Know what was filmed here?</h1>
        <p className="question-subtitle">Name the film. We'll find the scene.</p>

        <label htmlFor="movie-input" className="micro-label">
          The film
        </label>
        <input
          id="movie-input"
          type="text"
          value={movieQuery}
          onChange={(e) => setMovieQuery(e.target.value)}
          placeholder="e.g. The Amazing Spider-Man 2"
          className="movie-input"
          autoComplete="off"
          autoFocus
        />
        {error && <p className="form-error">{error}</p>}

        <div className="spacer" />

        <button type="submit" disabled={!movieQuery.trim()} className="primary-button">
          Find the scene
        </button>
      </form>
    );
  }

  if (step === "scanning") {
    return (
      <div className="screen scanning">
        <div className="frozen-frame">
          {photoDataUrl && <img src={photoDataUrl} alt="" />}
          <div className="scan-line" />
        </div>

        <h1 className="scanning-title">Reading the frame</h1>
        <p className="scanning-subtitle">
          {place.name}, narrowing on “{movieQuery}”.
        </p>

        <div className="scanning-steps">
          <div className="step done">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" fill="var(--action, #e87a2a)" />
              <path d="m5.6 10.3 2.9 2.8 5.9-6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Scenes filmed near you</span>
          </div>
          <div className="step active">
            <span className="spinner" />
            <span>Matching the skyline</span>
          </div>
          <div className="step waiting">
            <span className="spinner" />
            <span>Locking the camera position</span>
          </div>
        </div>

        <div className="spacer" />
        <button type="button" onClick={() => setStep("questions")} className="text-link">
          Cancel
        </button>
      </div>
    );
  }

  if (step === "result" && match) {
    // Softer copy for medium confidence
    const verdictCopy = match.matchConfidence === "high" ? "Exact match." : "Strong match.";
    
    return (
      <div className="screen result">
        <button type="button" onClick={retake} className="back-button" aria-label="Back to the camera">
          <BackIcon />
        </button>

        <h1 className="verdict">{verdictCopy}</h1>

        <div className="frame-row">
          <figure className="frame-col">
            <div className="frame-well">{photoDataUrl && <img src={photoDataUrl} alt="Your photo" />}</div>
            <figcaption className="frame-label">Yours</figcaption>
          </figure>
          <figure className="frame-col">
            <div className="frame-well">
              <img src={match.stillUrl} alt={`Still from ${match.filmTitle}`} />
              <video autoPlay muted loop playsInline aria-hidden="true">
                <source src={`/assets/spots/${match.spotId}/clip.mp4`} type="video/mp4" />
                <source src={`/assets/spots/${match.spotId}/clip.webm`} type="video/webm" />
              </video>
            </div>
            <figcaption className="frame-label">Film</figcaption>
          </figure>
        </div>

        <div className="film-card">
          <h2 className="film-title">{match.filmTitle}</h2>
          <div className="film-meta">{match.year} · Filmed right where you're standing.</div>
        </div>

        <button type="button" onClick={goToRecreate} className="primary-button">
          Recreate this shot
        </button>
      </div>
    );
  }

  // Navigate to a suggested spot (soft-miss row click) — goes to map centered on that spot
  function goToSuggestion(suggestion: SoftMissSuggestion) {
    // Look up spot coordinates and navigate to map
    const lookupAndNavigate = (spots: typeof spotsCache) => {
      const spot = spots.find((s) => s.spotId === suggestion.spotId);
      if (spot) {
        setPlace({ name: spot.neighbourhood, lat: spot.lat, lng: spot.lng });
      }
      stopCamera();
      setJustUnlocked(false);
      setStep("map");
    };

    if (spotsCache.length > 0) {
      lookupAndNavigate(spotsCache);
    } else {
      getSpots()
        .then((spots) => {
          setSpotsCache(spots);
          lookupAndNavigate(spots);
        })
        .catch(() => {
          // Fallback: go to map without centering on spot
          stopCamera();
          setJustUnlocked(false);
          setStep("map");
        });
    }
  }

  // Soft-miss: ONLY when matchConfidence === "low" (wrong/weak film match)
  // Shows "Did you mean...?" with curated alternatives
  if (step === "soft-miss") {
    return (
      <div className="screen soft-miss">
        <button type="button" onClick={retake} className="back-button" aria-label="Back to the camera">
          <BackIcon />
        </button>

        <h1 className="soft-miss-title">Did you mean…?</h1>
        <p className="soft-miss-subtitle">
          We couldn't match that film here. Try one of these nearby spots instead.
        </p>

        {photoDataUrl && <img src={photoDataUrl} alt="Your photo" className="soft-miss-photo" />}

        {suggestions.length > 0 && (
          <div className="nearby-section">
            <div className="micro-label">Movie spots nearby</div>
            <div className="nearby-list">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.spotId}
                  type="button"
                  className="nearby-item"
                  onClick={() => goToSuggestion(suggestion)}
                >
                  <span className="nearby-icon">?</span>
                  <span className="nearby-text">
                    <span className="nearby-film">{suggestion.filmTitle}</span>
                    <span className="nearby-area">
                      {suggestion.neighbourhood}
                      {suggestion.distanceM > 0 && ` · ${Math.round(suggestion.distanceM)}m`}
                    </span>
                  </span>
                  <span className="nearby-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="spacer" />

        <button type="button" onClick={retake} className="primary-button">
          Try again
        </button>
        <button type="button" onClick={openMap} className="text-link">
          Go to map
        </button>
      </div>
    );
  }

  if (step === "recreate" && match) {
    // Sub-step "align": camera with ghost overlay for alignment
    if (recreateSubStep === "align") {
      return (
        <div className="screen recreate recreate-align">
          <div className="recreate-header">
            <button type="button" onClick={backFromRecreate} className="back-button" aria-label="Back to the match">
              <BackIcon />
            </button>
            <h1 className="recreate-title">Line up with the scene</h1>
          </div>

          <div className="align-viewfinder">
            {recreateCameraStream ? (
              <video
                ref={recreateVideoRef}
                autoPlay
                playsInline
                muted
                className="align-camera"
              />
            ) : (
              <div className="align-placeholder">
                <p>Camera not available</p>
                <button type="button" className="secondary-button" onClick={() => recreateFileInputRef.current?.click()}>
                  Upload a photo
                </button>
              </div>
            )}
            <div className="align-ghost-wrap">
              <img src={match.stillUrl} alt={`Still from ${match.filmTitle}`} className="align-ghost" />
            </div>
            {showFlash && <div className="capture-flash" />}
          </div>

          <p className="align-hint">Move until the scene aligns, then capture.</p>

          <div className="recreate-actions">
            <button
              type="button"
              onClick={captureRecreatePhoto}
              className="primary-button"
              disabled={!recreateCameraStream}
            >
              Capture
            </button>
            <button type="button" className="text-link" onClick={() => recreateFileInputRef.current?.click()}>
              Or upload a photo
            </button>
          </div>

          <input
            ref={recreateFileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleRecreateFileUpload}
            hidden
          />
        </div>
      );
    }

    // Sub-step "stamp": polaroid composite, ready for save/download
    return (
      <div className="screen recreate recreate-stamp">
        <div className="recreate-header">
          <button type="button" onClick={() => { setRecreateSubStep("align"); startRecreateCamera(); }} className="back-button" aria-label="Retake">
            <BackIcon />
          </button>
          <h1 className="recreate-title">Your polaroid</h1>
        </div>

        <div className="polaroid-frame">
          <div className="polaroid-photo">
            {recreatePhotoUrl && <img src={recreatePhotoUrl} alt="Your recreated photo" className="polaroid-base" />}
            <div className="polaroid-cutout-wrap">
              <div className="polaroid-stamp" dangerouslySetInnerHTML={{ __html: getStampArt(match.spotId) }} />
            </div>
          </div>
          <div className="polaroid-label">
            <span className="polaroid-film">{match.filmTitle}</span>
            <span className="polaroid-year">{match.year}</span>
          </div>
        </div>

        <p className="merge-copy">
          Your polaroid with the character stamp. Save it to your map!
        </p>

        <div className="recreate-actions">
          <button type="button" onClick={saveToMap} className="primary-button">
            Stamp &amp; save
          </button>
          <button type="button" onClick={downloadOverlay} className="secondary-button">
            <ShareIcon />
            Download
          </button>
        </div>
      </div>
    );
  }

  if (step === "map") {
    return (
      <MapView
        saved={saved}
        unlocking={justUnlocked}
        home={place}
        unlocks={unlocks}
        onShoot={startOver}
        dock={<Dock className="dock-floating" active="map" onShoot={startOver} onMap={() => {}} />}
      />
    );
  }

  return null;
}
