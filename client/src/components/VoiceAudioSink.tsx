import { useEffect, useRef } from "react";
import { useVoiceSession } from "../context/VoiceContext";
import { useSettings } from "../store/settings";
import { useVoice } from "../store/voice";

function RemoteAudioPlayer({
  stream,
  trackKey,
  userId,
  volume,
}: {
  stream: MediaStream;
  trackKey: string;
  userId: string;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const attach = () => {
      const tracks = stream.getAudioTracks().filter((t) => t.readyState !== "ended" && t.enabled);
      if (!tracks.length) {
        el.srcObject = null;
        return;
      }
      const ms = new MediaStream(tracks);
      el.srcObject = ms;
      el.volume = Math.max(0, Math.min(1, volume / 100));
      void el.play().catch(() => {});
    };

    attach();
    stream.addEventListener("addtrack", attach);
    stream.addEventListener("removetrack", attach);
    const bound: MediaStreamTrack[] = [];
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("unmute", attach);
      track.addEventListener("mute", attach);
      track.addEventListener("ended", attach);
      bound.push(track);
    }

    return () => {
      stream.removeEventListener("addtrack", attach);
      stream.removeEventListener("removetrack", attach);
      for (const track of bound) {
        track.removeEventListener("unmute", attach);
        track.removeEventListener("mute", attach);
        track.removeEventListener("ended", attach);
      }
    };
  }, [stream, trackKey, volume]);

  return <audio ref={ref} autoPlay playsInline className="voice-remote-audio" />;
}

/** Sesli kanaldayken uzak sesleri her zaman çalar (metin kanalında gezinirken de). */
export default function VoiceAudioSink() {
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const { remoteStreams } = useVoiceSession();
  const peerVolumes = useSettings((s) => s.peerVolumes);

  if (!connectedChannelId) return null;

  return (
    <>
      {remoteStreams.map((r) => (
        <RemoteAudioPlayer
          key={r.socketId}
          userId={r.userId}
          trackKey={r.audioTrackKey}
          stream={r.stream}
          volume={peerVolumes[r.userId] ?? 100}
        />
      ))}
    </>
  );
}
