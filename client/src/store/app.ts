import { create } from "zustand";
import { api } from "../lib/api";
import type { Channel, ServerDetail, ServerSummary } from "../types";

type View =
  | { kind: "home" }
  | { kind: "server"; serverId: string };

function lastServerKey(userId: string) {
  return `achat_last_server_${userId}`;
}

function lastChannelKey(userId: string, serverId: string) {
  return `achat_last_channel_${userId}_${serverId}`;
}

function persistSession(userId: string, serverId: string, channelId?: string) {
  localStorage.setItem(lastServerKey(userId), serverId);
  if (channelId) {
    localStorage.setItem(lastChannelKey(userId, serverId), channelId);
  }
}

interface AppState {
  servers: ServerSummary[];
  view: View;
  activeServer: ServerDetail | null;
  activeChannel: Channel | null;
  activeDmUserId: string | null;
  unreadDmIds: string[];
  ready: boolean;
  sessionUserId: string | null;

  loadServers: () => Promise<void>;
  restoreSession: (userId: string) => Promise<void>;
  openHome: () => void;
  openServer: (serverId: string, channelId?: string) => Promise<void>;
  refreshActiveServer: () => Promise<void>;
  setActiveChannel: (channel: Channel) => void;
  setActiveDm: (userId: string | null) => void;
  addUnreadDm: (userId: string) => void;
  addServer: (server: ServerSummary) => void;
  reset: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  servers: [],
  view: { kind: "home" },
  activeServer: null,
  activeChannel: null,
  activeDmUserId: null,
  unreadDmIds: [],
  ready: false,
  sessionUserId: null,

  loadServers: async () => {
    const { data } = await api.get("/servers");
    set({ servers: data.servers });
  },

  restoreSession: async (userId) => {
    set({ sessionUserId: userId });
    await get().loadServers();
    const lastServerId = localStorage.getItem(lastServerKey(userId));
    const servers = get().servers;

    if (lastServerId && servers.some((s) => s.id === lastServerId)) {
      const lastChannelId = localStorage.getItem(lastChannelKey(userId, lastServerId)) ?? undefined;
      await get().openServer(lastServerId, lastChannelId);
    }

    set({ ready: true });
  },

  openHome: () => {
    set({ view: { kind: "home" }, activeServer: null, activeChannel: null });
  },

  openServer: async (serverId, channelId) => {
    set({ view: { kind: "server", serverId }, activeDmUserId: null });
    const { data } = await api.get(`/servers/${serverId}`);
    const server: ServerDetail = data.server;
    const channel =
      (channelId ? server.channels.find((c) => c.id === channelId) : null) ??
      server.channels.find((c) => c.type === "TEXT") ??
      null;
    set({ activeServer: server, activeChannel: channel });

    const userId = get().sessionUserId;
    if (userId) persistSession(userId, serverId, channel?.id);
  },

  refreshActiveServer: async () => {
    const current = get().activeServer;
    if (!current) return;
    const { data } = await api.get(`/servers/${current.id}`);
    set({ activeServer: data.server });
  },

  setActiveChannel: (channel) => {
    const state = get();
    set({ activeChannel: channel });
    const userId = state.sessionUserId;
    if (userId && state.view.kind === "server") {
      persistSession(userId, state.view.serverId, channel.id);
    }
  },

  setActiveDm: (userId) => {
    if (userId) {
      set((s) => ({
        activeDmUserId: userId,
        unreadDmIds: s.unreadDmIds.filter((id) => id !== userId),
      }));
    } else {
      set({ activeDmUserId: null });
    }
  },

  addUnreadDm: (userId) => {
    set((s) => {
      if (s.activeDmUserId === userId || s.unreadDmIds.includes(userId)) return s;
      return { unreadDmIds: [...s.unreadDmIds, userId] };
    });
  },

  addServer: (server) => set((s) => ({ servers: [...s.servers, server] })),

  reset: () =>
    set({
      servers: [],
      view: { kind: "home" },
      activeServer: null,
      activeChannel: null,
      activeDmUserId: null,
      unreadDmIds: [],
      ready: false,
      sessionUserId: null,
    }),
}));
