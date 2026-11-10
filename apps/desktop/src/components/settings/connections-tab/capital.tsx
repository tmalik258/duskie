"use client";

// Part of connections-tab: capital, editorColor, hours, EditorPicker, OtherWays.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { updateSettings, useDuskie } from "@/lib/store";
import type { EditorList } from "@/lib/types";
import { Button, Field, Select, type SelectOption, TextField } from "../ui";

const capital = (t: string) => t.slice(0, 1).toUpperCase() + t.slice(1);

/** Each editor's own colour behind its letter. */
function editorColor(id: string): string {
  const colors: Record<string, string> = {
    cursor: "#111",
    vscode: "#0f78d4",
    code: "#0f78d4",
    antigravity: "#2f6fd8",
    windsurf: "#0b9e8a",
    vscodium: "#2a7fd4",
    zed: "#3d3d46",
    pycharm: "#d63c78",
    intellij: "#e0533b",
    webstorm: "#00a3c4",
    rider: "#c90f5e",
    visualstudio: "#7a3fd8",
  };
  const key = Object.keys(colors).find((k) =>
    id
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .includes(k),
  );
  return key ? colors[key] : "#2b2b30";
}

function hours(minutes: number): string {
  if (minutes <= 0) return "not used this week";
  if (minutes < 60) return `${minutes} min this week`;
  return `${Math.round(minutes / 60)} h this week`;
}

export function EditorPicker({ onError }: { onError: (e: string) => void }) {
  const choice = useDuskie((s) => s.settings.codeEditor);
  const { data, refresh } = useCached<EditorList>("editors", api.editorsList);
  const editors = data?.editors ?? [];
  // One editor: no Auto, lock to that id. Two or more: Auto is the default.
  useEffect(() => {
    if (!data || editors.length !== 1) return;
    const sole = editors[0].id;
    if (choice === sole) return;
    void updateSettings({ codeEditor: sole })
      .then(() => refresh())
      .catch((e: unknown) => onError(String(e)));
  }, [data, editors, choice, refresh, onError]);
  if (data && editors.length === 0) {
    return <p className="text-[13px] text-(--muted)">No code editor found on this PC.</p>;
  }
  const multi = editors.length >= 2;
  const value = editors.some((e) => e.id === choice) ? choice : multi ? "auto" : (editors[0]?.id ?? "auto");
  const editorRows: SelectOption[] = editors.map((e, i) => ({
    value: e.id,
    label: e.name,
    sub: capital(hours(e.minutes)),
    icon: e.name.slice(0, 1).toUpperCase(),
    color: editorColor(e.id),
    sepBefore: multi && i === 0,
  }));
  const options: SelectOption[] = multi
    ? [
        {
          value: "auto",
          label: "Auto",
          sub: data?.current ? `${data.current} right now · the one you use most` : "The one you use most",
          icon: "A",
          color: "linear-gradient(135deg,#3a3a44,#24242b)",
        },
        ...editorRows,
      ]
    : editorRows;
  const named = editors.find((e) => e.id === value)?.name;
  return (
    <Field
      label="Open projects and files in"
      hint={`Found ${editors.length} ${editors.length === 1 ? "editor" : "editors"} on this PC.`}
    >
      <Select
        label="Open projects and files in"
        value={value}
        group="Open with"
        current={value === "auto" ? `Auto${data?.current ? ` · ${data.current}` : ""}` : named}
        options={options}
        onChange={(codeEditor) =>
          void updateSettings({ codeEditor })
            .then(() => refresh())
            .catch((e) => onError(String(e)))
        }
      />
    </Field>
  );
}

/** A consumer key, or another MCP link, instead of the browser sign-in. */
export function OtherWays({ onError }: { onError: (e: string) => void }) {
  const composio = useDuskie((s) => s.settings.composio);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const save = (patch: Partial<typeof composio>) =>
    updateSettings({ composio: { ...composio, ...patch } }).catch((e) => onError(String(e)));
  return (
    <details className="text-[12.5px]">
      <summary className="cursor-pointer text-(--muted)">Other ways to connect</summary>
      <div className="mt-2 flex flex-col gap-2.5">
        <p className="text-(--muted)">
          Paste a Composio consumer key (starts with ck_), from the Composio website under your account.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="password"
            aria-label="Composio consumer key"
            value={key}
            placeholder="ck_..."
            onChange={(e) => setKey(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-(--border) bg-transparent px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-(--accent)"
          />
          <Button
            small
            primary
            disabled={busy || key.trim().length < 8}
            onClick={() => {
              setBusy(true);
              setNote(null);
              api
                .composioUseKey(key)
                .then((m) => {
                  setKey("");
                  setNote(m);
                })
                .catch((e) => setNote(String(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Checking..." : "Use key"}
          </Button>
        </div>
        <Field label="MCP link" hint="Leave empty for Composio Connect.">
          <TextField
            label="Composio MCP link"
            value={composio.url}
            placeholder="https://connect.composio.dev/mcp"
            className="w-56"
            mono
            onCommit={(url) => void save({ url, enabled: Boolean(url) || composio.enabled })}
          />
        </Field>
        <div className="flex gap-2">
          <Button
            small
            onClick={() =>
              void api
                .composioImport()
                .then(() => setNote("Copied from Claude Code."))
                .catch((e) => setNote(String(e)))
            }
          >
            Use Claude Code&apos;s
          </Button>
        </div>
        {note && <p className="text-(--muted)">{note}</p>}
      </div>
    </details>
  );
}
