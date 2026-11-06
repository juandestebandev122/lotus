"use client";

import { useEffect, useRef, useState } from "react";
import { useConfig } from "@/lib/config";

// Build-time fallback (legacy). The LIVE source is config.googleClientId, set
// from Admin → Settings — it applies instantly with no rebuild.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
export const GOOGLE_CONFIGURED = GOOGLE_CLIENT_ID.length > 0;

/** The active Google OAuth Client ID: the admin-configured value first,
 *  then the (legacy) build-time env var. "" = Google sign-in hidden. */
export function useGoogleClientId(): string {
  const { config } = useConfig();
  return (config.googleClientId || "").trim() || GOOGLE_CLIENT_ID;
}

interface GoogleId {
  accounts?: {
    id?: {
      initialize: (opts: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}

/** Renders the official Google Sign-In button and returns the ID token. */
export function GoogleSignIn({ onCredential }: { onCredential: (credential: string) => void }) {
  const clientId = useGoogleClientId();
  const configured = clientId.length > 0;
  const ref = useRef<HTMLDivElement>(null);
  // "loading" → waiting for Google's script/button; "ready" → button shown;
  // "failed" → the button could not be rendered (script blocked, offline, or
  // the site's origin is not authorised in the Google Cloud console).
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    let renderCheck: ReturnType<typeof setTimeout> | undefined;

    const init = () => {
      if (cancelled || !ref.current) return;
      const g = (window as unknown as { google?: GoogleId }).google;
      if (!g?.accounts?.id) { setStatus("failed"); return; }
      try {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential?: string }) => resp?.credential && onCredential(resp.credential),
          // Modern-browser compatibility: FedCM (Chrome's 3rd-party-cookie
          // phase-out) + Safari ITP, and never silently auto-pick an account.
          use_fedcm_for_prompt: true,
          itp_support: true,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        ref.current.innerHTML = "";
        g.accounts.id.renderButton(ref.current, {
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
        });
        // The button renders into an iframe shortly after. If nothing appears,
        // the origin is almost certainly not authorised for this client ID.
        renderCheck = setTimeout(() => {
          if (cancelled) return;
          setStatus(ref.current && ref.current.childElementCount > 0 ? "ready" : "failed");
        }, 1500);
      } catch {
        setStatus("failed");
      }
    };

    const existing = (window as unknown as { google?: GoogleId }).google?.accounts?.id;
    if (existing) {
      init();
      return () => { cancelled = true; if (renderCheck) clearTimeout(renderCheck); };
    }
    const SCRIPT_ID = "google-gsi-client";
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onError = () => { if (!cancelled) setStatus("failed"); };
    script.addEventListener("load", init);
    script.addEventListener("error", onError);
    // Safety net: if the script never loads (blocked/offline), stop "loading".
    const loadTimeout = setTimeout(() => {
      if (!cancelled && !(window as unknown as { google?: GoogleId }).google?.accounts?.id) {
        setStatus("failed");
      }
    }, 6000);
    return () => {
      cancelled = true;
      if (renderCheck) clearTimeout(renderCheck);
      clearTimeout(loadTimeout);
      script?.removeEventListener("load", init);
      script?.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCredential, clientId, configured]);

  if (!configured) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="flex min-h-[40px] justify-center" />
      {status === "loading" && <p className="text-xs text-mist-400">Loading Google sign-in…</p>}
      {status === "failed" && (
        <p className="max-w-[320px] text-center text-xs text-mist-400">
          Google sign-in couldn&apos;t load here. Please check your connection, or sign in with your
          username &amp; password / mobile number instead.
        </p>
      )}
    </div>
  );
}
