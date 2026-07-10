import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";
import type { DirectMessage, Message, Role } from "../types";
import Avatar from "./Avatar";
import EmojiPicker, { MessageContent, insertMention, insertRoleMention } from "./MessageContent";
import { HashIcon, SendIcon, UsersIcon } from "./Icons";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

interface ChatViewProps {
  mode: "channel" | "dm";
  channelId?: string;
  dmUserId?: string;
  title: string;
  subtitle?: string;
  showMembersToggle?: boolean;
  membersVisible?: boolean;
  onToggleMembers?: () => void;
  members?: { id: string; username: string; avatarColor: string }[];
  roles?: Role[];
}

export default function ChatView({
  mode,
  channelId,
  dmUserId,
  title,
  subtitle,
  showMembersToggle,
  membersVisible,
  onToggleMembers,
  members = [],
  roles = [],
}: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<(Message | DirectMessage)[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useToast((s) => s.push);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (mode === "channel" && channelId) {
          const { data } = await api.get(`/messages/channel/${channelId}`);
          if (!cancelled) setMessages(data.messages);
        } else if (mode === "dm" && dmUserId) {
          const { data } = await api.get(`/dm/${dmUserId}`);
          if (!cancelled) setMessages(data.messages);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, channelId, dmUserId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (mode === "channel" && channelId) {
      socket.emit("channel:join", channelId);
      const onMsg = (msg: Message) => {
        if (msg.channelId === channelId && !msg.deleted)
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      };
      const onUpdate = (msg: Message) => {
        if (msg.channelId !== channelId) return;
        if (msg.deleted) {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        } else {
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
        }
      };
      const onTyping = (p: { channelId: string; username: string }) => {
        if (p.channelId !== channelId) return;
        setTypingUser(p.username);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingUser(null), 3000);
      };
      socket.on("channel:message", onMsg);
      socket.on("channel:message:update", onUpdate);
      socket.on("channel:typing", onTyping);
      return () => {
        socket.emit("channel:leave", channelId);
        socket.off("channel:message", onMsg);
        socket.off("channel:message:update", onUpdate);
        socket.off("channel:typing", onTyping);
      };
    }

    if (mode === "dm" && dmUserId) {
      const onMsg = (msg: DirectMessage) => {
        const involved = msg.senderId === dmUserId || msg.receiverId === dmUserId;
        if (involved)
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      };
      socket.on("dm:message", onMsg);
      return () => socket.off("dm:message", onMsg);
    }
  }, [mode, channelId, dmUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const onInputChange = (val: string) => {
    setText(val);
    const atMatch = val.match(/@(\w*)$/);
    setMentionQuery(atMatch ? atMatch[1].toLowerCase() : null);

    if (mode === "channel" && channelId && val.trim()) {
      getSocket()?.emit("channel:typing", { channelId });
    }
  };

  const pickMention = (username: string) => {
    const atIdx = text.lastIndexOf("@");
    const base = atIdx >= 0 ? text.slice(0, atIdx) : text;
    setText(insertMention(base, username));
    setMentionQuery(null);
  };

  const pickRoleMention = (role: Role) => {
    setText((t) => insertRoleMention(t, role));
    setMentionQuery(null);
  };

  const send = () => {
    const content = text.trim();
    if (!content) return;
    const socket = getSocket();
    if (!socket) return;

    const onAck = (res: Message | DirectMessage | { error?: string }) => {
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      if ("id" in res)
        setMessages((prev) => (prev.some((m) => m.id === res.id) ? prev : [...prev, res]));
    };

    if (mode === "channel" && channelId) {
      socket.emit("channel:message", { channelId, content }, onAck);
    } else if (mode === "dm" && dmUserId) {
      socket.emit("dm:message", { receiverId: dmUserId, content }, onAck);
    }
    setText("");
    setShowEmoji(false);
    setMentionQuery(null);
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.content);
    setMenuId(null);
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    const socket = getSocket();
    socket?.emit("channel:message:edit", { messageId: editingId, content: editText.trim() }, (res: Message | { error?: string }) => {
      if ("error" in res && res.error) toast(res.error, "error");
      else setEditingId(null);
    });
  };

  const deleteMsg = (id: string) => {
    const socket = getSocket();
    socket?.emit("channel:message:delete", { messageId: id }, (res: { error?: string }) => {
      if (res?.error) toast(res.error, "error");
    });
    setMenuId(null);
  };

  const getAuthor = (msg: Message | DirectMessage) => {
    if ("author" in msg && msg.author) return msg.author;
    if ("sender" in msg) return msg.sender;
    return null;
  };

  const shouldGroup = (idx: number) => {
    if (idx === 0) return false;
    const prev = messages[idx - 1] as Message;
    const curr = messages[idx] as Message;
    if ("system" in curr && curr.system) return false;
    const prevAuthor = "authorId" in prev ? prev.authorId : (prev as DirectMessage).senderId;
    const currAuthor = "authorId" in curr ? curr.authorId : (curr as DirectMessage).senderId;
    const timeDiff = new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
    return prevAuthor === currAuthor && timeDiff < 5 * 60 * 1000;
  };

  const mentionSuggestions = mentionQuery !== null
    ? members.filter((m) => m.username.toLowerCase().startsWith(mentionQuery)).slice(0, 6)
    : [];

  return (
    <div className="main">
      <header className="main-header">
        {mode === "channel" && (
          <HashIcon size={20} className="ch-icon" style={{ color: "var(--text-faint)" }} />
        )}
        <span>{title}</span>
        {subtitle && <span className="sub">{subtitle}</span>}
        <span className="spacer" />
        {showMembersToggle && (
          <button className={`hbtn ${membersVisible ? "active" : ""}`} title="Üye listesi" onClick={onToggleMembers}>
            <UsersIcon size={20} />
          </button>
        )}
      </header>

      <div className="chat-body">
        {loading ? (
          <div className="chat-empty">Mesajlar yükleniyor…</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="big">Henüz mesaj yok</div>
            <p>İlk mesajı sen gönder! @kullanıcı veya rol etiketleyebilirsin.</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, idx) => {
              const channelMsg = msg as Message;
              const isSystem = channelMsg.system;
              const author = getAuthor(msg);
              const grouped = shouldGroup(idx);
              const isOwn = author?.id === user?.id;
              const displayName = isSystem ? (channelMsg.botLabel ?? "Bot") : author?.username ?? "?";
              const avatarColor = isSystem ? "#5865F2" : author?.avatarColor ?? "#5865F2";

              return (
                <div
                  key={msg.id}
                  className={`msg ${grouped ? "grouped" : ""} ${isSystem ? "system-msg" : ""}`}
                  onContextMenu={(e) => {
                    if (mode === "channel" && !isSystem) {
                      e.preventDefault();
                      setMenuId(msg.id);
                    }
                  }}
                >
                  <div className="avatar-slot">
                    {!grouped && (
                      isSystem ? (
                        <div className="bot-avatar">🤖</div>
                      ) : (
                        <Avatar name={displayName} color={avatarColor} size={40} />
                      )
                    )}
                  </div>
                  <div className="body">
                    {!grouped && (
                      <div className="meta">
                        <span className={`author ${isSystem ? "bot-name" : ""}`}>{displayName}</span>
                        <span className="time">
                          {formatTime(msg.createdAt)}
                          {channelMsg.editedAt && " (düzenlendi)"}
                        </span>
                        {mode === "channel" && !isSystem && (
                          <button className="msg-menu-btn" onClick={() => setMenuId(menuId === msg.id ? null : msg.id)}>⋯</button>
                        )}
                      </div>
                    )}
                    {editingId === msg.id ? (
                      <div className="edit-row">
                        <input className="input" value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                        <button className="btn btn-sm" onClick={saveEdit}>Kaydet</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>İptal</button>
                      </div>
                    ) : (
                      <div className="text">
                        <MessageContent content={msg.content} members={members} roles={roles} />
                      </div>
                    )}
                    {menuId === msg.id && (
                      <div className="msg-menu">
                        {(isOwn || user?.id) && (
                          <button onClick={() => startEdit(channelMsg)}>Düzenle</button>
                        )}
                        <button className="danger" onClick={() => deleteMsg(msg.id)}>Sil</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {typingUser && <div className="typing-indicator">{typingUser} yazıyor…</div>}

        <div className="composer">
          {mentionSuggestions.length > 0 && (
            <div className="mention-suggestions">
              {mentionSuggestions.map((m) => (
                <button key={m.id} onClick={() => pickMention(m.username)}>@{m.username}</button>
              ))}
              {roles.filter((r) => r.name.toLowerCase().startsWith(mentionQuery ?? "")).map((r) => (
                <button key={r.id} onClick={() => pickRoleMention(r)} style={{ color: r.color }}>@{r.name}</button>
              ))}
            </div>
          )}
          {showEmoji && (
            <EmojiPicker
              onPick={(e) => setText((t) => t + e)}
              onClose={() => setShowEmoji(false)}
            />
          )}
          <div className="composer-inner">
            <button type="button" className="composer-emoji" onClick={() => setShowEmoji((s) => !s)} title="Emoji">
              😊
            </button>
            <input
              value={text}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={`${title} kanalına mesaj gönder… (@etiket, !zar, !şaka)`}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            />
            <button className="composer-send" onClick={send} disabled={!text.trim()}>
              <SendIcon size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
