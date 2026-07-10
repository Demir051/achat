import type { Role } from "../types";

const EMOJIS = [
  "😀", "😂", "🥰", "😎", "🤔", "😢", "😡", "👍", "👎", "❤️", "🔥", "✨",
  "🎉", "💯", "🙏", "👀", "💀", "🤡", "🎮", "🎵", "☕", "🍕", "⚡", "🌙",
  "🚀", "💬", "📌", "✅", "❌", "⭐", "🏆", "🎲", "🎬", "👑", "🤝", "💪",
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-grid">
        {EMOJIS.map((e) => (
          <button key={e} type="button" className="emoji-btn" onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
      <button type="button" className="emoji-picker-close" onClick={onClose}>
        Kapat
      </button>
    </div>
  );
}

export { EMOJIS };

interface MessageContentProps {
  content: string;
  members?: { id: string; username: string }[];
  roles?: Role[];
}

export function MessageContent({ content, members = [], roles = [] }: MessageContentProps) {
  const parts = content.split(/(@[\w]+|<@&[\w]+>)/g);

  return (
    <span className="msg-content">
      {parts.map((part, i) => {
        if (part.startsWith("@") && !part.startsWith("<@&")) {
          const name = part.slice(1);
          const user = members.find((m) => m.username.toLowerCase() === name.toLowerCase());
          return (
            <span key={i} className="mention mention-user" title={user?.username}>
              {part}
            </span>
          );
        }
        if (part.startsWith("<@&")) {
          const roleId = part.slice(3, -1);
          const role = roles.find((r) => r.id === roleId);
          return (
            <span
              key={i}
              className="mention mention-role"
              style={{ color: role?.color ?? "var(--accent)" }}
            >
              @{role?.name ?? "rol"}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function insertMention(text: string, username: string) {
  const mention = `@${username} `;
  return text ? `${text}${text.endsWith(" ") ? "" : " "}${mention}` : mention;
}

export function insertRoleMention(text: string, role: Role) {
  const mention = `<@&${role.id}> `;
  return text ? `${text}${text.endsWith(" ") ? "" : " "}${mention}` : mention;
}
