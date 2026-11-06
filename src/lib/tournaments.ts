import { USERS, CURRENT_USER } from "./mock-data";

// ============================================================
// Tournaments: seed data, single-elimination bracket builder,
// and session join/create. (Swaps for a real tournaments API
// + scheduler later.)
// ============================================================

export type TGame = "Ludo" | "Chess";
export type TStatus = "upcoming" | "live" | "completed";
export type TFormat = "Knockout" | "League";

export interface TPlayer {
  id: string;
  fullName: string;
}
export interface TMatch {
  a: TPlayer | null;
  b: TPlayer | null;
  winner?: "a" | "b";
}
export interface TRound {
  name: string;
  matches: TMatch[];
}
export interface Tournament {
  id: string;
  title: string;
  game: TGame;
  format: TFormat;
  status: TStatus;
  prize: number;
  entry: number;
  capacity: number;
  startLabel: string;
  players: TPlayer[];
  joined: boolean;
}

const me: TPlayer = { id: CURRENT_USER.id, fullName: CURRENT_USER.fullName };
const p = (i: number): TPlayer => ({ id: USERS[i].id, fullName: USERS[i].fullName });

const created: Tournament[] = [];
let counter = 0;

const seeded: Tournament[] = [
  {
    id: "t1",
    title: "Sunday Ludo Showdown",
    game: "Ludo",
    format: "Knockout",
    status: "live",
    prize: 5000,
    entry: 100,
    capacity: 8,
    startLabel: "Live now",
    players: [p(0), p(2), p(4), p(6), p(1), p(3), p(5), p(7)],
    joined: false,
  },
  {
    id: "t2",
    title: "Grandmaster Chess Cup",
    game: "Chess",
    format: "Knockout",
    status: "upcoming",
    prize: 10000,
    entry: 250,
    capacity: 8,
    startLabel: "Starts in 2h",
    players: [p(6), p(0), p(2), p(7)],
    joined: false,
  },
  {
    id: "t3",
    title: "Weekend Warriors (Ludo)",
    game: "Ludo",
    format: "Knockout",
    status: "completed",
    prize: 3000,
    entry: 50,
    capacity: 8,
    startLabel: "Ended yesterday",
    players: [p(2), p(0), p(4), p(1), p(6), p(3), p(5), p(7)],
    joined: false,
  },
];

const deletedIds = new Set<string>();

export function allTournaments(): Tournament[] {
  return [...created, ...seeded].filter((t) => !deletedIds.has(t.id));
}

export function getTournament(id: string): Tournament | undefined {
  return allTournaments().find((t) => t.id === id);
}

/** Admin: remove a tournament. */
export function deleteTournament(id: string): void {
  deletedIds.add(id);
  const i = created.findIndex((t) => t.id === id);
  if (i >= 0) created.splice(i, 1);
}

/** Admin: change a tournament's status (upcoming → live → completed). */
export function setTournamentStatus(id: string, status: TStatus): void {
  const t = [...created, ...seeded].find((x) => x.id === id);
  if (t) t.status = status;
}

export function createTournament(input: {
  title: string;
  game: TGame;
  prize: number;
  entry: number;
}): Tournament {
  counter += 1;
  const t: Tournament = {
    id: `t_new_${counter}`,
    title: input.title.trim() || "My Tournament",
    game: input.game,
    format: "Knockout",
    status: "upcoming",
    prize: input.prize,
    entry: input.entry,
    capacity: 8,
    startLabel: "Open for entries",
    players: [me],
    joined: true,
  };
  created.unshift(t);
  return t;
}

export function joinTournament(id: string): void {
  const t = allTournaments().find((x) => x.id === id);
  if (!t || t.joined || t.players.length >= t.capacity) return;
  t.players.push(me);
  t.joined = true;
}

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

function roundName(slots: number): string {
  if (slots === 2) return "Final";
  if (slots === 4) return "Semifinals";
  if (slots === 8) return "Quarterfinals";
  return `Round of ${slots}`;
}

/** Build a single-elimination bracket. `decidedRounds` controls how many
 *  rounds already have results (Infinity = fully played). */
export function buildBracket(t: Tournament): TRound[] {
  const decidedRounds = t.status === "completed" ? Infinity : t.status === "live" ? 1 : 0;
  let size = 1;
  while (size < Math.max(2, t.players.length)) size *= 2;

  let current: (TPlayer | null)[] = [...t.players];
  while (current.length < size) current.push(null);

  const rounds: TRound[] = [];
  let r = 0;
  while (current.length > 1) {
    const decided = r < decidedRounds;
    const matches: TMatch[] = [];
    const next: (TPlayer | null)[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      const m: TMatch = { a, b };
      if (decided && (a || b)) {
        if (a && b) {
          const win: "a" | "b" = hash(a.id) >= hash(b.id) ? "a" : "b";
          m.winner = win;
          next.push(win === "a" ? a : b);
        } else {
          m.winner = a ? "a" : "b";
          next.push(a ?? b);
        }
      } else {
        next.push(null);
      }
      matches.push(m);
    }
    rounds.push({ name: roundName(current.length), matches });
    current = next;
    r += 1;
  }
  return rounds;
}

export function champion(t: Tournament): TPlayer | null {
  if (t.status !== "completed") return null;
  const rounds = buildBracket(t);
  const final = rounds[rounds.length - 1]?.matches[0];
  if (!final || !final.winner) return null;
  return final.winner === "a" ? final.a : final.b;
}

export const ME_ID = CURRENT_USER.id;
