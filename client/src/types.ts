export interface User {
  id: string;
  username: string;
  email?: string;
  avatarColor: string;
  bio?: string;
  theme?: string;
  micDeviceId?: string;
  speakerDeviceId?: string;
  statusMessage?: string;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  mentionable: boolean;
}

export interface ServerBot {
  id: string;
  serverId: string;
  type: string;
  name: string;
  enabled: boolean;
  config: string;
}

export interface ServerSummary {
  id: string;
  name: string;
  iconColor: string;
  inviteCode: string;
  ownerId: string;
  description?: string;
  welcomeEnabled?: boolean;
  joinAnnouncements?: boolean;
  welcomeChannelId?: string | null;
}

export interface Channel {
  id: string;
  name: string;
  type: "TEXT" | "VOICE";
  position: number;
  serverId: string;
}

export interface Member extends User {
  role: string;
  joinedAt?: string;
  roles?: Role[];
}

export interface ServerDetail extends ServerSummary {
  channels: Channel[];
  members: Member[];
  roles?: Role[];
  bots?: ServerBot[];
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  authorId: string | null;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
  system?: boolean;
  botLabel?: string | null;
  author: User | null;
}

export interface DirectMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: User;
}

export interface Friend {
  id: string;
  username: string;
  avatarColor: string;
}

export interface FriendRequest {
  friendshipId: string;
  user: Friend;
}

export interface VoiceParticipant {
  socketId: string;
  userId: string;
  username: string;
  avatarColor: string;
  muted: boolean;
  screenSharing: boolean;
}

export interface MemberDetail extends Member {
  joinedAt: string;
  roles: Role[];
}
