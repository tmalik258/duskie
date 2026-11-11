"use client";

// Part of setup-guides: GuideButton, HooksGuide, McpGuide, VoiceGuide, ComposioGuide.

import { useEffect, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { startWaiting, updateSettings, useDuskie } from "@/lib/store";

export function GuideButton({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`chip self-start rounded-full px-2.5 py-1 text-[12px] font-medium disabled:opacity-50 ${
        primary ? "bg-white text-black hover:bg-white/90" : "bg-white/12 text-white/90 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export function HooksGuide({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setBusy(true);
    setError(null);
    void api
      .claudeAddHooks()
      .then((backup) => {
        setNote(backup ? `Added. Backup saved at ${backup}.` : "Added.");
        onDone();
      })
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-[12px] text-[rgb(235_235_245/0.7)]">
      <p>Adds Duskie&apos;s hooks to Claude Code settings. Your other hooks stay; a backup is written first.</p>
      <GuideButton primary disabled={busy} onClick={add}>
        {busy ? "Adding..." : "Add for me"}
      </GuideButton>
      {note && <p className="text-[11px] text-[#30d158]">{note}</p>}
      {error && <p className="text-[11px] text-[#ff453a]">{error}</p>}
    </div>
  );
}

export function McpGuide({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setBusy(true);
    setError(null);
    void api
      .claudeAddMcp()
      .then(() => {
        setNote("Added to Claude Code.");
        onDone();
      })
      .catch((e) => {
        void api
          .setupRun("claude_mcp")
          .then(() => {
            setNote("Opened PowerShell to add Duskie tools.");
            onDone();
          })
          .catch(() => setError(String(e)));
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-[12px] text-[rgb(235_235_245/0.7)]">
      <p>Registers Duskie&apos;s MCP server with Claude Code so it can search history and notify you.</p>
      <GuideButton primary disabled={busy} onClick={add}>
        {busy ? "Adding..." : "Add for me"}
      </GuideButton>
      {note && <p className="text-[11px] text-[#30d158]">{note}</p>}
      {error && <p className="text-[11px] text-[#ff453a]">{error}</p>}
    </div>
  );
}

export function VoiceGuide({ onDone }: { onDone: () => void }) {
  const settings = useDuskie((s) => s.settings);
  const enable = () => {
    void updateSettings({ voice: { ...settings.voice, wakeWord: true } }).then(() => {
      void api.voiceDownload();
      onDone();
    });
  };
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-[12px] text-[rgb(235_235_245/0.65)]">
      <p>Downloads about 205 MB of speech models once. Audio stays on this PC.</p>
      <GuideButton primary onClick={enable}>
        Turn on wake word
      </GuideButton>
    </div>
  );
}

export function ComposioGuide({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = listen(EVENTS.composioChanged, (e) => {
      setNote(e.ok ? e.message : null);
      if (!e.ok) setError(e.message);
      onDone();
    });
    return () => void off.then((f) => f());
  }, [onDone]);
  const connect = () => {
    setBusy(true);
    setError(null);
    void api
      .composioSignIn()
      .then(() => {
        setNote("Finish in your browser: sign in and press Allow.");
        startWaiting("composio", "Composio", {
          resumeTab: "connections",
          steps: ["Composio opened in your browser.", "Sign in and press Allow."],
          again: connect,
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2 text-[12px] leading-relaxed text-[rgb(235_235_245/0.65)]">
      <p>Opens Composio sign-in in your browser. Calendar, Gmail and more connect from there.</p>
      <GuideButton primary disabled={busy} onClick={connect}>
        {busy ? "Opening..." : "Connect"}
      </GuideButton>
      {note && <p className="text-[11px] text-[#30d158]">{note}</p>}
      {error && <p className="text-[11px] text-[#ff453a]">{error}</p>}
    </div>
  );
}
