import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../lib/socket";
import { useSettings } from "../store/settings";
import type { VoiceParticipant } from "../types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
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
  videoStream: MediaStream | null;
  micStream: MediaStream;
  screenAudioStream: MediaStream | null;
  screenSharing: boolean;
  videoTrackId: string | null;
  audioTrackKey: string;
  screenAudioTrackKey: string;
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

function buildStream(tracks: MediaStreamTrack[]) {
  return new MediaStream(tracks.filter((t) => t.readyState !== "ended"));
}

/** Transceiver sırası: mic(audio) → screen(video) → screenAudio(audio) */
function splitRemoteByTransceivers(pc: RTCPeerConnection) {
  const transceivers = pc.getTransceivers();
  const mic: MediaStreamTrack[] = [];
  const video: MediaStreamTrack[] = [];
  const screenAudio: MediaStreamTrack[] = [];

  let audioIdx = 0;
  for (const tr of transceivers) {
    const track = tr.receiver.track;
    if (!track || track.readyState === "ended") continue;

    if (track.kind === "video") {
      video.push(track);
    } else if (track.kind === "audio") {
      if (audioIdx === 0) mic.push(track);
      else screenAudio.push(track);
      audioIdx++;
    }
  }

  return { mic, video, screenAudio };
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

      const { mic, video, screenAudio } = splitRemoteByTransceivers(pc);
      const micStream = buildStream(mic);
      const videoStream = video.length ? buildStream(video) : null;
      const screenAudioStream = screenAudio.length ? buildStream(screenAudio) : null;

      const allTracks = [...mic, ...video, ...screenAudio];
      if (!allTracks.length) return;

      const stream = buildStream(allTracks);
      const videoTrack = video[0] ?? null;

      list.push({
        socketId,
        userId: p.userId,
        username: p.username,
        avatarColor: p.avatarColor,
        stream,
        videoStream,
        micStream,
        screenAudioStream,
        screenSharing: p.screenSharing,
        videoTrackId: videoTrack?.id ?? null,
        audioTrackKey: audioTrackKey(micStream),
        screenAudioTrackKey: screenAudioStream ? audioTrackKey(screenAudioStream) : "",
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

  const ensureTransceivers = useCallback(
    (pc: RTCPeerConnection, remoteSocketId: string) => {
      const map = getSenderMap(remoteSocketId);
      const order: TrackPurpose[] = ["mic", "screenVideo", "screenAudio"];

      for (const purpose of order) {
        if (map.has(purpose)) continue;
        const kind = purpose === "screenVideo" ? "video" : "audio";
        const tr = pc.addTransceiver(kind, { direction: "sendrecv" });
        map.set(purpose, tr.sender);
      }
    },
    [getSenderMap]
  );

  const syncLocalTracks = useCallback(
    (pc: RTCPeerConnection, remoteSocketId: string) => {
      ensureTransceivers(pc, remoteSocketId);
      const map = getSenderMap(remoteSocketId);

      const micTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
      const screenVideoTrack = screenStreamRef.current?.getVideoTracks()[0] ?? null;
      const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0] ?? null;

      if (screenVideoTrack) screenVideoTrack.contentHint = "detail";

      const micSender = map.get("mic");
      const videoSender = map.get("screenVideo");
      const screenAudioSender = map.get("screenAudio");

      if (micSender && micSender.track?.id !== micTrack?.id) {
        void micSender.replaceTrack(micTrack);
      }
      if (videoSender && videoSender.track?.id !== screenVideoTrack?.id) {
        void videoSender.replaceTrack(screenVideoTrack);
      }
      if (screenAudioSender && screenAudioSender.track?.id !== screenAudioTrack?.id) {
        void screenAudioSender.replaceTrack(screenAudioTrack);
      }

      // Yön: track yoksa recvonly, varsa sendrecv
      const transceivers = pc.getTransceivers();
      for (const tr of transceivers) {
        if (tr.sender === micSender) {
          tr.direction = micTrack ? "sendrecv" : "recvonly";
        } else if (tr.sender === videoSender) {
          tr.direction = screenVideoTrack ? "sendrecv" : "recvonly";
        } else if (tr.sender === screenAudioSender) {
          tr.direction = screenAudioTrack ? "sendrecv" : "recvonly";
        }
      }
    },
    [ensureTransceivers, getSenderMap]
  );

  const sendOffer = useCallback(
    async (remoteSocketId: string, force = false) => {
      const socket = getSocket();
      const pc = peersRef.current.get(remoteSocketId);
      if (!socket?.id || !pc) return;

      const meta = getPeerMeta(remoteSocketId);
      if (meta.makingOffer) return;

      // İlk bağlantı: küçük socket id teklif eder. Medya değişince: her zaman (force).
      if (!force && socket.id >= remoteSocketId) return;
      if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;

      meta.makingOffer = true;
      try {
        syncLocalTracks(pc, remoteSocketId);
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
    [getPeerMeta, syncLocalTracks]
  );

  const negotiateAll = useCallback(
    (force = true) => {
      for (const remoteSocketId of peersRef.current.keys()) {
        void sendOffer(remoteSocketId, force);
      }
    },
    [sendOffer]
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

      ensureTransceivers(pc, remoteSocketId);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        getSocket()?.emit("webrtc:signal", {
          to: remoteSocketId,
          data: { type: "ice", candidate: e.candidate },
        });
      };

      pc.ontrack = () => {
        syncRemoteStreams();
        setTimeout(syncRemoteStreams, 100);
        setTimeout(syncRemoteStreams, 500);
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

      syncLocalTracks(pc, remoteSocketId);

      return pc;
    },
    [ensureTransceivers, getPeerMeta, sendOffer, syncLocalTracks, syncRemoteStreams]
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
          syncLocalTracks(pc, from);
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
    [createPeer, flushCandidates, getPeerMeta, syncLocalTracks, syncRemoteStreams]
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
      syncLocalTracks(pc, remoteSocketId);
    });
    negotiateAll(true);

    if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: false });
  }, [channelId, negotiateAll, syncLocalTracks]);

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
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.contentHint = "detail";

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);

      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopScreenShare(), { once: true });

      peersRef.current.forEach((pc, remoteSocketId) => {
        syncLocalTracks(pc, remoteSocketId);
      });
      negotiateAll(true);

      if (channelId) getSocket()?.emit("voice:state", { channelId, screenSharing: true });
      return true;
    } catch {
      return false;
    }
  }, [channelId, negotiateAll, stopScreenShare, syncLocalTracks]);

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
      }
    });

    knownPeersRef.current = nextKnown;
    syncRemoteStreams();
  }, [channelId, participants, createPeer, sendOffer, syncRemoteStreams]);

  useEffect(() => {
    if (!channelId || !localStream) return;
    peersRef.current.forEach((pc, remoteSocketId) => syncLocalTracks(pc, remoteSocketId));
    negotiateAll(true);
  }, [channelId, localStream, negotiateAll, syncLocalTracks]);

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
