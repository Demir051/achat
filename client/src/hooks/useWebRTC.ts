import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";
import { useSettings } from "../store/settings";
import type { VoiceParticipant } from "../types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type TrackPurpose = "mic" | "screenVideo" | "screenAudio";

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
  const sendersRef = useRef<Map<string, Map<TrackPurpose, RTCRtpSender>>>(new Map());
  const remoteStreamMapRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef<Set<string>>(new Set());

  const syncRemoteStreams = useCallback(() => {
    const list: RemoteStream[] = [];
    peersRef.current.forEach((pc, socketId) => {
      const p = participants.find((x) => x.socketId === socketId);
      if (!p) return;
      const receivers = pc.getReceivers().filter((r) => r.track);
      if (!receivers.length) return;

      let stream = remoteStreamMapRef.current.get(socketId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamMapRef.current.set(socketId, stream);
      }

      const activeTrackIds = new Set(receivers.map((r) => r.track!.id));
      stream.getTracks().forEach((track) => {
        if (!activeTrackIds.has(track.id)) stream!.removeTrack(track);
      });
      receivers.forEach((r) => {
        const track = r.track!;
        if (!stream!.getTracks().some((t) => t.id === track.id)) {
          stream!.addTrack(track);
        }
      });

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

  const getSenderMap = useCallback((remoteSocketId: string) => {
    let map = sendersRef.current.get(remoteSocketId);
    if (!map) {
      map = new Map();
      sendersRef.current.set(remoteSocketId, map);
    }
    return map;
  }, []);

  const setTrackOnPeer = useCallback(
    (
      pc: RTCPeerConnection,
      remoteSocketId: string,
      purpose: TrackPurpose,
      track: MediaStreamTrack | null,
      stream: MediaStream
    ) => {
      const map = getSenderMap(remoteSocketId);
      const existing = map.get(purpose);

      if (!track) {
        if (existing) {
          pc.removeTrack(existing);
          map.delete(purpose);
        }
        return;
      }

      if (existing) {
        void existing.replaceTrack(track);
        return;
      }

      const sender = pc.addTrack(track, stream);
      map.set(purpose, sender);
    },
    [getSenderMap]
  );

  const addTracksToPeer = useCallback(
    (pc: RTCPeerConnection, remoteSocketId: string) => {
      const mic = localStreamRef.current;
      const screen = screenStreamRef.current;

      const micTrack = mic?.getAudioTracks()[0] ?? null;
      setTrackOnPeer(pc, remoteSocketId, "mic", micTrack, mic ?? new MediaStream());

      const screenVideo = screen?.getVideoTracks()[0] ?? null;
      setTrackOnPeer(pc, remoteSocketId, "screenVideo", screenVideo, screen ?? new MediaStream());

      const screenAudio = screen?.getAudioTracks()[0] ?? null;
      setTrackOnPeer(pc, remoteSocketId, "screenAudio", screenAudio, screen ?? new MediaStream());
    },
    [setTrackOnPeer]
  );

  const renegotiatePeers = useCallback(async () => {
    const socket = getSocket();
    if (!socket?.id) return;

    for (const [remoteSocketId, pc] of peersRef.current) {
      if (socket.id >= remoteSocketId) continue;
      if (makingOfferRef.current.has(remoteSocketId)) continue;
      if (pc.signalingState !== "stable") continue;

      makingOfferRef.current.add(remoteSocketId);
      try {
        addTracksToPeer(pc, remoteSocketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:signal", {
          to: remoteSocketId,
          data: { type: "offer", sdp: offer },
        });
      } catch {
        /* ignore */
      } finally {
        makingOfferRef.current.delete(remoteSocketId);
      }
    }
  }, [addTracksToPeer]);

  const createPeer = useCallback(
    (remoteSocketId: string) => {
      if (peersRef.current.has(remoteSocketId)) return peersRef.current.get(remoteSocketId)!;

      const socket = getSocket();
      const isInitiator = socket?.id ? socket.id < remoteSocketId : false;

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
        if (!isInitiator || makingOfferRef.current.has(remoteSocketId)) return;
        if (pc.signalingState !== "stable") return;
        makingOfferRef.current.add(remoteSocketId);
        try {
          addTracksToPeer(pc, remoteSocketId);
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

      addTracksToPeer(pc, remoteSocketId);
      return pc;
    },
    [addTracksToPeer, syncRemoteStreams]
  );

  const handleSignal = useCallback(
    async (from: string, data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      let pc = peersRef.current.get(from);
      if (!pc) pc = createPeer(from);

      if (data.type === "offer" && data.sdp) {
        if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        addTracksToPeer(pc, from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit("webrtc:signal", { to: from, data: { type: "answer", sdp: answer } });
      } else if (data.type === "answer" && data.sdp) {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
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
    makingOfferRef.current.clear();
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    sendersRef.current.clear();
    remoteStreamMapRef.current.clear();
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

    peersRef.current.forEach((pc, remoteSocketId) => {
      setTrackOnPeer(pc, remoteSocketId, "screenVideo", null, new MediaStream());
      setTrackOnPeer(pc, remoteSocketId, "screenAudio", null, new MediaStream());
    });

    void renegotiatePeers();
    if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: false });
  }, [channelId, renegotiatePeers, setTrackOnPeer]);

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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // Chrome tab/system audio capture (not in all TS DOM typings)
          suppressLocalAudioPlayback: false,
        } as MediaTrackConstraints,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);

      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare(), { once: true });

      peersRef.current.forEach((pc, remoteSocketId) => {
        addTracksToPeer(pc, remoteSocketId);
      });

      await renegotiatePeers();

      if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: true });
      return true;
    } catch {
      return false;
    }
  }, [addTracksToPeer, channelId, renegotiatePeers, stopScreenShare]);

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    if (!socket) return;

    participants.forEach((p) => {
      if (p.socketId !== socket.id && !peersRef.current.has(p.socketId)) {
        createPeer(p.socketId);
      }
    });

    peersRef.current.forEach((_, socketId) => {
      if (!participants.some((p) => p.socketId === socketId)) {
        peersRef.current.get(socketId)?.close();
        peersRef.current.delete(socketId);
        sendersRef.current.delete(socketId);
        remoteStreamMapRef.current.delete(socketId);
      }
    });
    syncRemoteStreams();
  }, [channelId, participants, createPeer, syncRemoteStreams]);

  useEffect(() => {
    if (!channelId || !localStream) return;
    peersRef.current.forEach((pc, remoteSocketId) => addTracksToPeer(pc, remoteSocketId));
  }, [channelId, localStream, addTracksToPeer]);

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
  };
}
