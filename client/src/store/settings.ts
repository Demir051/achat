import { create } from "zustand";
import { applyTheme } from "../themes";

interface SettingsState {
  theme: string;
  micDeviceId: string;
  speakerDeviceId: string;
  setTheme: (theme: string) => void;
  setMicDevice: (id: string) => void;
  setSpeakerDevice: (id: string) => void;
  initFromUser: (user: { theme?: string; micDeviceId?: string; speakerDeviceId?: string }) => void;
}

const savedRaw = localStorage.getItem("achat_theme") ?? "midnight";
const savedTheme = savedRaw === "matrix" ? "midnight" : savedRaw;
applyTheme(savedTheme);

export const useSettings = create<SettingsState>((set) => ({
  theme: savedTheme,
  micDeviceId: localStorage.getItem("achat_mic") ?? "",
  speakerDeviceId: localStorage.getItem("achat_speaker") ?? "",

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
