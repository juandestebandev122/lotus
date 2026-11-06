"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Check, Plug, Trash2 } from "lucide-react";

interface LivekitView {
  saved: { url: string; apiKey: string; serverUrl: string; secretSet: boolean; secretHint: string; updatedAt: string; updatedBy: string };
  active: { source: "settings" | "env" | "none"; url: string; apiKeyHint: string };
  envConfigured: boolean;
}

type TestResult = { ok: boolean; rooms?: number; error?: string };

const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[11px] font-bold text-lotus-200">{n}</span>
      <span>{children}</span>
    </li>
  );
}

/** Admin → Settings: the LiveKit voice server (voice rooms, Paid Zone calls,
 *  live support screen sharing). Saved through /api/admin/livekit, separately
 *  from the main settings, because it holds a secret. */
export function LivekitSettingsCard() {
  const { toast } = useToast();
  const [data, setData] = useState<LivekitView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "clear">("");
  const [test, setTest] = useState<TestResult | null>(null);

  const apply = useCallback((v: LivekitView) => {
    setData(v);
    setUrl(v.saved.url);
    setApiKey(v.saved.apiKey);
    setServerUrl(v.saved.serverUrl);
    setApiSecret("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(withBase("/api/admin/livekit"), { credentials: "include" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setLoadError(d.error ?? "Could not load the voice settings."); return; }
        apply(d as LivekitView);
      } catch {
        setLoadError("Network error while loading the voice settings.");
      }
    })();
  }, [apply]);

  const call = async (method: "PATCH" | "POST", body: Record<string, unknown>) => {
    const res = await fetch(withBase("/api/admin/livekit"), {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return { res, d };
  };

  const form = () => ({ url: url.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), serverUrl: serverUrl.trim() });

  const save = async () => {
    setBusy("save");
    try {
      const { res, d } = await call("PATCH", form());
      if (!res.ok) { toast(d.error ?? "Could not save", "error"); return; }
      apply(d as LivekitView);
      setTest(null);
      toast("Voice server settings saved", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const runTest = async () => {
    setBusy("test");
    setTest(null);
    try {
      const { res, d } = await call("POST", form());
      setTest(res.ok ? (d as TestResult) : { ok: false, error: d.error ?? "Test failed" });
    } catch {
      setTest({ ok: false, error: "Network error" });
    } finally {
      setBusy("");
    }
  };

  const clear = async () => {
    if (!window.confirm("Remove the voice server settings saved here? The site will go back to the server's built-in settings.")) return;
    setBusy("clear");
    try {
      const { res, d } = await call("PATCH", { clear: true });
      if (!res.ok) { toast(d.error ?? "Could not remove", "error"); return; }
      apply(d as LivekitView);
      setTest(null);
      toast("Voice server settings removed", "success");
    } catch {
      toast("Network error", "error");
    } finally {
      setBusy("");
    }
  };

  const urlLooksWrong = url.trim() !== "" && !/^wss?:\/\//i.test(url.trim());
  const source = data?.active.source;

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-mist-100">Voice server (LiveKit)</h2>

      <div className="mt-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] p-3 text-xs leading-relaxed text-mist-300">
        <p className="font-semibold text-mist-100">What is this setting for?</p>
        <p className="mt-1">
          LiveKit is the service that carries <b className="text-mist-100">live voice</b>: voice rooms, Paid Zone calls
          and live screen sharing with support. These three values tell the site which LiveKit server to use.
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Do I have to fill this in?</b> Only if you want to change the voice server. If you
          leave it empty, the site keeps using the voice server set up on the hosting server.
        </p>
        <p className="mt-2">
          <b className="text-mist-100">Is it secret?</b> The <b className="text-mist-100">API secret</b> is a password —
          never share it. Once saved, it is never shown again, not even here; only its last 4 characters.
        </p>
      </div>

      {loadError ? (
        <p className="mt-4 text-sm text-rose-300">{loadError}</p>
      ) : (
        <>
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2 text-xs",
              source === "settings" && "border-emerald-400/30 bg-emerald-500/[0.07] text-emerald-200",
              source === "env" && "border-sky-400/30 bg-sky-500/[0.07] text-sky-200",
              source === "none" && "border-amber-400/30 bg-amber-500/[0.07] text-amber-200",
              !data && "border-line text-mist-500",
            )}
          >
            {!data && "Loading…"}
            {source === "settings" && <>✓ Voice is ON, using the server saved on this page: <b className="font-mono">{data!.active.url}</b> (key {data!.active.apiKeyHint}).</>}
            {source === "env" && <>✓ Voice is ON, using the hosting server&apos;s built-in settings: <b className="font-mono">{data!.active.url}</b> (key {data!.active.apiKeyHint}). Nothing is saved on this page.</>}
            {source === "none" && <>⚠ Voice is OFF — no voice server is set up. Voice rooms join silently until you fill this in.</>}
          </p>

          <label className="mt-4 block text-xs font-semibold text-mist-300">Server address (WebSocket URL)</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="wss://your-project.livekit.cloud"
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />
          {urlLooksWrong && (
            <p className="mt-1.5 text-xs text-amber-300">⚠ This must start with <b>wss://</b> (not https://).</p>
          )}

          <label className="mt-4 block text-xs font-semibold text-mist-300">API key</label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="APIxxxxxxxxxxxx"
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="off"
            spellCheck={false}
          />

          <label className="mt-4 block text-xs font-semibold text-mist-300">API secret</label>
          <input
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={data?.saved.secretSet ? `Saved (${data.saved.secretHint}) — leave empty to keep it` : "Paste the API secret"}
            className={cn(field, "mt-1.5 font-mono text-xs")}
            autoComplete="new-password"
            spellCheck={false}
          />

          <details className="mt-4 text-xs text-mist-400">
            <summary className="cursor-pointer font-semibold text-mist-300">Advanced: internal server address (optional)</summary>
            <p className="mt-1.5">
              Only for a LiveKit server running on the same machine as the site. Lets the site talk to it directly,
              for example <span className="font-mono">http://127.0.0.1:7880</span>. Leave empty for LiveKit Cloud.
            </p>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:7880"
              className={cn(field, "mt-1.5 font-mono text-xs")}
              autoComplete="off"
              spellCheck={false}
            />
          </details>

          {test && (
            <p className={cn("mt-4 text-xs", test.ok ? "text-emerald-300" : "text-rose-300")}>
              {test.ok
                ? `✓ Connected. LiveKit accepted these settings (${test.rooms ?? 0} room${test.rooms === 1 ? "" : "s"} open right now).`
                : `✕ ${test.error ?? "The test failed."}`}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={!data || busy !== ""}>
              <Check className="size-4" /> {busy === "save" ? "Saving…" : "Save voice server"}
            </Button>
            <Button variant="secondary" onClick={runTest} disabled={!data || busy !== ""}>
              <Plug className="size-4" /> {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            {(data?.saved.url || data?.saved.secretSet) && (
              <Button variant="ghost" onClick={clear} disabled={busy !== ""}>
                <Trash2 className="size-4" /> {busy === "clear" ? "Removing…" : "Remove saved settings"}
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-mist-500">
            Press <b className="text-mist-300">Test connection</b> before saving. A change applies the next time someone
            joins a room; people already in a voice room may drop and reconnect, so change it at a quiet time.
          </p>
          {data?.saved.updatedAt && (
            <p className="mt-1 text-xs text-mist-500">
              Last changed {new Date(data.saved.updatedAt).toLocaleString()}{data.saved.updatedBy ? ` by ${data.saved.updatedBy}` : ""}.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line bg-ink-800/60 p-3 text-xs leading-relaxed text-mist-400">
            <p className="font-semibold text-mist-200">Where to get these values (LiveKit Cloud)</p>
            <ol className="mt-2 space-y-2.5 pl-0">
              <Step n={1}>
                Go to <a href="https://cloud.livekit.io" target="_blank" rel="noreferrer" className="font-semibold text-lotus-300 underline">cloud.livekit.io</a> and
                sign in. Open your project (or create one — the free plan is enough to start).
              </Step>
              <Step n={2}>
                In the left menu open <b className="text-mist-200">Settings → API Keys</b> and click <b className="text-mist-200">Create key</b>.
              </Step>
              <Step n={3}>
                LiveKit shows three values: the <b className="text-mist-200">WebSocket URL</b> (starts with wss://), the
                <b className="text-mist-200"> API Key</b> and the <b className="text-mist-200">API Secret</b>. Copy each into the boxes above.
                The secret is shown only once — copy it before closing the window.
              </Step>
              <Step n={4}>
                Press <b className="text-mist-200">Test connection</b>. When it says Connected, press <b className="text-mist-200">Save voice server</b>.
              </Step>
            </ol>
            <p className="mt-3 border-t border-line pt-2 text-mist-500">
              <b className="text-mist-300">Running your own LiveKit server?</b> The key and secret here must be exactly the
              same as the pair in its <span className="font-mono">livekit.yaml</span>, otherwise voice fails silently.
              The Test connection button will tell you if they don&apos;t match.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
