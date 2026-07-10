import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useApp } from "../store/app";
import type { Friend, FriendRequest } from "../types";
import Avatar from "./Avatar";
import { CheckIcon, MessageIcon, UserPlusIcon, XIcon } from "./Icons";

type Tab = "online" | "pending" | "add";

export default function FriendsPanel() {
  const setActiveDm = useApp((s) => s.setActiveDm);
  const [tab, setTab] = useState<Tab>("online");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get("/users/friends");
    setFriends(data.friends);
    setIncoming(data.incoming ?? []);
    setOutgoing(data.outgoing ?? []);
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.emit("presence:query");
    socket?.on("presence:list", ({ online }: { online: string[] }) => {
      setOnlineIds(new Set(online));
    });
    socket?.on("presence:update", ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    return () => {
      socket?.off("presence:list");
      socket?.off("presence:update");
    };
  }, []);

  const sendRequest = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/users/friends/request", { username: username.trim() });
      setSuccess(`${username} kullanıcısına istek gönderildi`);
      setUsername("");
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? "İstek gönderilemedi");
    } finally {
      setLoading(false);
    }
  };

  const accept = async (id: string) => {
    await api.post(`/users/friends/${id}/accept`);
    await load();
  };

  const reject = async (id: string) => {
    await api.delete(`/users/friends/${id}`);
    await load();
  };

  const openDm = (friend: Friend) => setActiveDm(friend.id);

  const onlineFriends = friends.filter((f) => onlineIds.has(f.id));
  const offlineFriends = friends.filter((f) => !onlineIds.has(f.id));

  return (
    <div className="main">
      <header className="main-header">
        <span>Arkadaşlar</span>
        <span className="sub">{onlineFriends.length} çevrimiçi</span>
      </header>

      <div className="friends-page">
        <div className="friends-tabs">
          <button className={`friends-tab ${tab === "online" ? "active" : ""}`} onClick={() => setTab("online")}>
            Tümü — {friends.length}
          </button>
          <button className={`friends-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
            Bekleyen — {incoming.length + outgoing.length}
          </button>
          <button className={`friends-tab ${tab === "add" ? "active" : ""}`} onClick={() => setTab("add")}>
            Arkadaş Ekle
          </button>
        </div>

        {tab === "online" && (
          <>
            {onlineFriends.length > 0 && (
              <>
                <div className="friends-section-title">Çevrimiçi — {onlineFriends.length}</div>
                {onlineFriends.map((f) => (
                  <div key={f.id} className="friend-card">
                    <div style={{ position: "relative" }}>
                      <Avatar name={f.username} color={f.avatarColor} size={40} />
                      <span className="online-dot" style={{ position: "absolute", bottom: 0, right: 0, border: "2px solid var(--bg-1)" }} />
                    </div>
                    <div className="fc-name">{f.username}</div>
                    <div className="fc-actions">
                      <button className="round-btn" title="Mesaj gönder" onClick={() => openDm(f)}>
                        <MessageIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {offlineFriends.length > 0 && (
              <>
                <div className="friends-section-title">Çevrimdışı — {offlineFriends.length}</div>
                {offlineFriends.map((f) => (
                  <div key={f.id} className="friend-card">
                    <Avatar name={f.username} color={f.avatarColor} size={40} />
                    <div className="fc-name" style={{ color: "var(--text-muted)" }}>{f.username}</div>
                    <div className="fc-actions">
                      <button className="round-btn" title="Mesaj gönder" onClick={() => openDm(f)}>
                        <MessageIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {friends.length === 0 && (
              <p className="empty-hint">Henüz arkadaşın yok. Arkadaş Ekle sekmesinden başla.</p>
            )}
          </>
        )}

        {tab === "pending" && (
          <>
            {incoming.length > 0 && (
              <>
                <div className="friends-section-title">Gelen İstekler — {incoming.length}</div>
                {incoming.map((req) => (
                  <div key={req.friendshipId} className="friend-card">
                    <Avatar name={req.user.username} color={req.user.avatarColor} size={40} />
                    <div className="fc-name">{req.user.username}</div>
                    <div className="fc-actions">
                      <button className="round-btn accept" title="Kabul et" onClick={() => accept(req.friendshipId)}>
                        <CheckIcon size={18} />
                      </button>
                      <button className="round-btn reject" title="Reddet" onClick={() => reject(req.friendshipId)}>
                        <XIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="friends-section-title">Giden İstekler — {outgoing.length}</div>
                {outgoing.map((req) => (
                  <div key={req.friendshipId} className="friend-card">
                    <Avatar name={req.user.username} color={req.user.avatarColor} size={40} />
                    <div className="fc-name">{req.user.username}</div>
                    <div className="fc-actions">
                      <button className="round-btn reject" title="İptal" onClick={() => reject(req.friendshipId)}>
                        <XIcon size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <p className="empty-hint">Bekleyen istek yok.</p>
            )}
          </>
        )}

        {tab === "add" && (
          <>
            <div className="friends-section-title">Kullanıcı adıyla ekle</div>
            {error && <div className="auth-error">{error}</div>}
            {success && <div style={{ color: "var(--green)", marginBottom: 12, fontSize: 14 }}>{success}</div>}
            <div className="add-friend-row">
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kullanici_adi"
                onKeyDown={(e) => e.key === "Enter" && sendRequest()}
              />
              <button className="btn" onClick={sendRequest} disabled={loading}>
                <UserPlusIcon size={18} />
                {loading ? "…" : "Gönder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
