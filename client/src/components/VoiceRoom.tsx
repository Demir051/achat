import { useEffect, useRef, useState } from "react";
import { useAuth } from "../store/auth";
import { useApp } from "../store/app";
import { useVoice } from "../store/voice";
import { useVoiceSession } from "../context/VoiceContext";
import { useSettings } from "../store/settings";
import Avatar from "./Avatar";
import {
  MenuIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
  UsersIcon,
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
  const videoTrackId = stream.getVideoTracks()[0]?.id ?? "none";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const attach = () => {
      const tracks = stream.getVideoTracks().filter((t) => t.readyState !== "ended");
      if (!tracks.length) {
        el.srcObject = null;
        return;
      }
      const ms = new MediaStream(tracks);
      el.srcObject = ms;
      const play = () => void el.play().catch(() => {});
      if (el.readyState >= 2) play();
      else el.onloadeddata = play;
    };

    attach();
    stream.addEventListener("addtrack", attach);
    stream.addEventListener("removetrack", attach);
    const bound: MediaStreamTrack[] = [];
    for (const track of stream.getVideoTracks()) {
      track.addEventListener("unmute", attach);
      track.addEventListener("mute", attach);
      track.addEventListener("ended", attach);
      bound.push(track);
    }

    return () => {
      el.onloadeddata = null;
      stream.removeEventListener("addtrack", attach);
      stream.removeEventListener("removetrack", attach);
      for (const track of bound) {
        track.removeEventListener("unmute", attach);
        track.removeEventListener("mute", attach);
        track.removeEventListener("ended", attach);
      }
    };
  }, [stream, videoTrackId]);

  return (
    <video
      key={videoTrackId}
      ref={ref}
      className={className}
      autoPlay
      playsInline
      muted
    />
  );
}

