"use client";

// Part of home-tab: CopyDiagnostics.

import { useState } from "react";
import { api } from "@/lib/bridge";
import { Button } from "../ui";
import { ISSUES } from "./notification-inbox";

export function CopyDiagnostics({ onError }: { onError: (e: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Saves the log to Downloads and opens a new issue; nothing is sent until
  // you attach the file there yourself.
  const send = () =>
    void api
      .reportSave()
      .then(async (path) => {
        setSaved("Saved to Downloads. Read it, then drag it into the issue.");
        await api.revealPath(path);
        const body = "What happened:\n\nWhat I expected:\n\n(Drag the Duskie report file from Downloads here.)\n";
        await api.aiOpenLink(`${ISSUES}?title=${encodeURIComponent("Bug report")}&body=${encodeURIComponent(body)}`);
      })
      .catch((e: unknown) => onError(String(e)));
  const copy = () =>
    void api
      .diagnostics()
      .then((text) => navigator.clipboard.writeText(text))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((e: unknown) => onError(String(e)));
  return (
    <div className="flex items-center gap-3">
      <Button small onClick={copy}>
        {copied ? "Copied" : "Copy diagnostics"}
      </Button>
      <Button small onClick={send}>
        Send report
      </Button>
      <span className="text-[13px] text-(--muted)">
        {saved ?? "For a bug report. Keys, tokens and your name are taken out."}
      </span>
    </div>
  );
}
