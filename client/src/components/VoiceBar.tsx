import { useApp } from "../store/app";
import { useVoice } from "../store/voice";
import { useVoiceSession } from "../context/VoiceContext";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
  VolumeIcon,
} from "./Icons";

export default function VoiceBar() {
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const connectedChannelName = useVoice((s) => s.connectedChannelName);
  const muted = useVoice((s) => s.muted);
  const screenSharing = useVoice((s) => s.screenSharing);
  const activeChannel = useApp((s) => s.activeChannel);
  const setActiveChannel = useApp((s) => s.setActiveChannel);
  const activeServer = useApp((s) => s.activeServer);
  const { toggleMute, toggleScreenShare, leaveVoice } = useVoiceSession();

  if (!connectedChannelId) return null;

  const viewingText = activeChannel?.type !== "VOICE";

  const openVoiceView = () => {
    const voiceCh = activeServer?.channels.find((c) => c.id === connectedChannelId);
    if (voiceCh) setActiveChannel(voiceCh);
  };

  return (
    <div className={`voice-bar ${viewingText ? "visible" : ""}`}>
      <div className="voice-bar-info" onClick={openVoiceView} title="Sesli odaya git">
        <VolumeIcon size={18} style={{ color: "var(--green)" }} />
        <div>
          <div className="voice-bar-title">Sesli bağlı</div>
          <div className="voice-bar-channel">{connectedChannelName}</div>
        </div>
      </div>
      <div className="voice-bar-controls">
        <button
          className={`vc-btn sm ${muted ? "off" : ""}`}
          title={muted ? "Sesi aç" : "Sustur"}
          onClick={toggleMute}
        >
          {muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
        </button>
        <button
          className={`vc-btn sm ${screenSharing ? "active" : ""}`}
          title="Ekran paylaş"
          onClick={toggleScreenShare}
        >
          <ScreenIcon size={18} />
        </button>
        <button className="vc-btn sm danger" title="Sesli sohbetten ayrıl" onClick={leaveVoice}>
          <PhoneOffIcon size={18} />
        </button>
      </div>
    </div>
  );
}
