import {
  Dices,
  Crown,
  Gamepad2,
  Joystick,
  Puzzle,
  Target,
  Trophy,
  Swords,
  Heart,
  Star,
  Zap,
  Rocket,
  Ticket,
  type LucideIcon,
} from "lucide-react";

// Game icons use Lucide SVGs (not emoji) so they render reliably on every
// device/browser. Each game stores an `icon` key from this map.
export const GAME_ICONS: Record<string, LucideIcon> = {
  dice: Dices,
  crown: Crown,
  gamepad: Gamepad2,
  joystick: Joystick,
  puzzle: Puzzle,
  target: Target,
  trophy: Trophy,
  swords: Swords,
  heart: Heart,
  star: Star,
  zap: Zap,
  rocket: Rocket,
  ticket: Ticket,
};

export const GAME_ICON_KEYS = Object.keys(GAME_ICONS);

export function gameIcon(key?: string): LucideIcon {
  return (key && GAME_ICONS[key]) || Gamepad2;
}

/** Default icon for a game id (used for built-ins and as a fallback). */
export function iconForId(id: string): string {
  if (id === "ludo") return "dice";
  if (id === "chess") return "crown";
  if (id === "snake") return "joystick";
  if (id === "lucky-number") return "ticket";
  return "gamepad";
}
