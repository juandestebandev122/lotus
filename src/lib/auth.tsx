"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "./types";
import { withBase } from "./base-path";
import { collectDeviceInfo } from "./device";
import { APP_VERSION } from "./lifelog";

// ============================================================
// Auth context — talks to the real backend API (/api/auth/*).
// Sessions are httpOnly cookies set by the server, so the only
// client state we keep is the current user object.
// ============================================================

export const DEMO_OTP = "123456";
const OTP_IDENTIFIER_KEY = "lotus.otp.identifier";
const USER_CACHE_KEY = "lotus.user";
// The signed session token saved at login. The httpOnly cookie is the primary
// session, but some clients DROP the cookie (installed PWA, in-app browsers,
// iOS Safari ITP) — so we also keep the token here and attach it as a Bearer
// header on same-origin API calls, so the session survives. Cleared on logout
// (the "lotus." prefix means clearAccountStorage removes it).
const AUTH_TOKEN_KEY = "lotus.auth.token";

// Patch fetch ONCE (at import time, before any request) to attach the saved
// token to our own API requests. This is what keeps users logged in on devices
// that won't persist the cookie.
if (typeof window !== "undefined" && !(window as unknown as { __lotusAuthPatched?: boolean }).__lotusAuthPatched) {
  (window as unknown as { __lotusAuthPatched?: boolean }).__lotusAuthPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url || "";
      const sameOrigin = url.startsWith("/") || url.startsWith(window.location.origin);
      if (sameOrigin && url.includes("/api/")) {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (token) {
          const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
          return orig(input, { ...init, headers: h, credentials: "include" });
        }
      }
    } catch { /* ignore — fall through to a normal fetch */ }
    return orig(input, init);
  };
}

function saveAuthToken(token: unknown) {
  try {
    if (typeof token === "string" && token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch { /* ignore */ }
}

// Cache the signed-in user so the app stays logged in instantly across
// reloads / minimise-and-return, without flashing the login screen.
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ---- Remembered accounts (for "Switch account") ------------------------
// Stored under a key that SURVIVES clearAccountStorage (no "lotus." prefix), so
// the list of accounts on this device persists across logout. We only keep
// public info (no passwords) — switching always requires a fresh login.
const ACCOUNTS_KEY = "lotus_accounts";
export interface SavedAccount { id: string; email: string; fullName: string; avatar?: string }

export function getSavedAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]") as SavedAccount[];
  } catch {
    return [];
  }
}
function rememberAccount(a: SavedAccount) {
  try {
    if (!a.email) return;
    const list = getSavedAccounts().filter(
      (x) => x.id !== a.id && x.email.toLowerCase() !== a.email.toLowerCase(),
    );
    list.unshift(a);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* ignore */
  }
}
export function removeSavedAccount(id: string) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(getSavedAccounts().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}

