import { create } from "zustand";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useSettings } from "./settings";
import { useApp } from "./app";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const token = localStorage.getItem("achat_token");
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      connectSocket(token);
      useSettings.getState().initFromUser(data.user);
      set({ user: data.user, loading: false });
    } catch {
      localStorage.removeItem("achat_token");
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (!data.token || !data.user) throw new Error("Giriş yanıtı geçersiz");
    localStorage.setItem("achat_token", data.token);
    connectSocket(data.token);
    useSettings.getState().initFromUser(data.user);
    set({ user: data.user });
  },

  register: async (username, email, password) => {
    const { data } = await api.post("/auth/register", { username, email, password });
    localStorage.setItem("achat_token", data.token);
    connectSocket(data.token);
    useSettings.getState().initFromUser(data.user);
    set({ user: data.user });
  },

  logout: () => {
    localStorage.removeItem("achat_token");
    disconnectSocket();
    useApp.getState().reset();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));
