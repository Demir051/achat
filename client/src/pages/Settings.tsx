import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useSettings } from "../store/settings";
import { useToast } from "../store/toast";
import { THEMES } from "../themes";
import Avatar from "../components/Avatar";
import Logo from "../components/Logo";
import "./settings.css";

type Tab = "profile" | "appearance" | "audio" | "security";

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme, micDeviceId, speakerDeviceId, setMicDevice, setSpeakerDevice } =
    useSettings();
  const toast = useToast((s) => s.push);
  const [tab, setTab] = useState<Tab>("profile");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage ?? "");
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? "#5865F2");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true }).then(() => {
      navigator.mediaDevices.enumerateDevices().then(setDevices);
    }).catch(() => {
      navigator.mediaDevices.enumerateDevices().then(setDevices);
    });
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch("/profile/me", {
        username,
        bio,
        statusMessage,
        avatarColor,
        theme,
        micDeviceId,
        speakerDeviceId,
      });
      setUser(data.user);
      toast("Profil kaydedildi", "success");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast(err?.response?.data?.error ?? "Kayıt başarısız", "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw) return toast("Tüm alanları doldur", "error");
    setSaving(true);
    try {
      await api.patch("/profile/me/password", { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw("");
      setNewPw("");
      toast("Şifre güncellendi", "success");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast(err?.response?.data?.error ?? "Şifre değiştirilemedi", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectTheme = (id: string) => {
    setTheme(id);
    toast(`Tema: ${THEMES.find((t) => t.id === id)?.name}`, "info");
  };

  const mics = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  const COLORS = ["#5865F2", "#EB459E", "#57F287", "#FEE75C", "#ED4245", "#3BA55D", "#FAA61A", "#9B59B6", "#7c6cff", "#3ecf8e"];

  return (
    <div className="settings-page">
      <header className="settings-header glass">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>← Geri</button>
        <div className="settings-brand">
          <Logo size={32} />
          <span>Ayarlar</span>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <div className="settings-body">
        <div className="settings-columns">
        <nav className="settings-nav glass">
          {([
            ["profile", "Profil"],
            ["appearance", "Görünüm"],
            ["audio", "Ses"],
            ["security", "Güvenlik"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              className={`settings-nav-item ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="settings-panel glass">
          {tab === "profile" && (
            <>
              <h2>Profil</h2>
              <p className="settings-desc">Herkese açık profil bilgilerin</p>
              <div className="profile-preview">
                <Avatar name={username || "?"} color={avatarColor} size={64} />
                <div>
                  <div className="profile-name">{username}</div>
                  <div className="profile-bio">{bio || "Henüz bio eklenmedi"}</div>
                </div>
              </div>
              <label className="field-label">Kullanıcı adı</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
              <label className="field-label">Bio</label>
              <textarea className="input textarea" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} />
              <label className="field-label">Durum mesajı</label>
              <input className="input" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder="Ne yapıyorsun?" maxLength={100} />
              <label className="field-label">Avatar rengi</label>
              <div className="color-row">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch ${avatarColor === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setAvatarColor(c)}
                  />
                ))}
              </div>
              <button className="btn" onClick={saveProfile} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </>
          )}

          {tab === "appearance" && (
            <>
              <h2>Görünüm & Temalar</h2>
              <p className="settings-desc">Uygulamanın görünümünü kişiselleştir. Her tema saydam cam efekti ve hareketli arka plan içerir.</p>
              <div className="theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`theme-card ${theme === t.id ? "active" : ""}`}
                    onClick={() => selectTheme(t.id)}
                  >
                    <div
                      className={`theme-preview ${t.wallpaper}`}
                      style={t.category === "series" ? undefined : { background: t.bg0 }}
                    >
                      <div className="theme-accent-bar" style={{ background: t.accent }} />
                    </div>
                    <div className="theme-card-info">
                      <strong>{t.name}</strong>
                      <span>{t.subtitle}</span>
                      <span className="theme-cat">{t.category === "series" ? "🎬 Dizi" : t.category === "color" ? "🎨 Renk" : "✦ Klasik"}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button className="btn" onClick={saveProfile} disabled={saving}>Temayı sunucuya kaydet</button>
            </>
          )}

          {tab === "audio" && (
            <>
              <h2>Ses Ayarları</h2>
              <p className="settings-desc">Mikrofon ve hoparlör cihazlarını seç</p>
              <label className="field-label">Mikrofon</label>
              <select className="input" value={micDeviceId} onChange={(e) => setMicDevice(e.target.value)}>
                <option value="">Varsayılan mikrofon</option>
                {mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
              <label className="field-label">Hoparlör</label>
              <select className="input" value={speakerDeviceId} onChange={(e) => setSpeakerDevice(e.target.value)}>
                <option value="">Varsayılan hoparlör</option>
                {speakers.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Hoparlör ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
              <p className="settings-hint">Sesli sohbete bir sonraki katılımında seçilen cihazlar kullanılır.</p>
              <button className="btn" onClick={saveProfile} disabled={saving}>Kaydet</button>
            </>
          )}

          {tab === "security" && (
            <>
              <h2>Güvenlik</h2>
              <p className="settings-desc">Şifreni düzenli olarak güncelle</p>
              <label className="field-label">Mevcut şifre</label>
              <input className="input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
              <label className="field-label">Yeni şifre</label>
              <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="En az 6 karakter" />
              <button className="btn" onClick={changePassword} disabled={saving}>
                {saving ? "Güncelleniyor…" : "Şifreyi güncelle"}
              </button>
            </>
          )}
        </main>
        </div>

        <footer className="settings-footer glass">
          <button
            className="btn btn-danger settings-logout"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Oturumu kapat
          </button>
        </footer>
      </div>
    </div>
  );
}