export default function VoiceRoom({
  showMenuButton,
  onMenuClick,
  showMembersToggle,
  membersVisible,
  onToggleMembers,
}: {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  showMembersToggle?: boolean;
  membersVisible?: boolean;
  onToggleMembers?: () => void;
}) {
  const user = useAuth((s) => s.user);
  const activeServer = useApp((s) => s.activeServer);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const connectedChannelName = useVoice((s) => s.connectedChannelName);
  const participants = useVoice((s) => s.participants);
  const muted = useVoice((s) => s.muted);
  const screenSharing = useVoice((s) => s.screenSharing);
  const { toggleMute, toggleScreenShare, leaveVoice, screenStream, remoteStreams } =
    useVoiceSession();
  const peerVolumes = useSettings((s) => s.peerVolumes);
  const peerScreenVolumes = useSettings((s) => s.peerScreenVolumes);
  const setPeerVolume = useSettings((s) => s.setPeerVolume);
  const setPeerScreenVolume = useSettings((s) => s.setPeerScreenVolume);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [volumeUserId, setVolumeUserId] = useState<string | null>(null);

  const handleLeave = () => {
    leaveVoice();
    const firstText = activeServer?.channels.find((c) => c.type === "TEXT");
    if (firstText) setActiveChannel(firstText);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusedId(null);
        setVolumeUserId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!volumeUserId) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".voice-volume-pop") && !target.closest(".voice-volume-btn")) {
        setVolumeUserId(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [volumeUserId]);

  useEffect(() => {
    if (!focusedId || focusedId === "self") return;
    const stillSharing = remoteStreams.some(
      (r) => r.socketId === focusedId && r.screenSharing
    );
    if (!stillSharing) setFocusedId(null);
  }, [focusedId, remoteStreams]);

  useEffect(() => {
    if (focusedId === "self" && !screenStream) setFocusedId(null);
  }, [focusedId, screenStream]);

  const others = participants.filter((p) => p.userId !== user?.id);

  const toggleFocus = (id: string) => {
    setFocusedId((prev) => (prev === id ? null : id));
    setVolumeUserId(null);
  };

  const focusedRemote = focusedId && focusedId !== "self"
    ? remoteStreams.find((r) => r.socketId === focusedId)
    : null;

  const renderTile = (
    id: string,
    userId: string,
    username: string,
    avatarColor: string,
    isMuted: boolean,
    isSharing: boolean,
    videoStream: MediaStream | null,
    isSelf = false,
    videoKey?: string | null
  ) => {
    const hasVideo = !!videoStream && videoStream.getVideoTracks().length > 0;
    const isFocused = focusedId === id;
    const volumeOpen = volumeUserId === userId;
    const volume = peerVolumes[userId] ?? 100;
    const screenVolume = peerScreenVolumes[userId] ?? 100;

    const handleTileClick = () => {
      if (isSelf) {
        if (isSharing && hasVideo) toggleFocus("self");
        return;
      }
      if (isSharing) {
        toggleFocus(id);
        return;
      }
      setVolumeUserId((prev) => (prev === userId ? null : userId));
    };

    return (
      <div
        key={id}
        className={`voice-tile ${!isMuted ? "speaking" : ""} ${hasVideo ? "shareable has-video" : ""} ${isSharing && !hasVideo ? "share-pending" : ""} ${isFocused ? "focused-thumb" : ""} ${volumeOpen ? "volume-open" : ""} ${!isSelf || (isSharing && hasVideo) ? "clickable" : ""}`}
        onClick={handleTileClick}
        title={
          isSharing
            ? hasVideo
              ? "Ekranı büyüt / küçült"
              : "Ekran paylaşımı bağlanıyor…"
            : isSelf
              ? undefined
              : "Ses seviyesi"
        }
      >
        {hasVideo && videoStream ? (
          <StreamVideo key={videoKey ?? id} stream={videoStream} />
        ) : isSharing ? (
          <div className="voice-share-pending">
            <ScreenIcon size={32} />
            <span>Bağlanıyor…</span>
          </div>
        ) : (
          <Avatar name={username} color={avatarColor} size={72} />
        )}

        {!isSelf && (
          <button
            type="button"
            className="voice-volume-btn"
            title="Ses seviyesi"
            onClick={(e) => {
              e.stopPropagation();
              setVolumeUserId((prev) => (prev === userId ? null : userId));
            }}
          >
            <VolumeIcon size={16} />
          </button>
        )}

        {volumeOpen && !isSelf && (
          <div className="voice-volume-pop" onClick={(e) => e.stopPropagation()}>
            <div className="voice-volume-head">
              <VolumeIcon size={16} />
              <span>{username}</span>
            </div>

            <label className="voice-volume-label">
              <MicIcon size={14} />
              Mikrofon
            </label>
            <input
              type="range"
              className="voice-volume-slider"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setPeerVolume(userId, Number(e.target.value))}
            />
            <div className="voice-volume-meta">
              <span>{volume}%</span>
              {volume === 0 && <span className="voice-volume-muted">Sessiz</span>}
            </div>

            {isSharing && (
              <>
                <label className="voice-volume-label">
                  <ScreenIcon size={14} />
                  Ekran sesi
                </label>
                <input
                  type="range"
                  className="voice-volume-slider"
                  min={0}
                  max={100}
                  value={screenVolume}
                  onChange={(e) => setPeerScreenVolume(userId, Number(e.target.value))}
                />
                <div className="voice-volume-meta">
                  <span>{screenVolume}%</span>
                  {screenVolume === 0 && <span className="voice-volume-muted">Sessiz</span>}
                </div>
              </>
            )}

            {hasVideo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm voice-volume-expand"
                onClick={() => toggleFocus(id)}
              >
                Ekranı büyüt
              </button>
            )}
          </div>
        )}

        <div className="vt-name">
          {username}
          {isSelf && " (sen)"}
          {!isSelf && volume !== 100 && (
            <span className="vt-volume" title={`Mikrofon: ${volume}%`}>
              <VolumeIcon size={12} />
              {volume}%
            </span>
          )}
          {!isSelf && isSharing && screenVolume !== 100 && (
            <span className="vt-volume vt-screen-volume" title={`Ekran sesi: ${screenVolume}%`}>
              <ScreenIcon size={12} />
              {screenVolume}%
            </span>
          )}
          {isMuted && (
            <span className="vt-muted">
              <MicOffIcon size={14} />
            </span>
          )}
          {isSharing && (
            <span className="vt-sharing">
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
        {showMenuButton && (
          <button type="button" className="hbtn mobile-menu-btn" aria-label="Menü" onClick={onMenuClick}>
            <MenuIcon size={22} />
          </button>
        )}
        <VolumeIcon size={18} className="ch-icon" style={{ color: "var(--green)" }} />
        <span>{connectedChannelName}</span>
        <span className="sub">Sesli kanal · {others.length + 1} kişi</span>
        <span className="spacer" />
        {showMembersToggle && (
          <button
            type="button"
            className={`hbtn ${membersVisible ? "active" : ""}`}
            title="Üye listesi"
            onClick={onToggleMembers}
          >
            <UsersIcon size={20} />
          </button>
        )}
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

        {focusedRemote && focusedRemote.videoStream && (
          <div className="voice-focus-panel">
            <StreamVideo
              key={focusedRemote.videoTrackId ?? focusedRemote.socketId}
              stream={focusedRemote.videoStream}
              className="voice-focus-video"
            />
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
            renderTile(
              "self",
              user.id,
              user.username,
              user.avatarColor,
              muted,
              screenSharing,
              screenStream,
              true
            )}

          {remoteStreams.map((r) => {
            const p = others.find((x) => x.socketId === r.socketId);
            return renderTile(
              r.socketId,
              r.userId,
              r.username,
              r.avatarColor,
              !!p?.muted,
              !!p?.screenSharing,
              r.videoStream,
              false,
              r.videoTrackId
            );
          })}

          {others
            .filter((p) => !remoteStreams.some((r) => r.socketId === p.socketId))
            .map((p) =>
              renderTile(p.socketId, p.userId, p.username, p.avatarColor, p.muted, p.screenSharing, null)
            )}
        </div>

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
