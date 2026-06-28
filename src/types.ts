export interface StealthStatus {
  active: boolean;
  photosCount: number;
  audioCount: number;
  videoCount?: number;
  lastPhotoAt: string | null;
  lastAudioAt: string | null;
  lastVideoAt?: string | null;
}

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface Position {
  x: number;
  y: number;
}

export type GameStatus = "IDLE" | "PLAYING" | "GAMEOVER";

export interface ToastMessage {
  id: string;
  type: "success" | "info" | "warning" | "error";
  message: string;
  timestamp: string;
}
