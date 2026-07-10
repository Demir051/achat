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

import { useVoice } from "../store/voice";

import type { DirectMessage, Member } from "../types";
import { getSocket } from "../lib/socket";
import "./app.css";



function HomeContent() {

  const { user } = useAuth();
  const { view, activeServer, activeChannel, activeDmUserId, ready, restoreSession, setActiveChannel, addUnreadDm } =
    useApp();

  const connectedChannelId = useVoice((s) => s.connectedChannelId);

  const [showMembers, setShowMembers] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

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



  const inVoiceView =

    view.kind === "server" &&

    activeChannel?.type === "VOICE" &&

    connectedChannelId === activeChannel.id;



  const renderMain = () => {

    if (view.kind === "home") {

      if (activeDmUserId && dmFriend) {

        return (

          <ChatView

            mode="dm"

            dmUserId={dmFriend.id}

            title={dmFriend.username}

            subtitle="Özel mesaj"

          />

        );

      }

      return <FriendsPanel />;

    }



    if (!activeServer || !activeChannel) {

      return (

        <div className="main">

          <div className="chat-empty">

            <div className="big">Bir kanal seç</div>

            <p>Sol taraftan bir metin veya sesli kanala tıkla.</p>

          </div>

        </div>

      );

    }



    if (inVoiceView) {

      return <VoiceRoom />;

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
        />

      );

    }



    return (

      <div className="main">

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

    <div className="app">

      <ServerBar />

      {view.kind === "home" ? <DmSidebar /> : <ChannelSidebar />}

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
              onClose={() => setSelectedMember(null)}
            />
          )}

        </div>

        <VoiceBar />

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

