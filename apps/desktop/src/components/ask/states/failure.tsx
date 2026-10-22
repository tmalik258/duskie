"use client";

// Part of states: Failure, untilReady, explain, FailureCard, useOffline.

import { useEffect, useRef, useState } from "react";
import { handOff } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { askWhenOnline, retryLast, setAsk, setAskModel, useDuskie } from "@/lib/store";
import type { Turn } from "@/lib/types";
import { useAgentName } from "../use-agent-name";

interface Failure {
  title: string;
  detail: string;
  /** The fix, when there is one Duskie can do. */
  fix?: { label: string; run: () => Promise<void> };
}

/** Waits until a model can answer (after starting Ollama), up to `ms`. */
async function untilReady(ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const status = await api.aiStatus().catch(() => []);
    if (status.some((p) => p.available && p.id !== "semif")) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** What went wrong, in words, and the fix. */
export function explain(error: string, provider: string | null | undefined): Failure {
  const e = error.toLowerCase();
  if (
    /11434|ollama|local model is not running|no local model is running/.test(e) ||
    (provider === "local" && /connect|refused|error sending request/.test(e))
  ) {
    return {
      title: "The local model is not running",
      detail: "Ollama is installed but stopped. Starting it takes a few seconds.",
      fix: {
        label: "Start Ollama",
        run: async () => {
          await api.setupRun("ollama");
          if (await untilReady(20_000)) retryLast();
        },
      },
    };
  }
  if (/too old|unknown option|unexpected argument|unrecognized (option|argument|subcommand)|method not found/.test(e)) {
    const codex = provider === "codex" || /codex/.test(e);
    return {
      title: `${codex ? "Codex" : "Claude Code"} needs an update`,
      detail: `This version is too old for Duskie. Run ${codex ? "npm install -g @openai/codex@latest" : "claude update"} in a terminal, then retry.`,
    };
  }
  if (/no model found|pull a model|ollama pull/.test(e)) {
    return {
      title: "No local model downloaded yet",
      detail: "Ollama is running but has no chat model yet. Duskie downloads one that suits this PC.",
      fix: { label: "Download it", run: () => api.setupRun("ollama_chat") },
    };
  }
  if (/not logged in|log in|login|sign in|unauthori|401|invalid api key|authentication/.test(e)) {
    return {
      title: "Sign-in needed",
      detail: "The model you picked needs you to sign in again.",
      fix: {
        label: "Open AI settings",
        run: async () => setAsk({ view: "settings", settingsTab: "ai" }),
      },
    };
  }
  if (/did not answer in|took over \d+ minutes/.test(e)) {
    return {
      title: "That model got stuck",
      detail: "Duskie stopped it and tried the others. Try again, or pick a different model.",
    };
  }
  if (/claude code usage limit/.test(e)) {
    return {
      title: "Claude Code's usage is used up",
      detail: "Duskie tried your other models too. Ask the model on this PC, or try again once it resets.",
      fix: {
        label: "Ask the local model",
        run: async () => {
          setAskModel("local");
          retryLast();
        },
      },
    };
  }
  if (/rate limit|429|usage limit|quota|overloaded|529/.test(e)) {
    return {
      title: "That model is busy or out of quota",
      detail: "Ask the model on this PC instead, or try again in a little while.",
      fix: {
        label: "Ask the local model",
        run: async () => {
          setAskModel("local");
          retryLast();
        },
      },
    };
  }
  if (/no ai provider|no ai set up/.test(e)) {
    return { title: "No AI is set up yet", detail: "Pick how Duskie answers below." };
  }
  if (/timed out|dns|network|offline|internet/.test(e)) {
    return {
      title: "The internet is not reachable",
      detail: "The answer needs the web. Duskie can ask again when you are back online.",
      fix: { label: "Ask when I'm back online", run: async () => askWhenOnline() },
    };
  }
  return { title: "That did not work", detail: error };
}

/** A failed answer: what happened, the fix (Enter), the agent (Ctrl Enter)
 * and Retry (Alt T). */
export function FailureCard({ turn, turns }: { turn: Turn; turns: Turn[] }) {
  const f = explain(turn.error ?? "", turn.provider);
  const agent = useAgentName();
  const [busy, setBusy] = useState<string | null>(null);
  const fix = f.fix;
  const runFix = useRef<() => void>(() => undefined);
  runFix.current = () => {
    if (!fix || busy) return;
    setBusy(`${fix.label}...`);
    void fix
      .run()
      .catch((e: unknown) => setBusy(String(e)))
      .finally(() => setBusy((b) => (b?.endsWith("...") ? null : b)));
  };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const empty = !(e.target instanceof HTMLInputElement) || e.target.value.trim() === "";
      if (e.key === "Enter" && !e.ctrlKey && !e.altKey && empty) {
        e.preventDefault();
        runFix.current();
      } else if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        retryLast();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const toAgent = () => {
    const messages = turns.filter((t) => !t.error && t.content.trim()).map(({ role, content }) => ({ role, content }));
    void handOff(messages, f.title);
  };
  return (
    <div className="ak-body">
      <div className="ak-err ak-in" role="alert">
        <span className="font-semibold text-[13.5px]">{f.title}</span>
        <span className="text-[12.5px] text-[rgb(235_235_245/0.6)]">{busy ?? f.detail}</span>
      </div>
      <div className="ak-chips">
        {fix && (
          <button type="button" disabled={!!busy} onClick={() => runFix.current()} className="ak-chip primary chip">
            {fix.label} <kbd>Enter</kbd>
          </button>
        )}
        {agent && turn.provider !== "claude_code" && turn.provider !== "codex" && (
          <button type="button" onClick={toAgent} className="ak-chip chip">
            Ask {agent} instead <kbd>Ctrl Enter</kbd>
          </button>
        )}
        <button type="button" onClick={() => retryLast()} className="ak-chip chip">
          Retry{" "}
          <kbd>
            <i className="alt-pre">Alt </i>T
          </kbd>
        </button>
      </div>
    </div>
  );
}

/** "Offline" at the start of the context line while the internet is gone. */
export function useOffline(): boolean {
  return !useDuskie((s) => s.online);
}
