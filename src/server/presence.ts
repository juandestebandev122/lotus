// Real presence. A user is "online" only if they were active very recently
// (the client sends a heartbeat every ~60s while the app is open). Having a
// saved login session is NOT enough — this avoids everyone looking "online".

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // active within the last 2 minutes

export function onlineStatus(lastSeen?: string): "online" | "offline" {
  if (!lastSeen) return "offline";
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && Date.now() - t < ONLINE_WINDOW_MS ? "online" : "offline";
}
