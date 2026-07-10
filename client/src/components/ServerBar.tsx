import { useState } from "react";
import { useApp } from "../store/app";
import { PlusIcon } from "./Icons";
import Logo from "./Logo";
import AddServerModal from "./AddServerModal";
export default function ServerBar() {
  const { servers, view, openHome, openServer } = useApp();
  const [showAdd, setShowAdd] = useState(false);

  const isHome = view.kind === "home";

  return (
    <>
      <nav className="server-bar">
        <div
          className={`server-icon server-home ${isHome ? "active" : ""}`}
          title="Ana sayfa"
          onClick={openHome}
        >
          <Logo size={34} />
          {!isHome && <span className="pill" />}
        </div>

        <div className="server-divider" />

        {servers.map((srv) => (
          <div
            key={srv.id}
            className={`server-icon ${view.kind === "server" && view.serverId === srv.id ? "active" : ""}`}
            style={{ background: srv.iconColor }}
            title={srv.name}
            onClick={() => openServer(srv.id)}
          >
            {srv.name.charAt(0).toUpperCase()}
            {!(view.kind === "server" && view.serverId === srv.id) && <span className="pill" />}
          </div>
        ))}

        <div className="server-icon server-add" title="Sunucu ekle" onClick={() => setShowAdd(true)}>
          <PlusIcon size={22} />
        </div>
      </nav>

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
