import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import { useApp } from "../store/app";
import { useVoice } from "../store/voice";
import { useVoiceSession } from "../context/VoiceContext";
import Avatar from "./Avatar";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
  VolumeIcon,
} from "./Icons";

function StreamVideo({
  stream,
  className,
}: {
  stream: MediaStream;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  return <video ref={ref} className={className} autoPlay playsInline muted />;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  return <audio ref={ref} autoPlay playsInline className="voice-remote-audio" />;
}

export default function VoiceRoom() {
  const user = useAuth((s) => s.user);
  const activeServer = useApp((s) => s.activeServer);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const connectedChannelName = useVoice((s) => s.connectedChannelName);
  const participants = useVoice((s) => s.participants);
  const muted = useVoice((s) => s.muted);
  const screenSharing = useVoice((s) => s.screenSharing);
  const { toggleMute, toggleScreenShare, leaveVoice, screenStream, remoteStreams } =
    useVoiceSession();

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const handleLeave = () => {
    leaveVoice();
    const firstText = activeServer?.channels.find((c) => c.type === "TEXT");
    if (firstText) setActiveChannel(firstText);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!focusedId || focusedId === "self") return;
    const stillSharing = remoteStreams.some(
      (r) => r.socketId === focusedId && r.stream.getVideoTracks().length > 0
    );
    if (!stillSharing) setFocusedId(null);
  }, [focusedId, remoteStreams]);

  useEffect(() => {
    if (focusedId === "self" && !screenStream) setFocusedId(null);
  }, [focusedId, screenStream]);

  const others = participants.filter((p) => p.userId !== user?.id);

  const toggleFocus = (id: string, canFocus: boolean) => {
    if (!canFocus) return;
    setFocusedId((prev) => (prev === id ? null : id));
  };

  const focusedRemote = focusedId && focusedId !== "self"
    ? remoteStreams.find((r) => r.socketId === focusedId)
    : null;

  const renderTile = (
    id: string,
    username: string,
    avatarColor: string,
    isMuted: boolean,
    isSharing: boolean,
    stream: MediaStream | null,
    isSelf = false
  ) => {
    const showVideo = isSharing && stream && stream.getVideoTracks().length > 0;
    const isFocused = focusedId === id;

    return (
      <div
        key={id}
        className={`voice-tile ${!isMuted ? "speaking" : ""} ${showVideo ? "shareable" : ""} ${isFocused ? "focused-thumb" : ""}`}
        onClick={() => toggleFocus(id, !!showVideo)}
        title={showVideo ? "Ekranı büyüt" : undefined}
      >
        {showVideo && stream ? (
          <StreamVideo stream={stream} />
        ) : (
          <Avatar name={username} color={avatarColor} size={72} />
        )}
        <div className="vt-name">
          {username}
          {isSelf && " (sen)"}
          {isMuted && (
            <span className="vt-muted">
              <MicOffIcon size={14} />
            </span>
          )}
          {isSharing && (
            <span>
              <ScreenIcon size={14} />
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="main">
      <header className="main-header">
        <VolumeIcon size={18} className="ch-icon" style={{ color: "var(--green)" }} />
        <span>{connectedChannelName}</span>
        <span className="sub">Sesli kanal · {others.length + 1} kişi</span>
      </header>

      <div className={`voice-stage ${focusedId ? "has-focus" : ""}`}>
        {focusedId === "self" && screenStream && (
          <div className="voice-focus-panel">
            <StreamVideo stream={screenStream} className="voice-focus-video" />
            <div className="voice-focus-bar">
              <span>{user?.username} — ekran paylaşımı (sen)</span>
              <button type="button" className="btn btn-ghost voice-focus-close" onClick={() => setFocusedId(null)}>
                Küçült
              </button>
            </div>
          </div>
        )}

        {focusedRemote && (
          <div className="voice-focus-panel">
            <StreamVideo stream={focusedRemote.stream} className="voice-focus-video" />
            <div className="voice-focus-bar">
              <span>{focusedRemote.username} — ekran paylaşımı</span>
              <button type="button" className="btn btn-ghost voice-focus-close" onClick={() => setFocusedId(null)}>
                Küçült
              </button>
            </div>
          </div>
        )}

        <div className={`voice-grid ${focusedId ? "compact" : ""}`}>
          {user &&
            renderTile("self", user.username, user.avatarColor, muted, screenSharing, screenStream, true)}

          {remoteStreams.map((r) => {
            const p = others.find((x) => x.socketId === r.socketId);
            const showVideo = p?.screenSharing && r.stream.getVideoTracks().length > 0;
            return renderTile(
              r.socketId,
              r.username,
              r.avatarColor,
              !!p?.muted,
              !!p?.screenSharing,
              showVideo ? r.stream : null
            );
          })}

          {others
            .filter((p) => !remoteStreams.some((r) => r.socketId === p.socketId))
            .map((p) => renderTile(p.socketId, p.username, p.avatarColor, p.muted, p.screenSharing, null))}
        </div>

        {remoteStreams.map((r) => (
          <RemoteAudio key={r.socketId} stream={r.stream} />
        ))}

        <div className="voice-controls">
          <button
            className={`vc-btn ${muted ? "off" : ""}`}
            title={muted ? "Sesi aç" : "Sustur"}
            onClick={toggleMute}
          >
            {muted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
          </button>
          <button
            className={`vc-btn ${screenSharing ? "active" : ""}`}
            title="Ekran paylaş (ses dahil — tarayıcıda 'Ses paylaş'ı işaretle)"
            onClick={toggleScreenShare}
          >
            <ScreenIcon size={22} />
          </button>
          <button className="vc-btn danger" title="Ayrıl" onClick={handleLeave}>
            <PhoneOffIcon size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
