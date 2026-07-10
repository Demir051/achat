import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../store/auth";
import "./auth.css";

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string; code?: string };
      if (!e.response) {
        setError("Sunucuya bağlanılamadı. Backend çalışıyor mu? (npm run dev --prefix server)");
      } else {
        setError(e?.response?.data?.error ?? "Giriş başarısız");
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
          <h1>Konuşmanın en sade hâli.</h1>
          <p>Sunucular kur, sesli sohbete katıl, ekranını paylaş — hepsi tek bir zarif yerde.</p>
          <div className="auth-features">
            <div className="auth-feature"><span className="auth-feature-dot" />Gerçek zamanlı sunucu sohbeti</div>
            <div className="auth-feature"><span className="auth-feature-dot" />10 temalı görünüm & dizi modları</div>
            <div className="auth-feature"><span className="auth-feature-dot" />Kristal netliğinde sesli kanallar</div>
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
          <h2>Tekrar hoş geldin</h2>
          <p className="sub">Hesabına giriş yaparak kaldığın yerden devam et.</p>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>E-posta</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sen@ornek.com" required autoFocus />
          </div>
          <div className="auth-field">
            <label>Şifre</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <button className="btn auth-submit" disabled={loading}>
            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
          </button>

          <div className="auth-switch">
            Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
