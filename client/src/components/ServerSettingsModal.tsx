import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import { useToast } from "../store/toast";
import type { Role, ServerBot, ServerDetail } from "../types";

interface ServerSettingsModalProps {
  server: ServerDetail;
  onClose: () => void;
}

type Tab = "general" | "roles" | "bots";

const BOT_INFO: Record<string, { desc: string; cmds?: string }> = {
  PROFANITY_FILTER: { desc: "Küfür içeren mesajları sansürler veya engeller" },
  WELCOME: { desc: "Yeni üyelere karşılama mesajı gönderir. {user} = kullanıcı adı" },
  DICE: { desc: "Eğlence botu", cmds: "!zar veya !dice" },
  JOKE: { desc: "Rastgele şaka söyler", cmds: "!şaka veya !joke" },
  EIGHT_BALL: { desc: "Sihirli 8 top", cmds: "!8ball [soru]" },
};

export default function ServerSettingsModal({ server, onClose }: ServerSettingsModalProps) {
  const { refreshActiveServer } = useApp();
  const toast = useToast((s) => s.push);
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? "");
  const [welcomeEnabled, setWelcomeEnabled] = useState(server.welcomeEnabled ?? true);
  const [joinAnnouncements, setJoinAnnouncements] = useState(server.joinAnnouncements ?? true);
  const [locked, setLocked] = useState(server.locked ?? false);
  const [welcomeChannelId, setWelcomeChannelId] = useState(server.welcomeChannelId ?? "");
  const [roles, setRoles] = useState<Role[]>(server.roles ?? []);
  const [bots, setBots] = useState<ServerBot[]>(server.bots ?? []);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#99aab5");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoles(server.roles ?? []);
    setBots(server.bots ?? []);
    const welcomeBot = server.bots?.find((b) => b.type === "WELCOME");
    if (welcomeBot) {
      try {
        setWelcomeMsg(JSON.parse(welcomeBot.config).message ?? "");
      } catch { /* ignore */ }
    }
  }, [server]);

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await api.patch(`/servers/${server.id}/settings`, {
        name,
        description,
        welcomeEnabled,
        joinAnnouncements,
        locked,
        welcomeChannelId: welcomeChannelId || null,
      });
      const welcomeBot = bots.find((b) => b.type === "WELCOME");
      if (welcomeBot && welcomeMsg) {
        await api.patch(`/servers/${server.id}/bots/${welcomeBot.id}`, {
          config: { message: welcomeMsg },
        });
      }
      await refreshActiveServer();
      toast("Sunucu ayarları kaydedildi", "success");
    } catch {
      toast("Kayıt başarısız", "error");
    } finally {
      setSaving(false);
    }
  };

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      const { data } = await api.post(`/servers/${server.id}/roles`, {
        name: newRoleName.trim(),
        color: newRoleColor,
      });
      setRoles((r) => [...r, data.role]);
      setNewRoleName("");
      await refreshActiveServer();
      toast("Rol eklendi", "success");
    } catch {
      toast("Rol eklenemedi", "error");
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm("Bu rolü silmek istediğine emin misin?")) return;
    try {
      await api.delete(`/servers/${server.id}/roles/${roleId}`);
      setRoles((r) => r.filter((x) => x.id !== roleId));
      await refreshActiveServer();
    } catch {
      toast("Rol silinemedi", "error");
    }
  };

  const toggleBot = async (bot: ServerBot) => {
    try {
      const { data } = await api.patch(`/servers/${server.id}/bots/${bot.id}`, {
        enabled: !bot.enabled,
      });
      setBots((b) => b.map((x) => (x.id === bot.id ? data.bot : x)));
      await refreshActiveServer();
    } catch {
      toast("Bot güncellenemedi", "error");
    }
  };

  const textChannels = server.channels.filter((c) => c.type === "TEXT");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal server-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Sunucu Ayarları — {server.name}</h3>
        <p className="modal-sub">Sunucunu özelleştir, roller ve botları yönet</p>

        <div className="ss-tabs">
          {(["general", "roles", "bots"] as Tab[]).map((t) => (
            <button key={t} className={`ss-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "general" ? "Genel" : t === "roles" ? "Roller" : "Botlar"}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="ss-panel">
            <label className="field-label">Sunucu Adı</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="field-label">Açıklama</label>
            <textarea className="input textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

            <label className="field-label">Karşılama Kanalı</label>
            <select className="input" value={welcomeChannelId} onChange={(e) => setWelcomeChannelId(e.target.value)}>
              <option value="">İlk metin kanalı</option>
              {textChannels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>

            <label className="ss-check">
              <input type="checkbox" checked={joinAnnouncements} onChange={(e) => setJoinAnnouncements(e.target.checked)} />
              Katılım duyurusu (chatte göster)
            </label>
            <label className="ss-check">
              <input type="checkbox" checked={welcomeEnabled} onChange={(e) => setWelcomeEnabled(e.target.checked)} />
              Karşılama botu aktif
            </label>
            <label className="ss-check">
              <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
              Sunucuyu kilitle
            </label>
            {locked && (
              <p className="ss-hint ss-warn">
                Kilit açıkken davet kodunu paylaşabilirsin; ancak yeni üyeler katılamaz. Mevcut üyeler etkilenmez.
              </p>
            )}

            <label className="field-label">Karşılama Mesajı</label>
            <input className="input" value={welcomeMsg} onChange={(e) => setWelcomeMsg(e.target.value)} placeholder="Hoş geldin {user}!" />

            <p className="ss-hint">Davet kodu: <code>{server.inviteCode}</code></p>
          </div>
        )}

        {tab === "roles" && (
          <div className="ss-panel">
            <p className="ss-hint">Chatte &lt;@&rolId&gt; veya @rolAdı ile etiketle. Üye panelinden rol ver.</p>
            <div className="ss-role-list">
              {roles.map((r) => (
                <div key={r.id} className="ss-role-row">
                  <span className="role-tag" style={{ borderColor: r.color, color: r.color }}>@{r.name}</span>
                  {r.name !== "everyone" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteRole(r.id)}>Sil</button>
                  )}
                </div>
              ))}
            </div>
            <div className="ss-add-role">
              <input className="input" placeholder="Yeni rol adı" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
              <input type="color" value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} className="color-input" />
              <button className="btn btn-ghost" onClick={addRole}>Ekle</button>
            </div>
          </div>
        )}

        {tab === "bots" && (
          <div className="ss-panel">
            <p className="ss-hint">Sunucuna bot ekle ve işlev ata. Botlar otomatik çalışır.</p>
            {bots.map((bot) => (
              <div key={bot.id} className={`ss-bot-card ${bot.enabled ? "enabled" : ""}`}>
                <div className="ss-bot-head">
                  <strong>🤖 {bot.name}</strong>
                  <button className={`btn btn-sm ${bot.enabled ? "btn-ghost" : "btn"}`} onClick={() => toggleBot(bot)}>
                    {bot.enabled ? "Açık" : "Kapalı"}
                  </button>
                </div>
                <p className="ss-bot-desc">{BOT_INFO[bot.type]?.desc ?? bot.type}</p>
                {BOT_INFO[bot.type]?.cmds && (
                  <p className="ss-bot-cmd">Komut: {BOT_INFO[bot.type].cmds}</p>
                )}
                {bot.type === "PROFANITY_FILTER" && bot.enabled && (
                  <p className="ss-bot-cmd">Mod: sansür (küfürler *** olur)</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          {tab === "general" && (
            <button className="btn" onClick={saveGeneral} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
