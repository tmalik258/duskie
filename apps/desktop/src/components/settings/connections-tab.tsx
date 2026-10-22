"use client";

// Apps: Composio (one sign-in brings every app in the account, and the
// meetings from its calendar), and the browser extension per browser.

import { useCallback, useEffect, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { startWaiting, updateSettings, useDuskie } from "@/lib/store";
import type { ComposioStatus } from "@/lib/types";
import { ComposioApps } from "./composio-apps";
import { EditorPicker, OtherWays } from "./connections-tab/capital";
import { BrowserCard, Meetings } from "./connections-tab/meetings";
import { DirectMcpCard } from "./direct-mcp";
import { Button, Section, Toggle } from "./ui";

export function ConnectionsTab({ onError, part }: { onError: (e: string) => void; part?: "apps" | "code" }) {
  if (part === "code")
    return (
      <Section
        title="Code editor"
        hint="Buttons say its name, like Open in Cursor."
        keywords="editor ide vs code vscode cursor antigravity windsurf zed pycharm intellij webstorm visual studio open project"
      >
        <EditorPicker onError={onError} />
      </Section>
    );
  return (
    <>
      <DirectMcpCard onError={onError} />
      <Section
        title="Composio"
        keywords="apps accounts calendar meetings reminders join google outlook jira slack gmail notion trello github linear fathom login sign in"
      >
        <ComposioCard onError={onError} />
      </Section>
      <Section
        title="Browser"
        hint="Talks only to Duskie on this PC."
        keywords="extension chrome edge firefox zen brave pairing code tabs"
      >
        <BrowserCard />
      </Section>
      {!part && (
        <Section
          title="Code editor"
          hint="Buttons say its name, like Open in Cursor."
          keywords="editor ide vs code vscode cursor antigravity windsurf zed pycharm intellij webstorm visual studio open project"
        >
          <EditorPicker onError={onError} />
        </Section>
      )}
    </>
  );
}

function ComposioCard({ onError }: { onError: (e: string) => void }) {
  const composio = useDuskie((s) => s.settings.composio);
  const justDone = useDuskie((s) => s.justDone);
  const { data: status, refresh: reload } = useCached<ComposioStatus>("composio-status", api.composioStatus);
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    setBusy(true);
    void reload()
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }, [reload]);
  useEffect(() => {
    const off = listen(EVENTS.composioChanged, ({ ok, message }) => {
      setWaiting(false);
      setNote(message);
      if (!ok) onError(message);
      refresh();
    });
    return () => {
      void off.then((f) => f());
    };
  }, [refresh, onError]);

  const signIn = () => {
    setNote(null);
    setWaiting(true);
    api
      .composioSignIn()
      .then(() =>
        startWaiting("composio", "Composio", {
          resumeTab: "connections",
          steps: ["Composio opened in your browser.", "Sign in and press Allow."],
          again: signIn,
        }),
      )
      .catch((e) => {
        setWaiting(false);
        onError(String(e));
      });
  };

  // Only on the very first run; afterwards the last known state paints at once.
  if (!status) return <div className="h-9" aria-busy="true" />;

  if (!status.signedIn) {
    return (
      <div className="flex flex-col gap-3 text-[13px]">
        {waiting ? (
          <div className="flex flex-col gap-1.5 rounded-xl bg-(--accent)/10 p-3">
            <p className="font-medium">Finish in the browser</p>
            <p className="text-(--muted)">Sign in to Composio and press Allow.</p>
            <div>
              <Button small onClick={signIn}>
                Open it again
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-(--muted)">Calendar, mail, Slack and more, in one sign-in.</p>
            <Button primary onClick={signIn}>
              Connect Composio
            </Button>
          </div>
        )}
        <OtherWays onError={onError} />
      </div>
    );
  }

  const connected = status.apps.filter((a) => a.connected || justDone === `app:${a.slug}`);
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1">
          Connected
          <span className="block text-[12px] text-(--muted)">
            {connected.length === 0
              ? "No apps connected in your Composio account yet."
              : `${connected.length} ${connected.length === 1 ? "app" : "apps"} from your Composio account`}
          </span>
        </p>
        <Button small onClick={refresh} disabled={busy}>
          {busy ? "Checking..." : "Refresh"}
        </Button>
        <Button
          small
          onClick={() =>
            void api
              .composioSignOut()
              .then(refresh)
              .catch((e) => onError(String(e)))
          }
        >
          Disconnect
        </Button>
      </div>
      {status.error && (
        <p className="text-[12px] text-(--muted)">Could not check just now, showing the last list. {status.error}</p>
      )}
      <ComposioApps status={status} onError={onError} resumeTab="connections" />
      {note && <p className="text-[12px] text-(--muted)">{note}</p>}
      <Meetings onError={onError} />
      <Toggle
        label="Use these apps in Ask"
        checked={composio.enabled}
        onChange={(enabled) =>
          void updateSettings({ composio: { ...composio, enabled } }).catch((e) => onError(String(e)))
        }
      />
    </div>
  );
}
