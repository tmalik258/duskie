"use client";

// Inline one-click panels for welcome setup items. Prefer automation already
// in Rust (hooks merge, extension helper, detected folders, voice download)
// over paste-this guides.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import { BrowserInstallPanel } from "./setup-browser";
import { ComposioGuide, GuideButton, HooksGuide, McpGuide, VoiceGuide } from "./setup-guides/guide-button";

export function ItemGuide({ id, onDone }: { id: string; onDone: () => void }) {
  switch (id) {
    case "claude_hooks":
      return <HooksGuide onDone={onDone} />;
    case "claude_mcp":
      return <McpGuide onDone={onDone} />;
    case "browser":
      return (
        <div className="border-t border-white/10 pt-2">
          <BrowserInstallPanel onDone={onDone} />
        </div>
      );
    case "code_folders":
      return (
        <FoldersGuide
          label="Code folders"
          hint="Projects Duskie watches for status and end-of-day."
          valueKey="codeFolders"
          detectKey="codeFolders"
          onDone={onDone}
        />
      );
    case "search_folders":
      return (
        <FoldersGuide
          label="Folders to search"
          hint="Documents and notes Duskie can search from Ask mode."
          valueKey="indexFolders"
          detectKey="searchFolders"
          onDone={onDone}
        />
      );
    case "voice":
      return <VoiceGuide onDone={onDone} />;
    case "composio":
      return <ComposioGuide onDone={onDone} />;
    default:
      return (
        <p className="text-[12px] leading-relaxed text-[rgb(235_235_245/0.6)]">
          You can finish this later in Settings. Continue welcome for now.
        </p>
      );
  }
}

function FoldersGuide({
  label,
  hint,
  valueKey,
  detectKey,
  onDone,
}: {
  label: string;
  hint: string;
  valueKey: "codeFolders" | "indexFolders";
  detectKey: "codeFolders" | "searchFolders";
  onDone: () => void;
}) {
  const settings = useDuskie((s) => s.settings);
  const current = settings[valueKey].join("\n");
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(current), [current]);

  const useDetected = () => {
    setBusy(true);
    void api
      .setupDetect()
      .then((found) => {
        const paths = found[detectKey].map((f) => f.path);
        setDraft(paths.join("\n"));
        return updateSettings({ [valueKey]: paths }).then(onDone);
      })
      .finally(() => setBusy(false));
  };

  const save = () => {
    const folders = draft
      .split(/[\n;]/)
      .map((f) => f.trim())
      .filter(Boolean);
    void updateSettings({ [valueKey]: folders }).then(onDone);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <p className="text-[12px] text-[rgb(235_235_245/0.6)]">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        <GuideButton primary disabled={busy} onClick={useDetected}>
          {busy ? "Detecting..." : "Use detected"}
        </GuideButton>
      </div>
      <textarea
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder="C:\Users\you\code"
        className="resize-none rounded-lg border border-white/15 bg-black/25 px-2.5 py-2 font-mono text-[11px] text-white/90 outline-none focus:border-[#0a84ff]"
      />
      <GuideButton onClick={save}>Save folders</GuideButton>
    </div>
  );
}
