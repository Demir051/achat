import { useEffect, useRef } from "react";
import { unlockAudioPlayback } from "../lib/audioUnlock";
import { useVoiceSession } from "../context/VoiceContext";
import { useAuth } from "../store/auth";
import { useSettings } from "../store/settings";
import { useVoice } from "../store/voice";

function RemoteAudioPlayer({
  stream,
  trackKey,
  volume,
}: {
  stream: MediaStream;
  trackKey: string;
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

    const play = async () => {
      const tracks = stream.getAudioTracks().filter((t) => t.readyState !== "ended");
      if (!tracks.length) {
        el.srcObject = null;
        return;
      }
      el.srcObject = new MediaStream(tracks);
      el.volume = Math.max(0, Math.min(1, volume / 100));
      try {
        await el.play();
      } catch {
        await unlockAudioPlayback();
        try {
          await el.play();
        } catch {
          /* kullanıcı etkileşimi gerekebilir */
        }
      }
    };

    play();
    stream.addEventListener("addtrack", play);
    stream.addEventListener("removetrack", play);
    const bound: MediaStreamTrack[] = [];
    for (const track of stream.getAudioTracks()) {
      track.addEventListener("unmute", play);
      track.addEventListener("mute", play);
      track.addEventListener("ended", play);
      bound.push(track);
    }

    const onInteract = () => {
      void play();
    };
    window.addEventListener("pointerdown", onInteract);

    return () => {
      stream.removeEventListener("addtrack", play);
      stream.removeEventListener("removetrack", play);
      for (const track of bound) {
        track.removeEventListener("unmute", play);
        track.removeEventListener("mute", play);
        track.removeEventListener("ended", play);
      }
      window.removeEventListener("pointerdown", onInteract);
    };
  }, [stream, trackKey, volume]);

  return <audio ref={ref} autoPlay playsInline className="voice-remote-audio" />;
}

/** Sesli kanaldayken uzak sesleri her zaman çalar (metin kanalında gezinirken de). */
export default function VoiceAudioSink() {
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const myUserId = useAuth((s) => s.user?.id);
  const { remoteStreams } = useVoiceSession();
  const peerVolumes = useSettings((s) => s.peerVolumes);
  const peerScreenVolumes = useSettings((s) => s.peerScreenVolumes);

  if (!connectedChannelId) return null;

  return (
    <>
      {remoteStreams
        .filter((r) => r.userId !== myUserId)
        .map((r) => (
          <span key={r.socketId} hidden aria-hidden>
            {r.micStream.getAudioTracks().length > 0 && (
              <RemoteAudioPlayer
                stream={r.micStream}
                trackKey={r.audioTrackKey}
                volume={peerVolumes[r.userId] ?? 100}
              />
            )}
            {r.screenAudioStream && r.screenAudioStream.getAudioTracks().length > 0 && (
              <RemoteAudioPlayer
                stream={r.screenAudioStream}
                trackKey={r.screenAudioTrackKey}
                volume={peerScreenVolumes[r.userId] ?? 100}
              />
            )}
          </span>
        ))}
    </>
  );
}
