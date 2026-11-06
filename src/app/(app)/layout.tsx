import { AppShell } from "@/components/app-shell/AppShell";
import { NotificationsProvider } from "@/lib/notifications";
import { GiftProvider } from "@/components/GiftProvider";
import { VoiceProvider } from "@/lib/VoiceProvider";
import { MediaProvider } from "@/lib/MediaProvider";
import { VoiceDock } from "@/components/VoiceDock";
import { GameInviteListener } from "@/components/GameInviteListener";
import { IncomingCallListener } from "@/components/IncomingCallListener";
import { BgMusicPlayer } from "@/components/BgMusicPlayer";
import { ReturnToGame } from "@/components/ReturnToGame";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationsProvider>
      <GiftProvider>
        <VoiceProvider>
          <MediaProvider>
            <AppShell>{children}</AppShell>
            <VoiceDock />
            <GameInviteListener />
            <IncomingCallListener />
            {/* Admin-managed per-screen background music (Admin → Sound & Music). */}
            <BgMusicPlayer />
            {/* Shows only when a player arrived here FROM a live game, so they
                always have one tap back to the match. */}
            <ReturnToGame />
          </MediaProvider>
        </VoiceProvider>
      </GiftProvider>
    </NotificationsProvider>
  );
}
