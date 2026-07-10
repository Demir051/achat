import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";
import { useSettings } from "../store/settings";
import type { VoiceParticipant } from "../types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Ücretsiz TURN — farklı ağlarda (Netlify↔Render) WebRTC için gerekli
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

type TrackPurpose = "mic" | "screenVideo" | "screenAudio";

interface RemoteStream {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  stream: MediaStream;
  screenSharing: boolean;
  videoTrackId: string | null;
  audioTrackKey: string;
}

interface PeerMeta {
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

function audioTrackKey(stream: MediaStream) {
  return stream
    .getAudioTracks()
    .map((t) => t.id)
    .join(",");
}

function pickScreenVideoTrack(stream: MediaStream): MediaStreamTrack | null {
  const tracks = stream.getVideoTracks().filter((t) => t.readyState !== "ended");
  if (!tracks.length) return null;
  // Ekran paylaşımı track'i genelde displaySurface içerir
  const screen = tracks.find((t) => {
    const s = t.getSettings();
    return Boolean(s.displaySurface);
  });
  return screen ?? tracks[tracks.length - 1];
}

export function useWebRTC(channelId: string | null, participants: VoiceParticipant[]) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerMetaRef = useRef<Map<string, PeerMeta>>(new Map());
  const sendersRef = useRef<Map<string, Map<TrackPurpose, RTCRtpSender>>>(new Map());
  const remoteStreamMapRef = useRef<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const knownPeersRef = useRef<Set<string>>(new Set());

  const getPeerMeta = useCallback((remoteSocketId: string): PeerMeta => {
    let meta = peerMetaRef.current.get(remoteSocketId);
    if (!meta) {
      const socket = getSocket();
      const polite = socket?.id ? socket.id > remoteSocketId : false;
      meta = { makingOffer: false, ignoreOffer: false, polite, pendingCandidates: [] };
      peerMetaRef.current.set(remoteSocketId, meta);
    }
    return meta;
  }, []);

  const syncRemoteStreams = useCallback(() => {
    const list: RemoteStream[] = [];
    peersRef.current.forEach((pc, socketId) => {
      const p = participants.find((x) => x.socketId === socketId);
      if (!p) return;

      let stream = remoteStreamMapRef.current.get(socketId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamMapRef.current.set(socketId, stream);
      }

      // Receiver'lardan eksik track'leri ekle (ontrack yedek)
      pc.getReceivers().forEach((r) => {
        const track = r.track;
        if (!track || track.readyState === "ended") return;
        if (!stream!.getTracks().some((t) => t.id === track.id)) {
          stream!.addTrack(track);
        }
      });

      const hasMedia = stream.getTracks().some((t) => t.readyState !== "ended");
      if (!hasMedia) return;

      const videoTrack = pickScreenVideoTrack(stream);

      list.push({
        socketId,
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        stream,
        screenSharing: p.screenSharing,
        videoTrackId: videoTrack?.id ?? null,
        audioTrackKey: audioTrackKey(stream),
      });
    });
    setRemoteStreams(list);
  }, [participants]);

