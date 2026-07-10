import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import type { Friend } from "../types";
import Avatar from "./Avatar";
import UserPanel from "./UserPanel";
import { UsersIcon } from "./Icons";

export default function DmSidebar() {
  const { activeDmUserId, unreadDmIds, setActiveDm } = useApp();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showFriends, setShowFriends] = useState(!activeDmUserId);

  const loadFriends = async () => {
    const { data } = await api.get("/users/friends");
    setFriends(data.friends);
    setPendingCount(data.incoming?.length ?? 0);
  };

  useEffect(() => {
    loadFriends();
  }, []);

  const openFriends = () => {
    setShowFriends(true);
    setActiveDm(null);
  };

  const openDm = (friend: Friend) => {
    setShowFriends(false);
    setActiveDm(friend.id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Özel Mesajlar</span>
      </div>

      <div className="sidebar-scroll">
        <div
          className={`dm-nav ${showFriends && !activeDmUserId ? "active" : ""}`}
          onClick={openFriends}
        >
          <UsersIcon size={18} />
          Arkadaşlar
          {pendingCount > 0 && <span className="friend-request-badge">{pendingCount}</span>}
        </div>

        <div className="channel-group-label" style={{ marginTop: 8 }}>
          <span>Direkt Mesajlar</span>
        </div>

        {friends.length === 0 ? (
          <p className="empty-hint">Henüz arkadaşın yok. Arkadaşlar sekmesinden ekle.</p>
        ) : (
          friends.map((f) => (
            <div
              key={f.id}
              className={`channel-item ${activeDmUserId === f.id ? "active" : ""} ${unreadDmIds.includes(f.id) ? "dm-unread" : ""}`}
              onClick={() => openDm(f)}
            >
              <Avatar name={f.username} color={f.avatarColor} size={24} />
              {f.username}
            </div>
          ))
        )}
      </div>

      <UserPanel />
    </aside>
  );
}
