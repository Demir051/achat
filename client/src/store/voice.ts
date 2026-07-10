import { create } from "zustand";
import type { VoiceParticipant } from "../types";

interface VoiceState {
  connectedChannelId: string | null;
  connectedChannelName: string | null;
  participants: VoiceParticipant[];
  rosters: Record<string, VoiceParticipant[]>;
  muted: boolean;
  screenSharing: boolean;

  setConnected: (channelId: string | null, channelName?: string | null) => void;
  setParticipants: (participants: VoiceParticipant[]) => void;
  addParticipant: (p: VoiceParticipant) => void;
  removeParticipant: (socketId: string) => void;
  updateParticipant: (socketId: string, patch: Partial<VoiceParticipant>) => void;
  setRoster: (channelId: string, participants: VoiceParticipant[]) => void;
  setMuted: (muted: boolean) => void;
  setScreenSharing: (screenSharing: boolean) => void;
  reset: () => void;
}

export const useVoice = create<VoiceState>((set) => ({
  connectedChannelId: null,
  connectedChannelName: null,
  participants: [],
  rosters: {},
  muted: false,
  screenSharing: false,

  setConnected: (channelId, channelName = null) =>
    set({ connectedChannelId: channelId, connectedChannelName: channelName }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (p) =>
    set((s) => ({
      participants: s.participants.some((x) => x.socketId === p.socketId)
        ? s.participants
        : [...s.participants, p],
    })),

  removeParticipant: (socketId) =>
    set((s) => ({ participants: s.participants.filter((p) => p.socketId !== socketId) })),

  updateParticipant: (socketId, patch) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.socketId === socketId ? { ...p, ...patch } : p
      ),
    })),

  setRoster: (channelId, participants) =>
    set((s) => ({ rosters: { ...s.rosters, [channelId]: participants } })),

  setMuted: (muted) => set({ muted }),
  setScreenSharing: (screenSharing) => set({ screenSharing }),

  reset: () =>
    set({
      connectedChannelId: null,
      connectedChannelName: null,
      participants: [],
      muted: false,
      screenSharing: false,
    }),
}));
