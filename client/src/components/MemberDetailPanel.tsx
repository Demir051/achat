import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useApp } from "../store/app";
import { useToast } from "../store/toast";
import type { MemberDetail, Role } from "../types";
import Avatar from "./Avatar";

interface MemberDetailPanelProps {
  userId: string;
  serverId: string;
  onClose: () => void;
}

export default function MemberDetailPanel({ userId, serverId, onClose }: MemberDetailPanelProps) {
  const { user } = useAuth();
  const { activeServer, refreshActiveServer } = useApp();
  const toast = useToast((s) => s.push);
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const isOwner = activeServer?.ownerId === user?.id;

  useEffect(() => {
    api
      .get(`/servers/${serverId}/members/${userId}`)
      .then(({ data }) => setMember(data.member))
      .catch(() => toast("Üye bilgisi yüklenemedi", "error"))
      .finally(() => setLoading(false));
  }, [userId, serverId, toast]);

  const toggleRole = async (role: Role) => {
    if (!member || !isOwner) return;
    const has = member.roles.some((r) => r.id === role.id);
    const roleIds = has
      ? member.roles.filter((r) => r.id !== role.id).map((r) => r.id)
      : [...member.roles.map((r) => r.id), role.id];

    try {
      const { data } = await api.put(`/servers/${serverId}/members/${userId}/roles`, { roleIds });
      setMember({ ...member, roles: data.roles });
      await refreshActiveServer();
      toast(has ? `@${role.name} kaldırıldı` : `@${role.name} verildi`, "success");
    } catch {
      toast("Rol güncellenemedi", "error");
    }
  };

  const kick = async () => {
    if (!confirm("Bu üyeyi sunucudan atmak istediğine emin misin?")) return;
    try {
      await api.delete(`/servers/${serverId}/members/${userId}`);
      await refreshActiveServer();
      toast("Üye atıldı", "success");
      onClose();
    } catch {
      toast("Üye atılamadı", "error");
    }
  };

  if (loading) return <aside className="member-detail"><div className="md-loading">Yükleniyor…</div></aside>;
  if (!member) return null;

  return (
    <aside className="member-detail">
      <button className="md-close" onClick={onClose}>✕</button>
      <div className="md-header">
        <Avatar name={member.username} color={member.avatarColor} size={72} />
        <h3>{member.username}</h3>
        {member.role === "OWNER" && <span className="md-badge">👑 Sunucu Sahibi</span>}
        {member.statusMessage && <p className="md-status">{member.statusMessage}</p>}
        {member.bio && <p className="md-bio">{member.bio}</p>}
      </div>

      <div className="md-section">
        <h4>Roller</h4>
        <div className="md-roles">
          {member.roles.map((r) => (
            <span key={r.id} className="role-tag" style={{ borderColor: r.color, color: r.color }}>
              @{r.name}
            </span>
          ))}
          {!member.roles.length && <span className="md-muted">Rol yok</span>}
        </div>
        {isOwner && member.role !== "OWNER" && activeServer?.roles && (
          <div className="md-role-assign">
            {activeServer.roles.map((r) => {
              const active = member.roles.some((mr) => mr.id === r.id);
              return (
                <button
                  key={r.id}
                  className={`role-toggle ${active ? "active" : ""}`}
                  style={{ borderColor: r.color, color: active ? r.color : "var(--text-muted)" }}
                  onClick={() => toggleRole(r)}
                >
                  @{r.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {member.joinedAt && (
        <div className="md-section">
          <h4>Katılım</h4>
          <p className="md-muted">{new Date(member.joinedAt).toLocaleDateString("tr-TR")}</p>
        </div>
      )}

      {isOwner && member.role !== "OWNER" && member.id !== user?.id && (
        <button className="btn btn-danger md-kick" onClick={kick}>
          Sunucudan At
        </button>
      )}
    </aside>
  );
}
