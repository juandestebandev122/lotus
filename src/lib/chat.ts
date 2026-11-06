import { USERS } from "./mock-data";
import type { User } from "./types";

// ============================================================
// Chat seed + helpers. Conversations are session state held by
// the Messages page. (Swaps for a real messaging API later.)
// ============================================================

export type ChatPeer = Pick<User, "id" | "fullName" | "username" | "avatar" | "status" | "verified">;

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  time: string; // "HH:MM"
}

export interface Conversation {
  id: string;
  peer: ChatPeer;
  messages: ChatMessage[];
}

let seq = 0;
export function nextId(prefix = "m"): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

/** "HH:MM" for a chat timestamp (client-side only). */
export function clockNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function seedConversations(): Conversation[] {
  const seeds: { user: User; lines: [boolean, string, string][] }[] = [
    {
      user: USERS[0],
      lines: [
        [false, "Yo! You joining the room tonight?", "20:14"],
        [true, "For sure, what time?", "20:15"],
        [false, "9-ish. Bring your A-game for Ludo 😎", "20:16"],
      ],
    },
    {
      user: USERS[1],
      lines: [
        [false, "That set you played was 🔥🔥", "18:02"],
        [true, "Haha thanks! Next one's even better", "18:05"],
      ],
    },
    {
      user: USERS[2],
      lines: [
        [true, "GG on that last match", "15:40"],
        [false, "You got lucky with that six 😤", "15:41"],
        [true, "Skill, my friend. Pure skill 🎲", "15:42"],
      ],
    },
    {
      user: USERS[3],
      lines: [[false, "Did you see the tournament bracket?", "12:20"]],
    },
    {
      user: USERS[6],
      lines: [
        [false, "Rematch in chess? I want my revenge ♟️", "09:11"],
        [true, "Anytime 😏", "09:30"],
      ],
    },
  ];

  return seeds.map((s, i) => ({
    id: `c_${i}`,
    peer: {
      id: s.user.id,
      fullName: s.user.fullName,
      username: s.user.username,
      avatar: s.user.avatar,
      status: s.user.status,
      verified: s.user.verified,
    },
    messages: s.lines.map(([fromMe, text, time]) => ({ id: nextId(), fromMe, text, time })),
  }));
}

// Canned replies so the other person "answers" in the demo.
const REPLIES = [
  "Haha for real 😄",
  "Yeah let's do it!",
  "Nice, sounds good 👍",
  "Wait what 😂",
  "I'm in 🔥",
  "Catch you in the room",
  "Bet. Let's go 🎲",
  "Sounds like a plan ✨",
];

export function pickReply(): string {
  return REPLIES[Math.floor(Math.random() * REPLIES.length)];
}
