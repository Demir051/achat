import { create } from "zustand";
import { applyTheme } from "../themes";

interface SettingsState {
  theme: string;
  micDeviceId: string;
  speakerDeviceId: string;
  peerVolumes: Record<string, number>;
  peerScreenVolumes: Record<string, number>;
  setTheme: (theme: string) => void;
  setMicDevice: (id: string) => void;
  setSpeakerDevice: (id: string) => void;
  setPeerVolume: (userId: string, volume: number) => void;
  setPeerScreenVolume: (userId: string, volume: number) => void;
  getPeerVolume: (userId: string) => number;
  getPeerScreenVolume: (userId: string) => number;
  initFromUser: (user: { theme?: string; micDeviceId?: string; speakerDeviceId?: string }) => void;
}

function loadPeerScreenVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem("achat_peer_screen_volumes");
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function loadPeerVolumes(): Record<string, number> {
  try {
    const raw = localStorage.getItem("achat_peer_volumes");
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

const savedRaw = localStorage.getItem("achat_theme") ?? "midnight";
const savedTheme = savedRaw === "matrix" ? "midnight" : savedRaw;
applyTheme(savedTheme);

export const useSettings = create<SettingsState>((set, get) => ({
  theme: savedTheme,
  micDeviceId: localStorage.getItem("achat_mic") ?? "",
  speakerDeviceId: localStorage.getItem("achat_speaker") ?? "",
  peerVolumes: loadPeerVolumes(),
  peerScreenVolumes: loadPeerScreenVolumes(),

  setTheme: (theme) => {
    localStorage.setItem("achat_theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  setMicDevice: (id) => {
    localStorage.setItem("achat_mic", id);
    set({ micDeviceId: id });
  },

  setSpeakerDevice: (id) => {
    localStorage.setItem("achat_speaker", id);
    set({ speakerDeviceId: id });
  },

  setPeerVolume: (userId, volume) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    set((s) => {
      const peerVolumes = { ...s.peerVolumes, [userId]: clamped };
      localStorage.setItem("achat_peer_volumes", JSON.stringify(peerVolumes));
      return { peerVolumes };
    });
  },

  setPeerScreenVolume: (userId, volume) => {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    set((s) => {
      const peerScreenVolumes = { ...s.peerScreenVolumes, [userId]: clamped };
      localStorage.setItem("achat_peer_screen_volumes", JSON.stringify(peerScreenVolumes));
      return { peerScreenVolumes };
    });
  },

  getPeerVolume: (userId) => get().peerVolumes[userId] ?? 100,

  getPeerScreenVolume: (userId) => get().peerScreenVolumes[userId] ?? 100,

  initFromUser: (user) => {
    if (user.theme) {
      const theme = user.theme === "matrix" ? "midnight" : user.theme;
      localStorage.setItem("achat_theme", theme);
      applyTheme(theme);
      set({ theme });
    }
    if (user.micDeviceId) {
      localStorage.setItem("achat_mic", user.micDeviceId);
      set({ micDeviceId: user.micDeviceId });
    }
    if (user.speakerDeviceId) {
      localStorage.setItem("achat_speaker", user.speakerDeviceId);
      set({ speakerDeviceId: user.speakerDeviceId });
    }
  },
}));
