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

  const handleLeave = () => {
    leaveVoice();
    const firstText = activeServer?.channels.find((c) => c.type === "TEXT");
    if (firstText) setActiveChannel(firstText);
  };

  const others = participants.filter((p) => p.userId !== user?.id);

  const selfTile = user && (
    <div className={`voice-tile ${!muted ? "speaking" : ""}`}>
      {screenStream && (
        <video
          ref={(el) => {
            if (el && screenStream) el.srcObject = screenStream;
          }}
          autoPlay
          muted
          playsInline
        />
      )}
      {!screenStream && <Avatar name={user.username} color={user.avatarColor} size={72} />}
      <div className="vt-name">
        {user.username} (sen)
        {muted && (
          <span className="vt-muted">
            <MicOffIcon size={14} />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="main">
      <header className="main-header">
        <VolumeIcon size={18} className="ch-icon" style={{ color: "var(--green)" }} />
        <span>{connectedChannelName}</span>
        <span className="sub">Sesli kanal · {others.length + 1} kişi</span>
      </header>

      <div className="voice-stage">
        <div className="voice-grid">
          {selfTile}
          {remoteStreams.map((r) => {
            const p = others.find((x) => x.socketId === r.socketId);
            const showVideo = p?.screenSharing && r.stream.getVideoTracks().length > 0;
            return (
              <div key={r.socketId} className={`voice-tile ${!p?.muted ? "speaking" : ""}`}>
                {showVideo ? (
                  <video
                    ref={(el) => {
                      if (el) el.srcObject = r.stream;
                    }}
                    autoPlay
                    playsInline
                  />
                ) : (
                  <Avatar name={r.username} color={r.avatarColor} size={72} />
                )}
                <div className="vt-name">
                  {r.username}
                  {p?.muted && (
                    <span className="vt-muted">
                      <MicOffIcon size={14} />
                    </span>
                  )}
                  {p?.screenSharing && (
                    <span>
                      <ScreenIcon size={14} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {others
            .filter((p) => !remoteStreams.some((r) => r.socketId === p.socketId))
            .map((p) => (
              <div key={p.socketId} className="voice-tile">
                <Avatar name={p.username} color={p.avatarColor} size={72} />
                <div className="vt-name">
                  {p.username}
                  {p.muted && (
                    <span className="vt-muted">
                      <MicOffIcon size={14} />
                    </span>
                  )}
                </div>
              </div>
            ))}
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
            title="Ekran paylaş"
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
