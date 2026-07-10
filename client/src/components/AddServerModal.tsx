import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import Modal from "./Modal";

export default function AddServerModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { addServer, openServer } = useApp();

  const create = async () => {
    if (name.trim().length < 2) return setError("Sunucu adı en az 2 karakter olmalı");
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/servers", { name: name.trim() });
      addServer(data.server);
      await openServer(data.server.id);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Sunucu oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  const join = async () => {
    if (!code.trim()) return setError("Davet kodu gerekli");
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/servers/join", { inviteCode: code.trim() });
      addServer(data.server);
      await openServer(data.server.id);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Katılım başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3>Sunucun olsun</h3>
      <p className="modal-sub">Yeni bir sunucu oluştur ya da davet koduyla mevcut birine katıl.</p>

      <div className="modal-tabs">
        <button className={`modal-tab ${tab === "create" ? "active" : ""}`} onClick={() => setTab("create")}>
          Oluştur
        </button>
        <button className={`modal-tab ${tab === "join" ? "active" : ""}`} onClick={() => setTab("join")}>
          Katıl
        </button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {tab === "create" ? (
        <>
          <label className="field-label">Sunucu adı</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Kod & Kahve"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>İptal</button>
            <button className="btn" onClick={create} disabled={loading}>
              {loading ? "Oluşturuluyor…" : "Oluştur"}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field-label">Davet kodu</label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Örn: aB3xK9mZ"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>İptal</button>
            <button className="btn" onClick={join} disabled={loading}>
              {loading ? "Katılınıyor…" : "Katıl"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
