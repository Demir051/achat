import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { getSocket } from "../lib/socket";
import { playSound } from "../lib/sounds";
import { useWebRTC } from "../hooks/useWebRTC";
import { useVoice } from "../store/voice";
import type { VoiceParticipant } from "../types";

interface VoiceContextValue {
  joinVoice: (channelId: string, channelName: string) => Promise<void>;
  leaveVoice: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => void;
  screenStream: MediaStream | null;
  remoteStreams: ReturnType<typeof useWebRTC>["remoteStreams"];
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceSession() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceSession VoiceProvider içinde kullanılmalı");
  return ctx;
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const participants = useVoice((s) => s.participants);
  const {
    setConnected,
    setParticipants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setMuted: setStoreMuted,
    setScreenSharing: setStoreScreenSharing,
    reset,
  } = useVoice();

  const joiningRef = useRef(false);
  const socketHandlersBound = useRef(false);
  const prevScreenSharing = useRef(false);

  const webrtc = useWebRTC(connectedChannelId, participants);

  // Socket dinleyicileri — bir kez bağlan
  useEffect(() => {
    const socket = getSocket();
    if (!socket || socketHandlersBound.current) return;
    socketHandlersBound.current = true;

    const onParticipants = ({
      channelId,
      participants: list,
    }: {
      channelId: string;
      participants: VoiceParticipant[];
    }) => {
      const active = useVoice.getState().connectedChannelId;
      if (channelId !== active) return;
      const myId = socket.id;
      setParticipants(list.filter((p) => p.socketId !== myId));
    };

    const onJoined = ({
      channelId,
      participant,
    }: {
      channelId: string;
      participant: VoiceParticipant;
    }) => {
      const active = useVoice.getState().connectedChannelId;
      if (channelId !== active || participant.socketId === socket.id) return;
      addParticipant(participant);
    };

    const onLeft = ({ channelId, socketId }: { channelId: string; socketId: string }) => {
      const active = useVoice.getState().connectedChannelId;
      if (channelId !== active) return;
      removeParticipant(socketId);
    };

    const onState = ({
      socketId,
      muted,
      screenSharing,
    }: {
      socketId: string;
      muted?: boolean;
      screenSharing?: boolean;
    }) => {
      updateParticipant(socketId, {
        ...(typeof muted === "boolean" ? { muted } : {}),
        ...(typeof screenSharing === "boolean" ? { screenSharing } : {}),
      });
    };

    const onRoster = ({
      channelId,
      participants: list,
    }: {
      channelId: string;
      participants: VoiceParticipant[];
    }) => {
      useVoice.getState().setRoster(channelId, list);
    };

    socket.on("voice:participants", onParticipants);
    socket.on("voice:user-joined", onJoined);
    socket.on("voice:user-left", onLeft);
    socket.on("voice:state", onState);
    socket.on("voice:roster", onRoster);

    return () => {
      socket.off("voice:participants", onParticipants);
      socket.off("voice:user-joined", onJoined);
      socket.off("voice:user-left", onLeft);
      socket.off("voice:state", onState);
      socket.off("voice:roster", onRoster);
      socketHandlersBound.current = false;
    };
  }, [addParticipant, removeParticipant, setParticipants, updateParticipant]);

  const joinVoice = useCallback(
    async (channelId: string, channelName: string) => {
      const socket = getSocket();
      if (!socket || joiningRef.current) return;

      const current = useVoice.getState().connectedChannelId;
      if (current === channelId) return;

      joiningRef.current = true;
      try {
        if (current) {
          socket.emit("voice:leave", current);
          webrtc.stopAll();
          reset();
        }

        setConnected(channelId, channelName);
        setParticipants([]);
        await webrtc.startLocalAudio();
        socket.emit("voice:join", channelId);
        playSound("voiceJoin");
      } finally {
        joiningRef.current = false;
      }
    },
    [reset, setConnected, setParticipants, webrtc]
  );

  const leaveVoice = useCallback(() => {
    const socket = getSocket();
    const channelId = useVoice.getState().connectedChannelId;
    if (!channelId) return;

    socket?.emit("voice:leave", channelId);
    webrtc.stopAll();
    reset();
    playSound("voiceLeave");
  }, [reset, webrtc]);

  const toggleMute = useCallback(() => {
    const nowMuted = webrtc.toggleMute();
    if (typeof nowMuted === "boolean") {
      setStoreMuted(nowMuted);
      playSound(nowMuted ? "mute" : "unmute");
    }
  }, [setStoreMuted, webrtc]);

  const toggleScreenShare = useCallback(async () => {
    const nowSharing = await webrtc.toggleScreenShare();
    if (typeof nowSharing === "boolean") {
      setStoreScreenSharing(nowSharing);
      if (nowSharing) playSound("screenShareStart");
    }
  }, [setStoreScreenSharing, webrtc]);

  // WebRTC muted/screen state senkronu
  useEffect(() => {
    setStoreMuted(webrtc.muted);
  }, [webrtc.muted, setStoreMuted]);

  useEffect(() => {
    if (prevScreenSharing.current && !webrtc.screenSharing) {
      playSound("screenShareStop");
    }
    prevScreenSharing.current = webrtc.screenSharing;
    setStoreScreenSharing(webrtc.screenSharing);
  }, [webrtc.screenSharing, setStoreScreenSharing]);

  return (
    <VoiceContext.Provider
      value={{
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleScreenShare,
        screenStream: webrtc.screenStream,
        remoteStreams: webrtc.remoteStreams,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
