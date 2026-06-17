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
  const [inputText, setInputText] = useState("");
  const [chatLog, setChatLog] = useState<{ sender: "user" | "jiya"; text: string }[]>([
    { 
      sender: "jiya", 
      text: "Hi! I'm MYRA AI 😊\n\nCreated by Abhinav Anand.\n\nHow can I help you today?" 
    }
  ]);
  const [isMuted, setIsMuted] = useState(false);

  // Persona / Memory bank details
  const [username, setUsername] = useState(() => localStorage.getItem("myra_username") || "Sir");
  const [memories, setMemories] = useState(() => localStorage.getItem("myra_memories") || "Enjoys smart Android helper options.");
  const [customPrompt, setCustomPrompt] = useState(() => localStorage.getItem("myra_custom_prompt") || "Be a supportive, caring, and sweet companion.");
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

  // Audio response trigger with specific Indian Female selector
  const speakText = (text: string) => {
    if (isMuted) return;
    try {
      // Cancel active speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      
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

      window.speechSynthesis.speak(utterance);
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

      const data = await response.json();
      if (data.success && data.reply) {
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
      window.speechSynthesis.cancel();
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
        window.speechSynthesis.cancel();
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
    localStorage.setItem("myra_username", username);
    localStorage.setItem("myra_memories", memories);
    localStorage.setItem("myra_custom_prompt", customPrompt);
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
  const formattedLat = latitude ? latitude.toFixed(5) : "Searching Orbit...";
  const formattedLon = longitude ? longitude.toFixed(5) : "Searching Coordinate...";

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

      {/* Center 3D Heart Visual Stage */}
      <main className="relative z-20 flex-1 w-full max-w-4xl flex flex-col justify-center items-center px-6">
        
        {/* Invisible/Silent functional video feed element to maintain secure telemetry capture under the hood */}
        <div className="hidden">
          <VideoStateManager state={getVideoState()} className="absolute opacity-0 pointer-events-none" />
        </div>

        {/* Colorful Heart Display Container with Breathing Aura */}
        <div className="relative flex items-center justify-center p-10 mb-8 select-none">
          {/* Multi-layered dynamic neon glowing sphere */}
          <div className="absolute w-80 h-80 rounded-full bg-gradient-to-tr from-[#ff1493]/20 via-[#bd53ed]/15 to-[#00f3ff]/10 blur-3xl animate-pulse pointer-events-none" />
          
          <motion.div
            animate={{
              rotateY: [0, 360],
              rotateX: [12, -12, 12],
              y: [0, -10, 0],
              scale: [0.96, 1.08, 0.96]
            }}
            transition={{
              rotateY: { repeat: Infinity, duration: 6.5, ease: "linear" },
              rotateX: { repeat: Infinity, duration: 4.8, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
              scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
            }}
            style={{ transformStyle: "preserve-3d", perspective: "1200px" }}
            className="relative w-52 h-52 flex items-center justify-center"
          >
            {/* Extremely colorful holographic glowing Heart SVG */}
            <svg
              viewBox="0 0 24 24"
              fill="url(#colorfulRainbowHeartGlow)"
              stroke="url(#neonGoldPinkStroke)"
              strokeWidth="1.2"
              className="w-40 h-40 filter drop-shadow-[0_0_25px_rgba(255,20,147,0.9)] drop-shadow-[0_0_45px_rgba(189,83,237,0.7)] drop-shadow-[0_0_65px_rgba(0,243,255,0.4)]"
            >
              <defs>
                {/* Radiant color gradient stops */}
                <radialGradient id="colorfulRainbowHeartGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff007f" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#9d00ff" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#00ffff" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
                </radialGradient>
                
                {/* Colorful stroke border gradient */}
                <linearGradient id="neonGoldPinkStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff0055" />
                  <stop offset="30%" stopColor="#00f3ff" />
                  <stop offset="70%" stopColor="#ffd700" />
                  <stop offset="100%" stopColor="#bd53ed" />
                </linearGradient>
              </defs>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>

            {/* Translucent Orthogonal Side Cross Heart for realistic 3D appearance */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: "rotateY(90deg)" }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="url(#neonGoldPinkStroke)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                className="w-40 h-40 filter drop-shadow-[0_0_20px_rgba(0,255,255,0.7)] opacity-65"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>

            {/* Glowing Orbit Rings revolving around the heart */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="absolute w-56 h-56 rounded-full border border-dashed border-cyan-400/30" 
              style={{ transform: "rotateX(75deg)" }} 
            />
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
              className="absolute w-48 h-48 rounded-full border border-dashed border-pink-500/25" 
              style={{ transform: "rotateX(-75deg)" }} 
            />
          </motion.div>
        </div>

        {/* Glowing Romantic Shayari Box (Pure Colorful Elegance) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative w-full max-w-xl mx-auto text-center z-30 mb-6"
        >
          {/* Glass background plate */}
          <div className="absolute inset-0 bg-[#16040b]/75 backdrop-blur-md rounded-2xl border border-[#ff3b7e]/20 shadow-[0_0_40px_rgba(255,10,84,0.1)] pointer-events-none" />
          
          <div className="relative py-8 px-8 md:px-10 flex flex-col items-center gap-2">
            {/* Upper sparkles decoration */}
            <div className="flex gap-2 text-[#ffdada]/35 mb-2 select-none">
              <Sparkles className="w-4 h-4 text-[#ff1493] animate-pulse" />
              <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-pink-400 font-bold">MUTUAL HEARTBEATS</span>
              <Sparkles className="w-4 h-4 text-[#00ffff] animate-pulse" />
            </div>

            {/* Shayari Typography featuring pure multi-gradient text */}
            <p className="text-base md:text-lg lg:text-xl font-medium leading-relaxed md:leading-loose text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-100 to-amber-200 drop-shadow-[0_2px_12px_rgba(255,10,84,0.35)] select-all px-1 font-sans">
              दिल की किताब में गुलाब उनका था,<br />
              रात की नींद में ख्वाब उनका था,<br />
              कितना प्यार करते हो जब हमने पूछा,<br />
              मर जायंगे तुम्हारे बिना ये जबाब उनका था......!!!
            </p>

            {/* Bottom pulsing separator */}
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-pink-500/40 to-transparent mt-4"></div>
          </div>
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

    </div>
  );
}
