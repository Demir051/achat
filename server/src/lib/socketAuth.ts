import type { Socket } from "socket.io";
import { prisma } from "./prisma.js";

export async function isServerMember(userId: string, serverId: string) {
  const m = await prisma.member.findUnique({
    where: { userId_serverId: { userId, serverId } },
  });
  return !!m;
}

export async function isChannelMember(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return false;
  return isServerMember(userId, channel.serverId);
}

export async function isVoiceChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  return channel?.type === "VOICE";
}

export async function areFriends(userId: string, otherId: string) {
  if (userId === otherId) return false;
  const f = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: userId },
      ],
    },
  });
  return !!f;
}

export function isInVoiceRoom(socket: Socket, channelId: string, voiceRooms: Map<string, Map<string, unknown>>) {
  const room = voiceRooms.get(channelId);
  return room?.has(socket.id) ?? false;
}

export function isPeerInVoiceRoom(
  targetSocketId: string,
  channelId: string,
  voiceRooms: Map<string, Map<string, unknown>>
) {
  const room = voiceRooms.get(channelId);
  return room?.has(targetSocketId) ?? false;
}
