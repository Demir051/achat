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
import VoiceAudioSink from "../components/VoiceAudioSink";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";
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
  const user = useAuth((s) => s.user);
  const toast = useToast((s) => s.push);
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const participants = useVoice((s) => s.participants);
  const {
    setConnected,
    setParticipants,
    addParticipant,
    removeParticipant,
    updateParticipant,
    setRoster,
    removeUserFromRoster,
    setMuted: setStoreMuted,
    setScreenSharing: setStoreScreenSharing,
    reset,
  } = useVoice();

  const joiningRef = useRef(false);
  const socketHandlersBound = useRef(false);
  const prevScreenSharing = useRef(false);
  const webrtcRef = useRef<ReturnType<typeof useWebRTC> | null>(null);

  const webrtc = useWebRTC(connectedChannelId, participants);
  webrtcRef.current = webrtc;

  const rejoinVoice = useCallback(async (channelId: string) => {
    const socket = getSocket();
    if (!socket?.connected || joiningRef.current) return false;

    joiningRef.current = true;
    try {
      webrtcRef.current?.stopAll();
      setParticipants([]);
      const stream = await webrtcRef.current?.startLocalAudio();
      if (!stream) {
        toast("Mikrofon açılamadı", "error");
        reset();
        return false;
      }
      socket.emit("voice:join", channelId);
      return true;
    } finally {
      joiningRef.current = false;
    }
  }, [reset, setParticipants, toast]);

  // Socket dinleyicileri
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
      setRoster(channelId, list);
    };

    const onVoiceError = ({ error }: { error: string }) => {
      toast(error, "error");
      webrtcRef.current?.stopAll();
      reset();
    };

    const onDisconnect = () => {
      webrtcRef.current?.stopAll();
      setParticipants([]);
    };

    const onReconnect = () => {
      const { connectedChannelId: chId } = useVoice.getState();
      if (!chId) return;
      void rejoinVoice(chId);
    };

    socket.on("voice:participants", onParticipants);
    socket.on("voice:user-joined", onJoined);
    socket.on("voice:user-left", onLeft);
    socket.on("voice:state", onState);
    socket.on("voice:roster", onRoster);
    socket.on("voice:error", onVoiceError);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("voice:participants", onParticipants);
      socket.off("voice:user-joined", onJoined);
      socket.off("voice:user-left", onLeft);
      socket.off("voice:state", onState);
      socket.off("voice:roster", onRoster);
      socket.off("voice:error", onVoiceError);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect", onReconnect);
      socketHandlersBound.current = false;
    };
  }, [
    addParticipant,
    rejoinVoice,
    removeParticipant,
    reset,
    setParticipants,
    setRoster,
    toast,
    updateParticipant,
  ]);

  const joinVoice = useCallback(
    async (channelId: string, channelName: string) => {
      const socket = getSocket();
      if (!socket || joiningRef.current) return;

      const current = useVoice.getState().connectedChannelId;
      const hasLiveAudio = !!webrtcRef.current?.localStream;

      if (current === channelId && hasLiveAudio) return;

      joiningRef.current = true;
      try {
        if (current === channelId && !hasLiveAudio) {
          webrtcRef.current?.stopAll();
          setParticipants([]);
        }

        if (current && current !== channelId) {
          socket.emit("voice:leave", current);
          if (user?.id) removeUserFromRoster(current, user.id);
          webrtcRef.current?.stopAll();
          reset();
        }

        setConnected(channelId, channelName);
        setParticipants([]);

        const stream = await webrtcRef.current?.startLocalAudio();
        if (!stream) {
          toast("Mikrofon izni gerekli", "error");
          reset();
          return;
        }

        socket.emit("voice:join", channelId);
        playSound("voiceJoin");
      } finally {
        joiningRef.current = false;
      }
    },
    [removeUserFromRoster, reset, setConnected, setParticipants, toast, user?.id]
  );

  const leaveVoice = useCallback(() => {
    const socket = getSocket();
    const channelId = useVoice.getState().connectedChannelId;
    if (!channelId) return;

    socket?.emit("voice:leave", channelId);
    if (user?.id) removeUserFromRoster(channelId, user.id);
    webrtcRef.current?.stopAll();
    reset();
    playSound("voiceLeave");
  }, [removeUserFromRoster, reset, user?.id]);

  const toggleMute = useCallback(() => {
    const nowMuted = webrtcRef.current?.toggleMute();
    if (typeof nowMuted === "boolean") {
      setStoreMuted(nowMuted);
      playSound(nowMuted ? "mute" : "unmute");
    }
  }, [setStoreMuted]);

  const toggleScreenShare = useCallback(async () => {
    const nowSharing = await webrtcRef.current?.toggleScreenShare();
    if (nowSharing === true) {
      setStoreScreenSharing(true);
      playSound("screenShareStart");
    } else if (nowSharing === false && webrtcRef.current?.screenSharing === false) {
      setStoreScreenSharing(false);
    } else if (nowSharing === false) {
      toast("Ekran paylaşımı başlatılamadı", "error");
    }
  }, [setStoreScreenSharing, toast]);

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
      <VoiceAudioSink />
      {children}
    </VoiceContext.Provider>
  );
}