// Wipe ALL per-account client storage so switching accounts on one device never
// mixes data (cached user, OTP identifiers, per-room mic prefs, etc.).
function clearAccountStorage() {
  try {
    localStorage.removeItem(USER_CACHE_KEY);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("lotus.")) localStorage.removeItem(k);
    }
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("lotus")) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: User | null;
  isAuthed: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  sendOtp: (identifier: string, purpose?: "login" | "register") => Promise<{ ok: boolean; demoCode?: string; error?: string }>;
  verifyOtp: (code: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithUsername: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: (credential: string) => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  loginQuick: (name: string, email?: string) => Promise<{ ok: boolean; error?: string }>;
  // Submit a public account request — creates a PENDING account (admin approves).
  requestAccount: (data: {
    name: string;
    dob: string;
    gender: "male" | "female";
    phone: string;
    email: string;
    username: string;
    password: string;
    acceptedPolicies?: string[];
    ref?: string;
    otp?: string;
  }) => Promise<{ ok: boolean; error?: string; userId?: string; demoCode?: string }>;
  // Confirm a new account's email with the 6-digit code.
  verifyEmail: (userId: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Immediately end the session locally (no server round-trip) and return to the
  // login screen — used when the server has ALREADY invalidated the session
  // (admin Logout / Suspend / Ban / Deactivate). `reason` shows a matching notice
  // on the login page.
  forceLogout: (reason?: string) => void;
  switchAccount: (email?: string) => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function api(path: string, body?: unknown, method = "POST") {
  const res = await fetch(withBase(path), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  // Persist the session token whenever the server returns one (login, /me
  // sliding refresh, etc.) so the cookie-drop fallback stays fresh.
  if (data && typeof data === "object" && "token" in data) saveAuthToken((data as { token?: unknown }).token);
  return { res, data } as { res: Response; data: Record<string, unknown> };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthed: false,
    loading: true,
  });

  const setUser = useCallback((user: User | null) => {
    writeCachedUser(user);
    setState({ user, isAuthed: !!user, loading: false });
  }, []);

  // When the user just made a local change (e.g. changed their photo), don't let
  // a background session refresh overwrite it with the pre-save server copy.
  const mutatedAtRef = useRef(0);

  // Restore the session: hydrate instantly from cache, then re-validate.
  useEffect(() => {
    let active = true;
    const cached = readCachedUser();
    if (cached) setState({ user: cached, isAuthed: true, loading: false });

    (async () => {
      try {
        const { res, data } = await api("/api/auth/me", undefined, "GET");
        if (!active) return;
        if (res.ok) {
          // With the cookie OR the saved-token (Bearer) fallback both checked
          // server-side, a null here means the session is genuinely gone.
          let serverUser = (data.user as User) ?? null;
          // ROBUSTNESS: if we had a cached session but got null, DON'T log out on
          // the first try — the server may be momentarily restarting (right after
          // a deploy) or the token attach may have raced. Confirm with one retry
          // before logging the user out. This is why backgrounding/reopening never
          // spuriously signs anyone out; only a confirmed null does.
          if (!serverUser && cached) {
            await new Promise((r) => setTimeout(r, 1500));
            if (!active) return;
            const retry = await api("/api/auth/me", undefined, "GET").catch(() => null);
            if (!active) return;
            if (!retry || !retry.res.ok) { setState((s) => ({ ...s, loading: false })); return; } // keep cached on error
            serverUser = (retry.data.user as User) ?? null;
          }
          // SESSION VALIDATION: if the server's account differs from the cached
          // one, wipe stale per-account data before loading the correct profile
          // (never show another account's data).
          if (serverUser && cached && serverUser.id !== cached.id) clearAccountStorage();
          setUser(serverUser);
        } else {
          // Server error — keep the cached session, just stop loading.
          setState((s) => ({ ...s, loading: false }));
        }
      } catch {
        // Network failure (offline / waking from background): KEEP the
        // cached session instead of logging the user out.
        if (active) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      active = false;
    };
  }, [setUser]);

  // When the app returns to the foreground (resumed from background / tab
  // focus), silently refresh the sliding session cookie. NEVER log out here —
  // only update on a positive user — so returning never forces a re-login.
  useEffect(() => {
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // Skip if the user changed something locally in the last few seconds —
      // the file dialog returning focus must NOT revert a just-saved photo.
      if (Date.now() - mutatedAtRef.current < 6000) return;
      api("/api/auth/me", undefined, "GET")
        .then(({ res, data }) => {
          if (res.ok && data.user && Date.now() - mutatedAtRef.current >= 6000) setUser(data.user as User);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [setUser]);

  const sendOtp = useCallback(async (identifier: string, purpose?: "login" | "register") => {
    const { res, data } = await api("/api/auth/otp/send", { identifier, purpose });
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Failed to send OTP" };
    try {
      sessionStorage.setItem(OTP_IDENTIFIER_KEY, identifier);
      sessionStorage.setItem("lotus.otp.demo", data.demo ? "1" : "0");
      sessionStorage.setItem("lotus.otp.length", String(data.length ?? 6));
      sessionStorage.setItem("lotus.otp.resend", String(data.resendSeconds ?? 30));
      if (data.demoCode) sessionStorage.setItem("lotus.otp.demoCode", String(data.demoCode));
      else sessionStorage.removeItem("lotus.otp.demoCode");
    } catch {}
    return { ok: true, demoCode: data.demoCode as string | undefined };
  }, []);

  const verifyOtp = useCallback(
    async (code: string) => {
      let identifier = "";
      try {
        identifier = sessionStorage.getItem(OTP_IDENTIFIER_KEY) ?? "";
      } catch {}
      const { res, data } = await api("/api/auth/otp/verify", { identifier, code, device: collectDeviceInfo(APP_VERSION) });
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Verification failed" };
      setUser((data.user as User) ?? null);
      return { ok: true };
    },
    [setUser],
  );

  // Username + password login (the credentials an admin created for the account).
  const loginWithUsername = useCallback(
    async (username: string, password: string) => {
      const { res, data } = await api("/api/auth/login", { identifier: username, password, device: collectDeviceInfo(APP_VERSION) });
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Login failed" };
      const u = (data.user as User) ?? null;
      setUser(u);
      if (u) rememberAccount({ id: u.id, email: u.username, fullName: u.fullName, avatar: u.avatar });
      return { ok: true };
    },
    [setUser],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const { res, data } = await api("/api/auth/login", { email, password, device: collectDeviceInfo(APP_VERSION) });
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Login failed" };
      const u = (data.user as User) ?? null;
      setUser(u);
      if (u) rememberAccount({ id: u.id, email, fullName: u.fullName, avatar: u.avatar });
      return { ok: true };
    },
    [setUser],
  );

  // Real Google sign-in: the browser obtains a Google ID token (credential)
  // which the server verifies, then logs in / creates THAT person's account.
  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const { res, data } = await api("/api/auth/google", { credential, device: collectDeviceInfo(APP_VERSION) });
      // New Google user → an admin-approval request was created (not an error).
      if (data.pending) return { ok: false as const, pending: true, error: (data.message as string) ?? "Your account is awaiting admin approval." };
      if (!res.ok) return { ok: false as const, error: (data.error as string) ?? "Google sign-in failed" };
      setUser((data.user as User) ?? null);
      return { ok: true as const };
    },
    [setUser],
  );

  // Quick per-user sign-in (used by the social buttons until real OAuth is
  // configured). Creates / logs into that person's OWN named account.
  const loginQuick = useCallback(
    async (name: string, email?: string) => {
      const { res, data } = await api("/api/auth/quick", { name, email });
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Sign-in failed" };
      setUser((data.user as User) ?? null);
      return { ok: true };
    },
    [setUser],
  );

  // Submit a public account request → creates a PENDING account (email
  // unverified) that an admin must approve before it can access the app.
  const requestAccount = useCallback(
    async (input: { name: string; dob: string; gender: "male" | "female"; phone: string; email: string; username: string; password: string; acceptedPolicies?: string[]; ref?: string; otp?: string }) => {
      const { res, data } = await api("/api/auth/request", input);
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not submit your request" };
      return { ok: true, userId: data.userId as string, demoCode: data.demoCode as string | undefined };
    },
    [],
  );

  const verifyEmail = useCallback(
    async (userId: string, code: string) => {
      const { res, data } = await api("/api/auth/verify-email", { userId, code });
      if (!res.ok) return { ok: false, error: (data.error as string) ?? "Verification failed" };
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(async () => {
    // Tell the server to end the session (clears the httpOnly cookie + records the
    // logout) — but treat it as BEST-EFFORT: on a flaky mobile connection this call
    // can hang or fail, and we must still log out locally. Otherwise the saved
    // Bearer token (our fallback session for cookie-dropping browsers) would survive
    // and keep the user signed in — which is exactly the "exited the room but still
    // logged in / can rejoin without logging in again" bug. So the LOCAL clear +
    // redirect ALWAYS run, even if the network call never completes.
    try {
      await Promise.race([
        api("/api/auth/logout"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("logout-timeout")), 2500)),
      ]);
    } catch {
      /* network hang / offline — log out locally regardless */
    } finally {
      clearAccountStorage(); // removes the Bearer token + cached user = the REAL logout
      setUser(null);
      // Full reload to /login so NO in-memory state from this account survives.
      if (typeof window !== "undefined") window.location.assign(withBase("/login"));
    }
  }, [setUser]);

  // Force logout: the SERVER has already ended this session (an admin used
  // Logout / Suspend / Ban / Deactivate, or the password was changed elsewhere).
  // There's nothing to tell the server — just clear the local session token +
  // cached user and hard-redirect to /login so NO in-memory state survives and
  // the app (and any live voice) is fully torn down. `reason` drives the notice
  // shown on the login screen.
  const forceLogout = useCallback((reason?: string) => {
    clearAccountStorage();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.assign(withBase(`/login?ended=${encodeURIComponent(reason || "session")}`));
    }
  }, [setUser]);

  // Switch account: end the current session cleanly and go to the login screen
  // (pre-filled with the chosen email). Switching always requires a fresh login,
  // which guarantees no two accounts ever share a session / mix data.
  const switchAccount = useCallback(async (email?: string) => {
    // Same best-effort pattern as logout(): never let a slow/failed network call
    // leave the old session token behind (which would silently keep the previous
    // account signed in). Clear locally + redirect no matter what.
    try {
      await Promise.race([
        api("/api/auth/logout"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("logout-timeout")), 2500)),
      ]);
    } catch {
      /* ignore — switch accounts locally regardless */
    } finally {
      clearAccountStorage();
      setUser(null);
      if (typeof window !== "undefined") {
        const url = email ? `/login?email=${encodeURIComponent(email)}` : "/login";
        window.location.assign(withBase(url));
      }
    }
  }, [setUser]);

  // Optimistic local update + persist to backend
  const updateUser = useCallback((patch: Partial<User>) => {
    mutatedAtRef.current = Date.now(); // protect this change from a refresh race
    setState((s) => (s.user ? { ...s, user: { ...s.user, ...patch } } : s));
    api("/api/users/me", patch, "PATCH").catch(() => {});
  }, []);

  // Pull the freshest account data from the server (level, XP, coins …) so pages
  // that show fast-changing fields stay current without a manual reload.
  const refresh = useCallback(async () => {
    try {
      const { res, data } = await api("/api/auth/me", undefined, "GET");
      if (res.ok && data.user && Date.now() - mutatedAtRef.current >= 6000) setUser(data.user as User);
    } catch { /* ignore */ }
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      sendOtp,
      verifyOtp,
      loginWithUsername,
      loginWithEmail,
      loginWithGoogle,
      loginQuick,
      requestAccount,
      verifyEmail,
      logout,
      forceLogout,
      switchAccount,
      updateUser,
      refresh,
    }),
    [state, sendOtp, verifyOtp, loginWithUsername, loginWithEmail, loginWithGoogle, loginQuick, requestAccount, verifyEmail, logout, forceLogout, switchAccount, updateUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
