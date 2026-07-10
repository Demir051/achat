import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/app";
import Modal from "./Modal";
import { HashIcon, VolumeIcon } from "./Icons";

export default function CreateChannelModal({
  serverId,
  onClose,
}: {
  serverId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"TEXT" | "VOICE">("TEXT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refreshActiveServer = useApp((s) => s.refreshActiveServer);

  const submit = async () => {
    if (!name.trim()) return setError("Kanal adı gerekli");
    setLoading(true);
    setError("");
    try {
      await api.post(`/servers/${serverId}/channels`, { name: name.trim(), type });
      await refreshActiveServer();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error ?? "Kanal oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3>Kanal oluştur</h3>
      <p className="modal-sub">Sunucuna yeni bir metin veya sesli kanal ekle.</p>

      {error && <div className="auth-error">{error}</div>}

      <div className="type-select">
        <button
          type="button"
          className={`type-option ${type === "TEXT" ? "active" : ""}`}
          onClick={() => setType("TEXT")}
        >
          <HashIcon size={18} /> Metin
        </button>
        <button
          type="button"
          className={`type-option ${type === "VOICE" ? "active" : ""}`}
          onClick={() => setType("VOICE")}
        >
          <VolumeIcon size={18} /> Sesli
        </button>
      </div>

      <label className="field-label">Kanal adı</label>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={type === "TEXT" ? "genel-sohbet" : "Sesli Oda"}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>İptal</button>
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "Oluşturuluyor…" : "Oluştur"}
        </button>
      </div>
    </Modal>
  );
}