  const flushCandidates = useCallback(
    async (remoteSocketId: string, pc: RTCPeerConnection) => {
      const meta = getPeerMeta(remoteSocketId);
      const queued = meta.pendingCandidates.splice(0);
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          /* ignore */
        }
      }
    },
    [getPeerMeta]
  );

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
          try {
            pc.removeTrack(existing);
          } catch {
            /* ignore */
          }
          map.delete(purpose);
        }
        return;
      }

      if (purpose === "screenVideo") {
        track.contentHint = "detail";
      }

      if (existing?.track?.id === track.id) return;

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

      setTrackOnPeer(
        pc,
        remoteSocketId,
        "mic",
        mic?.getAudioTracks()[0] ?? null,
        mic ?? new MediaStream()
      );
      setTrackOnPeer(
        pc,
        remoteSocketId,
        "screenVideo",
        screen?.getVideoTracks()[0] ?? null,
        screen ?? new MediaStream()
      );
      setTrackOnPeer(
        pc,
        remoteSocketId,
        "screenAudio",
        screen?.getAudioTracks()[0] ?? null,
        screen ?? new MediaStream()
      );
    },
    [setTrackOnPeer]
  );

  const sendOffer = useCallback(
    async (remoteSocketId: string, force = false) => {
      const socket = getSocket();
      const pc = peersRef.current.get(remoteSocketId);
      if (!socket?.id || !pc) return;

      const meta = getPeerMeta(remoteSocketId);
      if (meta.makingOffer) return;
      if (!force && socket.id >= remoteSocketId) return;
      if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;

      meta.makingOffer = true;
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
        meta.makingOffer = false;
      }
    },
    [addTracksToPeer, getPeerMeta]
  );

  const attachRemoteTrack = useCallback(
    (remoteSocketId: string, track: MediaStreamTrack, evStream?: MediaStream) => {
      let stream = remoteStreamMapRef.current.get(remoteSocketId);
      if (!stream) {
        stream = evStream ?? new MediaStream();
        remoteStreamMapRef.current.set(remoteSocketId, stream);
      }

      if (!stream.getTracks().some((t) => t.id === track.id)) {
        stream.addTrack(track);
      }

      const refresh = () => syncRemoteStreams();
      track.addEventListener("unmute", refresh);
      track.addEventListener("mute", refresh);
      track.addEventListener("ended", () => {
        try {
          stream!.removeTrack(track);
        } catch {
          /* ignore */
        }
        refresh();
      });

      refresh();
      setTimeout(refresh, 100);
      setTimeout(refresh, 500);
    },
    [syncRemoteStreams]
  );

  const createPeer = useCallback(
    (remoteSocketId: string) => {
      if (peersRef.current.has(remoteSocketId)) return peersRef.current.get(remoteSocketId)!;

      getPeerMeta(remoteSocketId);

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceTransportPolicy: "all",
        bundlePolicy: "max-bundle",
      });
      peersRef.current.set(remoteSocketId, pc);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        getSocket()?.emit("webrtc:signal", {
          to: remoteSocketId,
          data: { type: "ice", candidate: e.candidate },
        });
      };

      pc.ontrack = (ev) => {
        if (ev.track) {
          attachRemoteTrack(remoteSocketId, ev.track, ev.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        }
        if (pc.connectionState === "connected") syncRemoteStreams();
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          syncRemoteStreams();
        }
      };

      pc.onnegotiationneeded = () => {
        void sendOffer(remoteSocketId, false);
      };

      addTracksToPeer(pc, remoteSocketId);

      return pc;
    },
    [addTracksToPeer, attachRemoteTrack, getPeerMeta, sendOffer, syncRemoteStreams]
  );

  const handleSignal = useCallback(
    async (
      from: string,
      data: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
    ) => {
      let pc = peersRef.current.get(from);
      if (!pc) pc = createPeer(from);

      const meta = getPeerMeta(from);

      if (data.type === "offer" && data.sdp) {
        const offer = new RTCSessionDescription(data.sdp);
        const offerCollision = meta.makingOffer || pc.signalingState !== "stable";

        meta.ignoreOffer = !meta.polite && offerCollision;
        if (meta.ignoreOffer) return;

        meta.makingOffer = true;
        try {
          if (offerCollision && meta.polite) {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          }
          await pc.setRemoteDescription(offer);
          addTracksToPeer(pc, from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          getSocket()?.emit("webrtc:signal", { to: from, data: { type: "answer", sdp: answer } });
          await flushCandidates(from, pc);
        } catch {
          /* ignore */
        } finally {
          meta.makingOffer = false;
          meta.ignoreOffer = false;
        }
      } else if (data.type === "answer" && data.sdp) {
        if (meta.ignoreOffer) return;
        if (pc.signalingState === "have-local-offer") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            await flushCandidates(from, pc);
          } catch {
            /* ignore */
          }
        }
      } else if (data.type === "ice" && data.candidate) {
        if (meta.ignoreOffer) return;
        if (!pc.remoteDescription) {
          meta.pendingCandidates.push(data.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          /* ignore */
        }
      }
      syncRemoteStreams();
    },
    [addTracksToPeer, createPeer, flushCandidates, getPeerMeta, syncRemoteStreams]
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
    peerMetaRef.current.clear();
    sendersRef.current.clear();
    remoteStreamMapRef.current.clear();
    knownPeersRef.current.clear();
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

    if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: false });
  }, [channelId, setTrackOnPeer]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    const next = !track.enabled;
    setMuted(next);
    if (channelId) getSocket()?.emit("voice:state", { channelId, muted: next });
    return next;
  }, [channelId]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      stopScreenShare();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: true,
        preferCurrentTab: false,
      } as DisplayMediaStreamOptions);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.contentHint = "detail";
      }

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);

      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare(), { once: true });

      peersRef.current.forEach((pc, remoteSocketId) => {
        addTracksToPeer(pc, remoteSocketId);
      });

      if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: true });
      return true;
    } catch {
      return false;
    }
  }, [addTracksToPeer, channelId, stopScreenShare]);

  useEffect(() => {
    if (!channelId) return;
    const socket = getSocket();
    if (!socket) return;

    const myId = socket.id;
    const nextKnown = new Set<string>();

    participants.forEach((p) => {
      if (p.socketId === myId) return;
      nextKnown.add(p.socketId);

      const isNew = !knownPeersRef.current.has(p.socketId);
      if (!peersRef.current.has(p.socketId)) {
        createPeer(p.socketId);
      }
      // Sadece yeni katılan peer ile müzakere — mevcut bağlantıları bozma
      if (isNew) {
        void sendOffer(p.socketId, false);
      }
    });

    peersRef.current.forEach((_, socketId) => {
      if (!nextKnown.has(socketId)) {
        peersRef.current.get(socketId)?.close();
        peersRef.current.delete(socketId);
        peerMetaRef.current.delete(socketId);
        sendersRef.current.delete(socketId);
        remoteStreamMapRef.current.delete(socketId);
      }
    });

    knownPeersRef.current = nextKnown;
    syncRemoteStreams();
  }, [channelId, participants, createPeer, sendOffer, syncRemoteStreams]);

  useEffect(() => {
    if (!channelId || !localStream) return;
    peersRef.current.forEach((pc, remoteSocketId) => addTracksToPeer(pc, remoteSocketId));
    // negotiationneeded otomatik tetiklenir — tüm peer'lara force offer gönderme
  }, [channelId, localStream, addTracksToPeer]);

  useEffect(() => {
    syncRemoteStreams();
  }, [participants, syncRemoteStreams]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !channelId) return;

    const onSignal = ({ from, data }: { from: string; data: unknown }) => {
      void handleSignal(
        from,
        data as { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
      );
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
