import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";
import { useSettings } from "../store/settings";
import type { VoiceParticipant } from "../types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface RemoteStream {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  stream: MediaStream;
  screenSharing: boolean;
}

export function useWebRTC(channelId: string | null, participants: VoiceParticipant[]) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef<Set<string>>(new Set());

  const getCombinedLocal = useCallback(() => {
    const tracks: MediaStreamTrack[] = [];
    if (localStreamRef.current) tracks.push(...localStreamRef.current.getAudioTracks());
    if (screenStreamRef.current) tracks.push(...screenStreamRef.current.getVideoTracks());
    return tracks.length ? new MediaStream(tracks) : localStreamRef.current;
  }, []);

  const syncRemoteStreams = useCallback(() => {
    const list: RemoteStream[] = [];
    peersRef.current.forEach((pc, socketId) => {
      const p = participants.find((x) => x.socketId === socketId);
      if (!p) return;
      const receivers = pc.getReceivers().filter((r) => r.track);
      if (!receivers.length) return;
      const stream = new MediaStream(receivers.map((r) => r.track!));
      list.push({
        socketId,
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        stream,
        screenSharing: p.screenSharing,
      });
    });
    setRemoteStreams(list);
  }, [participants]);

  const addTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) sender.replaceTrack(track);
        else pc.addTrack(track, stream);
      });
    }
    const screen = screenStreamRef.current;
    if (screen) {
      screen.getVideoTracks().forEach((track) => {
        const existing = pc.getSenders().find((s) => s.track?.kind === "video");
        if (existing) existing.replaceTrack(track);
        else pc.addTrack(track, screen);
      });
    }
  }, []);

  const createPeer = useCallback(
    (remoteSocketId: string, initiator: boolean) => {
      if (peersRef.current.has(remoteSocketId)) return peersRef.current.get(remoteSocketId)!;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(remoteSocketId, pc);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        getSocket()?.emit("webrtc:signal", {
          to: remoteSocketId,
          data: { type: "ice", candidate: e.candidate },
        });
      };

      pc.ontrack = () => syncRemoteStreams();

      pc.onnegotiationneeded = async () => {
        if (!initiator || makingOfferRef.current.has(remoteSocketId)) return;
        makingOfferRef.current.add(remoteSocketId);
        try {
          addTracksToPeer(pc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          getSocket()?.emit("webrtc:signal", {
            to: remoteSocketId,
            data: { type: "offer", sdp: offer },
          });
        } catch {
          /* ignore */
        } finally {
          makingOfferRef.current.delete(remoteSocketId);
        }
      };

      addTracksToPeer(pc);
      return pc;
    },
    [addTracksToPeer, syncRemoteStreams]
  );

  const handleSignal = useCallback(
    async (from: string, data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      let pc = peersRef.current.get(from);
      if (!pc) pc = createPeer(from, false);

      if (data.type === "offer" && data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        addTracksToPeer(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit("webrtc:signal", { to: from, data: { type: "answer", sdp: answer } });
      } else if (data.type === "answer" && data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === "ice" && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          /* ignore */
        }
      }
      syncRemoteStreams();
    },
    [addTracksToPeer, createPeer, syncRemoteStreams]
  );

  const startLocalAudio = useCallback(async () => {
    try {
      const micId = useSettings.getState().micDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch {
      return null;
    }
  }, []);

  const stopAll = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams([]);
    setMuted(false);
    setScreenSharing(false);
  }, []);

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) pc.removeTrack(sender);
    });
    if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: false });
  }, [channelId]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    const next = !track.enabled;
    setMuted(next);
    if (channelId) {
      getSocket()?.emit("voice:state", { channelId, muted: next });
    }
    return next;
  }, [channelId]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      stopScreenShare();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);

      stream.getVideoTracks()[0].onended = () => stopScreenShare();

      peersRef.current.forEach((pc) => {
        stream.getVideoTracks().forEach((track) => {
          const existing = pc.getSenders().find((s) => s.track?.kind === "video");
          if (existing) existing.replaceTrack(track);
          else pc.addTrack(track, stream);
        });
      });

      if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: true });
      return true;
    } catch {
      return false;
    }
  }, [channelId, stopScreenShare]);

  // Yeni katılımcılar için peer bağlantısı kur
  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    if (!socket) return;

    participants.forEach((p) => {
      if (p.socketId !== socket.id && !peersRef.current.has(p.socketId)) {
        createPeer(p.socketId, true);
      }
    });

    peersRef.current.forEach((_, socketId) => {
      if (!participants.some((p) => p.socketId === socketId)) {
        peersRef.current.get(socketId)?.close();
        peersRef.current.delete(socketId);
      }
    });
    syncRemoteStreams();
  }, [channelId, participants, createPeer, syncRemoteStreams]);

  // WebRTC sinyal dinleyicisi
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId) return;

    const onSignal = ({ from, data }: { from: string; data: unknown }) => {
      handleSignal(from, data as { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit });
    };

    socket.on("webrtc:signal", onSignal);
    return () => {
      socket.off("webrtc:signal", onSignal);
    };
  }, [channelId, handleSignal]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    muted,
    screenSharing,
    startLocalAudio,
    stopAll,
    stopScreenShare,
    toggleMute,
    toggleScreenShare,
    getCombinedLocal,
  };
}
