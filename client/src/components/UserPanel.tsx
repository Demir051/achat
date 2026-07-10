import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import Avatar from "./Avatar";
import { LogoutIcon, SettingsIcon } from "./Icons";

export default function UserPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="user-panel">
      <Avatar name={user.username} color={user.avatarColor} size={32} />
      <div className="info">
        <div className="name">{user.username}</div>
        <div className="tag">{user.statusMessage || `#${user.id.slice(-4)}`}</div>
      </div>
      <button className="icon-btn" title="Ayarlar" onClick={() => navigate("/settings")}>
        <SettingsIcon size={18} />
      </button>
      <button className="icon-btn" title="Çıkış yap" onClick={logout}>
        <LogoutIcon size={18} />
      </button>
    </div>
  );
}
