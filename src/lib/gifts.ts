// ============================================================
// In-game gifts. Players spend coins to send a small gift to
// another group member during a game or inside a Voice Room —
// the gift pops up on screen for everyone to see.
// (Coin balance is on the user object; cross-device delivery
//  arrives with the real-time backend.)
// ============================================================

export interface Gift {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  category?: string;
  active?: boolean;
}

// Default catalog. Editable by the admin (Admin → Gifts); this list is the
// seed + the fallback when the admin catalog is empty.
export const GIFTS: Gift[] = [
  { id: "rose", emoji: "🌹", name: "Rose", cost: 50, category: "Popular", active: true },
  { id: "lotus", emoji: "🪷", name: "Lotus", cost: 100, category: "Popular", active: true },
  { id: "butterfly", emoji: "🦋", name: "Butterfly", cost: 100, category: "Popular", active: true },
  { id: "cake", emoji: "🍰", name: "Cake", cost: 50, category: "Fun", active: true },
  { id: "tea", emoji: "☕", name: "Chai", cost: 50, category: "Fun", active: true },
  { id: "egg", emoji: "🥚", name: "Egg", cost: 50, category: "Fun", active: true },
  { id: "fist", emoji: "👊", name: "Punch", cost: 50, category: "Fun", active: true },
  { id: "hammer", emoji: "🔨", name: "Hammer", cost: 50, category: "Fun", active: true },
  { id: "clock", emoji: "⏰", name: "Alarm", cost: 50, category: "Fun", active: true },
  { id: "bucket", emoji: "🪣", name: "Splash", cost: 50, category: "Fun", active: true },
  { id: "heart", emoji: "❤️", name: "Heart", cost: 100, category: "Love", active: true },
  { id: "fire", emoji: "🔥", name: "Fire", cost: 100, category: "Love", active: true },
  { id: "crown", emoji: "👑", name: "Crown", cost: 200, category: "Premium", active: true },
  { id: "diamond", emoji: "💎", name: "Diamond", cost: 500, category: "Premium", active: true },
  { id: "trophy", emoji: "🏆", name: "Trophy", cost: 500, category: "Premium", active: true },
  { id: "rocket", emoji: "🚀", name: "Rocket", cost: 1000, category: "Premium", active: true },
];

export function giftById(id: string): Gift | undefined {
  return GIFTS.find((g) => g.id === id);
}
