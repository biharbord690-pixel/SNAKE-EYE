import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, Sparkles, Mic } from "lucide-react";

export type VideoStateValue = "idle" | "thinking" | "talking";

interface VideoStateManagerProps {
  state: VideoStateValue;
  className?: string;
}

export function VideoStateManager({ state, className = "" }: VideoStateManagerProps) {
  const [loadError, setLoadError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Map state to video source path
  const getVideoSrc = (s: VideoStateValue) => {
    if (s === "thinking") return "/thinking.mp4";
    if (s === "talking") return "/talking.mp4";
    return "/idle.mp4";
  };

  // Sync state with HTML video player source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const targetSrc = getVideoSrc(state);
    
    // Only update and play if source actually changed
    if (video.getAttribute("src") !== targetSrc) {
      setLoadError(false); // clear any previous error on transition
      video.src = targetSrc;
      video.load(); // force load the new stream
    }

    // Try to autoplay
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        console.warn("Autoplay muted video play() was blocked or interrupted:", err);
      }
    };

    // Small delay to let source load
    const playTimeout = setTimeout(playVideo, 50);
    return () => clearTimeout(playTimeout);
  }, [state]);

  // Handle mobile user gesture to force play video on first touch/tap anywhere on screen
  useEffect(() => {
    const handleGestureWakeup = () => {
      const video = videoRef.current;
      if (video && video.paused) {
        video.play().catch((err) => {
          console.warn("Gesture play wake up failed:", err);
        });
      }
    };

    window.addEventListener("click", handleGestureWakeup);
    window.addEventListener("touchstart", handleGestureWakeup);
    return () => {
      window.removeEventListener("click", handleGestureWakeup);
      window.removeEventListener("touchstart", handleGestureWakeup);
    };
  }, []);

  const handleVideoError = () => {
    console.warn(`Video for state ${state} failed to load. Initiating backup visuals.`);
    setLoadError(true);
  };

  return (
    <div className={`relative w-full h-full rounded-full overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center ${className}`}>
      
      {/* Decorative cyber crosshairs always visible in the background */}
      <div className="absolute inset-4 border border-white/5 rounded-full pointer-events-none" />
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/5 pointer-events-none" />
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/5 pointer-events-none" />

      {/* SINGLE HIGHLY OPTIMIZED VIDEO PLAYER FOR MOBILE COMPATIBILITY */}
      <video
        ref={videoRef}
        src={getVideoSrc(state)}
        loop
        muted
        playsInline
        autoPlay
        onError={handleVideoError}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
          !loadError ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none"
        }`}
      />

      {/* PROCEDURAL FUTURISTIC FALLBACKS (If videos fail to load or are missing from disk) */}
      <AnimatePresence mode="wait">
        {loadError && (
          <motion.div
            key={`fallback-${state}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute z-20 flex flex-col items-center justify-center text-center p-4 h-full w-full bg-slate-950/90"
          >
            {state === "idle" && (
              <motion.div 
                animate={{ 
                  scale: [0.97, 1.03, 0.97],
                  y: [0, -3, 0]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex flex-col items-center justify-center gap-1"
              >
                <div className="w-24 h-24 rounded-full border border-pink-500/40 bg-pink-950/10 flex items-center justify-center relative shadow-[0_0_25px_rgba(255,10,84,0.15)]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                    className="absolute inset-1.5 border border-dashed border-cyan-400/40 rounded-full"
                  />
                  <motion.div 
                    animate={{ 
                      x: [0, 4, -4, 0, 2, -2, 0],
                      y: [0, -2, 2, 0, -1, 1, 0]
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      repeatType: "mirror",
                      ease: "easeInOut"
                    }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(255,10,84,0.5)]"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-950 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    </div>
                  </motion.div>
                </div>
                <span className="text-[10px] font-mono tracking-[0.2em] text-pink-500/80 mt-4 animate-pulse uppercase">COSMIC IDLE</span>
              </motion.div>
            )}

            {state === "thinking" && (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 border-2 border-transparent border-t-pink-500 border-b-cyan-400 rounded-full shadow-[0_0_20px_rgba(255,10,84,0.3)]"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-4 border-2 border-transparent border-l-purple-500 border-r-cyan-400 rounded-full shadow-[0_0_15px_rgba(189,83,237,0.3)]"
                  />
                  <motion.div
                    animate={{ scale: [0.9, 1.1, 0.9] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="text-purple-400"
                  >
                    <Brain className="w-8 h-8 filter drop-shadow-[0_0_8px_rgba(189,83,237,0.6)]" />
                  </motion.div>
                </div>
                <span className="text-[10px] font-mono tracking-[0.2em] text-purple-400 font-bold animate-pulse uppercase">Neurolinking...</span>
              </div>
            )}

            {state === "talking" && (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 h-16">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const durations = [0.4, 0.65, 0.5, 0.8, 0.45, 0.7, 0.55, 0.6];
                    return (
                      <motion.div
                        key={i}
                        animate={{ height: [12, 54, 12] }}
                        transition={{
                          repeat: Infinity,
                          duration: durations[i % durations.length],
                          ease: "easeInOut",
                        }}
                        className="w-2 bg-gradient-to-t from-pink-600 via-pink-400 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(255,112,150,0.6)]"
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono tracking-[0.2em] text-[#ff7096] font-bold animate-pulse uppercase">Speaking Live</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cybernetic telemetry overlay rings styling the face border */}
      <div className="absolute inset-0 border-2 border-pink-500/10 rounded-full pointer-events-none" />
      <div className="absolute inset-1.5 border border-cyan-400/10 rounded-full pointer-events-none" />
    </div>
  );
}
