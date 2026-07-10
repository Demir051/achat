import { useState } from "react";
import Modal from "./Modal";
import { CopyIcon } from "./Icons";

export default function InviteModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal onClose={onClose}>
      <h3>Arkadaşlarını davet et</h3>
      <p className="modal-sub">Bu kodu paylaşarak sunucuna katılmalarını sağla.</p>

      <label className="field-label">Davet kodu</label>
      <div className="invite-code-box">
        {code}
        <button title="Kopyala" onClick={copy}>
          <CopyIcon size={18} />
        </button>
      </div>
      {copied && (
        <p style={{ color: "var(--green)", fontSize: 13, marginTop: 10 }}>Kopyalandı!</p>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Tamam</button>
      </div>
    </Modal>
  );
}
