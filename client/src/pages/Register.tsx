import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../store/auth";
import "./auth.css";

export default function Register() {
  const register = useAuth((s) => s.register);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(username, email, password);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      if (!e.response) {
        setError("Sunucuya bağlanılamadı. Backend çalışıyor mu? (npm run dev --prefix server)");
      } else {
        setError(e?.response?.data?.error ?? "Kayıt başarısız");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-hero-logo">
            <Logo size={52} />
          </div>
          <h1>Topluluğun burada başlıyor.</h1>
          <p>Saniyeler içinde katıl. İlk sunucunu kur, arkadaşlarını davet et ve konuşmaya başla.</p>
          <div className="auth-features">
            <div className="auth-feature"><span className="auth-feature-dot" />Ücretsiz ve sınırsız sunucu</div>
            <div className="auth-feature"><span className="auth-feature-dot" />Dark, GOT, Breaking Bad temaları</div>
            <div className="auth-feature"><span className="auth-feature-dot" />Arkadaşlık & özel mesajlar</div>
          </div>
        </div>
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-panel">
        <form className="auth-card glass" onSubmit={submit}>
          <div className="auth-card-logo">
            <Logo size={36} />
          </div>
          <h2>Hesap oluştur</h2>
          <p className="sub">achat dünyasına katılmak için birkaç bilgi yeterli.</p>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Kullanıcı adı</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="kullanici_adi" required autoFocus />
          </div>
          <div className="auth-field">
            <label>E-posta</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sen@ornek.com" required />
          </div>
          <div className="auth-field">
            <label>Şifre</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="En az 6 karakter" required />
          </div>

          <button className="btn auth-submit" disabled={loading}>
            {loading ? "Oluşturuluyor…" : "Kayıt ol"}
          </button>

          <div className="auth-switch">
            Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
