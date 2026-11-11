"use client";

// Part of direct-mcp: INPUT, parseEnv, Row.

import { useState } from "react";
import { api } from "@/lib/bridge";
import type { DirectServer, ServerTool } from "@/lib/types";
import { Button } from "../ui";

export const INPUT =
  "w-full rounded-md border border-(--border) bg-transparent px-2 py-1 text-[13px] outline-none focus:border-(--accent)";

export function parseEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

export function Row({ s, onError }: { s: DirectServer; onError: (e: string) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  const [tools, setTools] = useState<ServerTool[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-col gap-2 rounded-[var(--r-md)] bg-(--surface) px-3 py-2 text-[13px]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">
          <b className="font-medium">{s.app}</b>
          <span className="ml-2 text-(--muted)">{s.kind === "stdio" ? `${s.command} ${s.args.join(" ")}` : s.url}</span>
        </span>
        {s.kind === "url" && (
          <Button small disabled={busy} onClick={() => void run(() => api.serversSignIn(s.id))}>
            {s.envNames.includes("Authorization") ? "Sign in again" : "Sign in"}
          </Button>
        )}
        {s.confirmed ? (
          <Button small disabled={busy} onClick={() => void run(async () => setTools(await api.serversTest(s.id)))}>
            {busy ? "Connecting..." : "Test"}
          </Button>
        ) : (
          <Button small disabled={busy} onClick={() => void run(async () => setShown(await api.serversCommand(s.id)))}>
            Review
          </Button>
        )}
        <Button small onClick={() => void run(() => api.serversRemove(s.id))}>
          Remove
        </Button>
      </div>
      {shown !== null && !s.confirmed && (
        <div className="flex flex-col gap-1.5">
          <p className="text-(--muted)">Duskie will run exactly this. Only confirm if you trust it.</p>
          <code className="mono rounded-md bg-black/30 px-2 py-1 text-[12px] break-all">{shown}</code>
          <div className="flex gap-1.5">
            <Button small onClick={() => void run(() => api.serversConfirm(s.id, shown))}>
              Confirm and allow
            </Button>
            <Button small onClick={() => setShown(null)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {tools && (
        <ul className="flex flex-col gap-1">
          {tools.length === 0 && <li className="text-(--muted)">It offers no tools.</li>}
          {tools.map((t) => (
            <li key={t.name} className="flex items-center gap-2">
              <span className="mono min-w-0 flex-1 truncate" title={t.description}>
                {t.name}
              </span>
              {t.writes ? (
                <label className="flex items-center gap-1.5 text-(--muted)">
                  <input
                    type="checkbox"
                    checked={t.allowed}
                    onChange={(e) => {
                      const allow = e.target.checked;
                      void run(async () => {
                        await api.serversAllowWrite(s.id, t.name, allow);
                        setTools((all) => all?.map((x) => (x.name === t.name ? { ...x, allowed: allow } : x)) ?? null);
                      });
                    }}
                  />
                  Can change things
                </label>
              ) : (
                <span className="text-(--muted)">Reads only</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
