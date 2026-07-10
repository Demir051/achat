import { useEffect, useState } from "react";

import { api } from "../lib/api";

import { useAuth } from "../store/auth";
import { useApp } from "../store/app";

import { VoiceProvider } from "../context/VoiceContext";

import ChannelSidebar from "../components/ChannelSidebar";

import ChatView from "../components/ChatView";

import DmSidebar from "../components/DmSidebar";

import FriendsPanel from "../components/FriendsPanel";

import MemberList from "../components/MemberList";
import MemberDetailPanel from "../components/MemberDetailPanel";

import ServerBar from "../components/ServerBar";

import VoiceBar from "../components/VoiceBar";

import VoiceRoom from "../components/VoiceRoom";
import { MenuIcon } from "../components/Icons";

import { useVoice } from "../store/voice";

import type { DirectMessage, Member } from "../types";
import { getSocket } from "../lib/socket";
import "./app.css";
import "./mobile.css";
import { useIsMobile } from "../hooks/useIsMobile";



function HomeContent() {

  const { user } = useAuth();
  const { view, activeServer, activeChannel, activeDmUserId, ready, restoreSession, setActiveChannel, addUnreadDm } =
    useApp();

  const connectedChannelId = useVoice((s) => s.connectedChannelId);

  const [showMembers, setShowMembers] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const [dmFriend, setDmFriend] = useState<{ id: string; username: string } | null>(null);



  useEffect(() => {
    if (user?.id) {
      restoreSession(user.id);
    }
  }, [user?.id, restoreSession]);



  useEffect(() => {

    if (!activeDmUserId) {

      setDmFriend(null);

      return;

    }

    api.get("/users/friends").then(({ data }) => {

      const f = data.friends.find((x: { id: string }) => x.id === activeDmUserId);

      if (f) setDmFriend({ id: f.id, username: f.username });

    });

  }, [activeDmUserId]);



  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const onDm = (msg: DirectMessage) => {
      if (msg.senderId === user.id) return;
      if (msg.senderId === activeDmUserId) return;
      addUnreadDm(msg.senderId);
    };

    socket.on("dm:message", onDm);
    return () => {
      socket.off("dm:message", onDm);
    };
  }, [user, activeDmUserId, addUnreadDm]);

  useEffect(() => {
    if (!isMobile) return;
    setShowMembers(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const hasMain =
      (view.kind === "home" && !!activeDmUserId) ||
      (view.kind === "server" && !!activeChannel);
    if (hasMain) setMobileSidebarOpen(false);
  }, [isMobile, view.kind, activeDmUserId, activeChannel?.id]);

  useEffect(() => {
    if (!isMobile || view.kind !== "server") return;
    if (activeServer && !activeChannel) setMobileSidebarOpen(true);
  }, [isMobile, view.kind, activeServer?.id, activeChannel?.id]);

  const openMobileSidebar = () => setMobileSidebarOpen(true);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);
  const closeMembers = () => {
    setShowMembers(false);
    setSelectedMember(null);
  };



  const inVoiceView =

    view.kind === "server" &&

    activeChannel?.type === "VOICE" &&

    connectedChannelId === activeChannel.id;



  const mobileMenuBtn = isMobile ? (
    <button type="button" className="hbtn mobile-menu-btn" aria-label="Menü" onClick={openMobileSidebar}>
      <MenuIcon size={22} />
    </button>
  ) : null;

  const renderMain = () => {

    if (view.kind === "home") {

      if (activeDmUserId && dmFriend) {

        return (

          <ChatView
            mode="dm"
            dmUserId={dmFriend.id}
            title={dmFriend.username}
            subtitle="Özel mesaj"
            showMenuButton={isMobile}
            onMenuClick={openMobileSidebar}
          />

        );

      }

      return <FriendsPanel showMenuButton={isMobile} onMenuClick={openMobileSidebar} />;

    }



    if (!activeServer || !activeChannel) {

      return (
        <div className="main">
          <header className="main-header">
            {mobileMenuBtn}
            <span>{activeServer?.name ?? "Sunucu"}</span>
          </header>
          <div className="chat-empty">
            <div className="big">Bir kanal seç</div>
            <p>Sol menüden bir metin veya sesli kanala tıkla.</p>
          </div>
        </div>
      );

    }



    if (inVoiceView) {
      return (
        <VoiceRoom
          showMenuButton={isMobile}
          onMenuClick={openMobileSidebar}
          showMembersToggle={isMobile}
          membersVisible={showMembers}
          onToggleMembers={() => setShowMembers((v) => !v)}
        />
      );
    }



    if (activeChannel.type === "TEXT") {

      return (

        <ChatView
          mode="channel"
          channelId={activeChannel.id}
          title={activeChannel.name}
          subtitle={activeServer.name}
          showMembersToggle
          membersVisible={showMembers}
          onToggleMembers={() => setShowMembers((v) => !v)}
          members={activeServer.members}
          roles={activeServer.roles ?? []}
          showMenuButton={isMobile}
          onMenuClick={openMobileSidebar}
        />

      );

    }



    return (
      <div className="main">
        <header className="main-header">
          {mobileMenuBtn}
          <span>{activeServer?.name ?? "Sunucu"}</span>
        </header>
        <div className="chat-empty">
          <div className="big">Bir kanal seç</div>
          <p>Metin kanallarından birine geçebilirsin — sesli bağlantın korunur.</p>
        </div>
      </div>
    );

  };



  const showMembersPanel =
    view.kind === "server" &&
    activeServer &&
    showMembers &&
    (activeChannel?.type === "TEXT" || inVoiceView);

  const appClass = [
    "app",
    isMobile ? "mobile" : "",
    mobileSidebarOpen ? "sidebar-open" : "",
    isMobile && showMembersPanel ? "members-open" : "",
  ]
    .filter(Boolean)
    .join(" ");



  if (!ready) {
    return (
      <div className="app app-loading">
        <div className="chat-empty">
          <div className="big">Yükleniyor…</div>
        </div>
      </div>
    );
  }

  return (

    <div className={appClass}>

      <ServerBar />

      <div className="app-body">
        {isMobile && mobileSidebarOpen && (
          <div className="mobile-backdrop" onClick={closeMobileSidebar} aria-hidden />
        )}
        {isMobile && showMembersPanel && (
          <div className="mobile-backdrop" onClick={closeMembers} aria-hidden />
        )}

        {view.kind === "home" ? (
          <DmSidebar onNavigate={closeMobileSidebar} />
        ) : (
          <ChannelSidebar onNavigate={closeMobileSidebar} />
        )}

        <div className="main-area">

          <div className="main-area-content">

            {renderMain()}

            {showMembersPanel && !selectedMember && (
              <MemberList onSelectMember={setSelectedMember} />
            )}
            {showMembersPanel && selectedMember && activeServer && (
              <MemberDetailPanel
                userId={selectedMember.id}
                serverId={activeServer.id}
                onClose={closeMembers}
              />
            )}

          </div>

          <VoiceBar />

        </div>
      </div>

    </div>

  );

}



export default function Home() {

  return (

    <VoiceProvider>

      <HomeContent />

    </VoiceProvider>

  );

}

