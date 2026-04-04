function memberIds(room) {
  const m = room.members || room.Members || [];
  return m.map((x) => String(x.userId ?? x.UserId));
}

/** Room 1–1: đúng 2 thành viên gồm myId và peerId */
export function findDirectRoom(rooms, myId, peerId) {
  if (!Array.isArray(rooms) || myId == null || peerId == null) return undefined;
  const a = String(myId);
  const b = String(peerId);
  return rooms.find((r) => {
    const ids = memberIds(r);
    return ids.length === 2 && ids.includes(a) && ids.includes(b);
  });
}

export function roomIdOf(room) {
  return room?.id ?? room?.Id;
}
