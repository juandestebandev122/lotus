import type { DBShape, UserRecord } from "./db";
import { hashPassword } from "./auth";
import {
  CURRENT_USER,
  USERS,
  FRIENDS,
  NOTIFICATIONS,
} from "@/lib/mock-data";

// ============================================================
// One-time seed: turns the in-code demo data into real DB rows.
// The demo account (Rahul) gets real credentials so the existing
// login flows authenticate against the database.
// ============================================================
//   Demo phone:    9876543210   (OTP: any code in dev — see route)
//   Demo email:    rahul@example.com
//   Demo password: password
// ============================================================

// The platform administrator. Logs into the Admin Panel.
//   Admin email:    admin@lotus.com
//   Admin password: admin123
export function makeAdmin(): UserRecord {
  return {
    id: "u_admin",
    fullName: "Admin",
    username: "admin",
    avatar: "",
    bio: "Platform administrator",
    level: 1,
    coins: 0,
    status: "online",
    verified: true,
    role: "admin",
    joinedAt: "2024-01-01",
    stats: {
      followers: 0,
      following: 0,
      friends: 0,
      roomsJoined: 0,
      gamesPlayed: 0,
      wins: 0,
      tournamentWins: 0,
    },
    email: "admin@lotus.com",
    phone: "+966500000000",
    passwordHash: hashPassword("admin123"),
  };
}

/** Adds the admin account to an existing database if it's missing (migration). */
export function ensureAdmin(db: DBShape): DBShape {
  if (!db.users.some((u) => u.role === "admin" || u.email === "admin@lotus.com")) {
    db.users.push(makeAdmin());
  }
  return db;
}

export function seedDatabase(db: DBShape): DBShape {
  // Real platform by DEFAULT → start clean: only the admin account, no demo
  // content. The sample/showcase data is OPT-IN (set LOTUS_DEMO=1, e.g. the
  // freelancer demo). This way the live site can NEVER regenerate demo users,
  // even if an env flag is missing.
  if (process.env.LOTUS_DEMO !== "1") {
    return {
      users: [makeAdmin()],
      otps: [],
      friends: [],
      follows: [],
      notifications: [],
      rooms: db.rooms ?? [],
      seededAt: new Date("2025-06-08T00:00:00.000Z").toISOString(),
    };
  }

  const me: UserRecord = {
    ...CURRENT_USER,
    email: "rahul@example.com",
    phone: "+919876543210",
    passwordHash: hashPassword("password"),
  };

  // Give the other users a deterministic email/phone too
  const others: UserRecord[] = USERS.map((u, i) => ({
    ...u,
    email: `${u.username}@example.com`,
    phone: `+9190000000${(i + 10).toString().padStart(2, "0")}`,
  }));

  const users = [me, makeAdmin(), ...others];

  // Friend edges from the demo user's perspective
  const friends = FRIENDS.map((f) => ({
    userId: me.id,
    otherId: f.user.id,
    state: f.state,
  }));

  // A few follows
  const follows = USERS.slice(0, 5).map((u) => ({
    followerId: me.id,
    followingId: u.id,
  }));

  // Notifications belong to the demo user
  const notifications = NOTIFICATIONS.map((n) => ({ ...n, userId: me.id }));

  return {
    users,
    otps: [],
    friends,
    follows,
    notifications,
    rooms: db.rooms ?? [],
    seededAt: "2025-06-08T00:00:00.000Z",
  };
}
