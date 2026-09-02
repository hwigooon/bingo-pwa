export function buildInviteUrl(origin: string, basePath: string, roomCode: string): string {
  const url = new URL(basePath, origin);
  url.searchParams.set("room", roomCode.trim().toUpperCase());
  return url.toString();
}
