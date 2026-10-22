"use client";

// Ask's states besides a normal answer: a failure that says what happened
// and offers the fix, and the first run before any model is set up.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { setAsk, setAskModel } from "@/lib/store";
import type { SetupItem, SetupStatus } from "@/lib/types";
import { AGENT_IMAGES } from "../agents/marks";

/** First run without a model: apps, files and commands already work; pick
 * how questions get answered. */
export function FirstRun() {
  const { data: setup, refresh } = useCached<SetupStatus>("setup-status", api.setupStatus);
  const [running, setRunning] = useState<string | null>(null);
  const item = (id: string) => setup?.items.find((i) => i.id === id);
  const ollama = item("ollama");
  const chat = item("ollama_chat");
  const pcReady = !!ollama?.done && !!chat?.done;

  // Poll while This PC is still installing (including if setup started elsewhere).
  useEffect(() => {
    if (pcReady && !running) return;
    const id = setInterval(() => void refresh().catch(() => undefined), 3000);
    return () => clearInterval(id);
  }, [pcReady, running, refresh]);

  // Install finished: pick local so the card can go away without a dead Ready.
  useEffect(() => {
    if (!pcReady) return;
    setAskModel("local");
    setRunning(null);
  }, [pcReady]);

  const run = (i: SetupItem | undefined) => {
    if (!i) return;
    setRunning(i.id);
    void api.setupRun(i.id).catch(() => setRunning(null));
  };
  const pickCloud = (id: string) => {
    setAsk({ localOnly: false });
    setAskModel(id);
  };
  // This PC needs Ollama first, then its model.
  const pcStep = !ollama?.done ? ollama : chat;
  const options: {
    id: string;
    title: string;
    note: string;
    action: string;
    recommended?: boolean;
    go: () => void;
    done?: boolean;
  }[] = [
    {
      id: "pc",
      title: "This PC",
      note: "Free and private. Installs Ollama and a model picked for this PC.",
      action: pcReady ? "Use it" : running === pcStep?.id ? "Setting up..." : (pcStep?.action ?? "Set up"),
      recommended: true,
      go: () => (pcReady ? setAskModel("local") : run(pcStep)),
      done: false,
    },
    {
      id: "claude_code",
      title: "Claude Code",
      note: `Uses your Claude plan. ${item("claude_code")?.done ? "Found on this PC." : "Not installed."}`,
      action: item("claude_code")?.done ? "Use it" : "Install",
      go: () => (item("claude_code")?.done ? pickCloud("claude_code") : run(item("claude_code"))),
    },
    {
      id: "codex",
      title: "Codex",
      note: `Uses your ChatGPT plan. ${item("codex")?.done ? "Found on this PC." : "Not installed."}`,
      action: item("codex")?.done ? "Use it" : "Install",
      go: () => (item("codex")?.done ? pickCloud("codex") : run(item("codex"))),
    },
    {
      id: "anthropic",
      title: "Anthropic API",
      note: "Pay per answer with your own key.",
      action: "Add key",
      go: () => setAsk({ view: "settings", settingsTab: "ai" }),
    },
  ];
  return (
    <div className="ak-body ak-in">
      <div className="grid gap-1 px-1">
        <p className="text-[14.5px] font-semibold">Choose how Duskie answers</p>
        <p className="text-[13px] text-[rgb(235_235_245/0.6)]">
          Apps, files and commands work already. Pick one to answer questions too; you can add more later.
        </p>
      </div>
      <div className="grid gap-1.5">
        {options.map((o) => (
          <div key={o.id} className={`ak-opt ${o.recommended && !pcReady ? "rec" : ""}`}>
            {AGENT_IMAGES[o.id] ? (
              <span className="oi oi-pic" aria-hidden="true">
                <img src={AGENT_IMAGES[o.id]} alt="" draggable={false} />
              </span>
            ) : (
              <span className="oi">{o.title.slice(0, 1)}</span>
            )}
            <span className="min-w-0">
              <span className="ot">{o.title}</span>
              <span className="od">{o.note}</span>
            </span>
            <button
              type="button"
              disabled={running !== null && o.id === "pc" && !pcReady}
              onClick={o.go}
              className="ob chip"
            >
              {o.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
