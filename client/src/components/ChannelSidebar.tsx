import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import { useVoiceSession } from "../context/VoiceContext";
import { useApp } from "../store/app";
import { useAuth } from "../store/auth";
import { useVoice } from "../store/voice";
import type { Channel } from "../types";
import Avatar from "./Avatar";
import CreateChannelModal from "./CreateChannelModal";
import InviteModal from "./InviteModal";
import ServerSettingsModal from "./ServerSettingsModal";
import UserPanel from "./UserPanel";
import { HashIcon, PlusIcon, SettingsIcon, VolumeIcon, UserPlusIcon } from "./Icons";

export default function ChannelSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { activeServer, activeChannel, setActiveChannel } = useApp();
  const user = useAuth((s) => s.user);
  const rosters = useVoice((s) => s.rosters);
  const connectedChannelId = useVoice((s) => s.connectedChannelId);
  const { joinVoice } = useVoiceSession();
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!activeServer) return;
    const socket = getSocket();
    socket?.emit("server:join", activeServer.id);
    return () => {
      socket?.emit("server:leave", activeServer.id);
    };
  }, [activeServer?.id]);

  if (!activeServer) return null;

  const textChannels = activeServer.channels.filter((c) => c.type === "TEXT");
  const voiceChannels = activeServer.channels.filter((c) => c.type === "VOICE");
  const isOwner = activeServer.ownerId === user?.id;

  const selectTextChannel = (ch: Channel) => {
    setActiveChannel(ch);
    onNavigate?.();
  };

  const selectVoiceChannel = async (ch: Channel) => {
    if (connectedChannelId !== ch.id) {
      await joinVoice(ch.id, ch.name);
    }
    setActiveChannel(ch);
    onNavigate?.();
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>{activeServer.name}</span>
          <div className="sidebar-header-actions">
            <button className="invite-btn" title="Davet et" onClick={() => setShowInvite(true)}>
              <UserPlusIcon size={18} />
            </button>
            {isOwner && (
              <button className="invite-btn" title="Sunucu ayarları" onClick={() => setShowSettings(true)}>
                <SettingsIcon size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="channel-group-label">
            <span>Metin Kanalları</span>
            {isOwner && (
              <button title="Kanal ekle" onClick={() => setShowCreate(true)}>
                <PlusIcon size={14} />
              </button>
            )}
          </div>
          {textChannels.map((ch) => (
            <div
              key={ch.id}
              className={`channel-item ${activeChannel?.id === ch.id ? "active" : ""}`}
              onClick={() => selectTextChannel(ch)}
            >
              <HashIcon size={18} className="ch-icon" />
              {ch.name}
            </div>
          ))}

          <div className="channel-group-label" style={{ marginTop: 12 }}>
            <span>Sesli Kanallar</span>
            {isOwner && (
              <button title="Kanal ekle" onClick={() => setShowCreate(true)}>
                <PlusIcon size={14} />
              </button>
            )}
          </div>
          {voiceChannels.map((ch) => {
            const isConnected = connectedChannelId === ch.id;
            const isViewing = activeChannel?.id === ch.id;
            return (
              <div key={ch.id}>
                <div
                  className={`channel-item ${isViewing ? "active" : ""} ${isConnected ? "voice-connected" : ""}`}
                  onClick={() => selectVoiceChannel(ch)}
                >
                  <VolumeIcon size={18} className="ch-icon" />
                  {ch.name}
                  {isConnected && !isViewing && <span className="voice-dot" />}
                </div>
                {(rosters[ch.id] ?? []).length > 0 && (
                  <div className="voice-members">
                    {rosters[ch.id].map((p) => (
                      <div key={p.socketId} className="voice-member">
                        <Avatar name={p.username} color={p.avatarColor} size={22} />
                        {p.username}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <UserPanel />
      </aside>

      {showInvite && (
        <InviteModal
          code={activeServer.inviteCode}
          locked={activeServer.locked}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showSettings && isOwner && (
        <ServerSettingsModal server={activeServer} onClose={() => setShowSettings(false)} />
      )}
      {showCreate && (
        <CreateChannelModal serverId={activeServer.id} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}
