import { useApp } from "../store/app";
import Avatar from "./Avatar";
import type { Member } from "../types";

interface MemberListProps {
  onSelectMember?: (member: Member) => void;
}

export default function MemberList({ onSelectMember }: MemberListProps) {
  const activeServer = useApp((s) => s.activeServer);
  if (!activeServer) return null;

  const owners = activeServer.members.filter((m) => m.role === "OWNER");
  const members = activeServer.members.filter((m) => m.role !== "OWNER");

  const renderMember = (m: Member) => (
    <div key={m.id} className="member-row" onClick={() => onSelectMember?.(m)}>
      <Avatar name={m.username} color={m.avatarColor} size={32} />
      <div className="member-info">
        <span className="m-name">{m.username}</span>
        {m.roles && m.roles.length > 0 && (
          <div className="member-roles">
            {m.roles.slice(0, 2).map((r) => (
              <span key={r.id} className="role-tag-sm" style={{ color: r.color }}>@{r.name}</span>
            ))}
          </div>
        )}
      </div>
      {m.role === "OWNER" && <span className="crown">👑</span>}
    </div>
  );

  return (
    <aside className="member-list">
      {owners.length > 0 && (
        <>
          <div className="group-title">Sahip — {owners.length}</div>
          {owners.map(renderMember)}
        </>
      )}
      <div className="group-title">Üyeler — {members.length}</div>
      {members.map(renderMember)}
    </aside>
  );
}
