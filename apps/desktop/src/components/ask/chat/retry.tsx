"use client";

// Part of chat: Retry, Handoff, TryAnother, Answer, LiveStep, Thinking, OfflineChips.

import { useEffect, useState } from "react";
import { handOff } from "@/lib/agents";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { Markdown } from "@/lib/markdown";
import { useReveal } from "@/lib/reveal";
import { askAgain, askWhenOnline, retryLast, setAsk, setAskModel, useDuskie } from "@/lib/store";
import { type Agents, PROVIDER_LABELS, type ProviderStatus, type Turn } from "@/lib/types";
import { useAgentName } from "../use-agent-name";

/** "Try again" (Alt T) under a failed answer. */
export function Retry() {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        retryLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <button type="button" onClick={() => retryLast()} className="ak-chip chip justify-self-start">
      Try again
      <kbd>
        <i className="alt-pre">Alt </i>T
      </kbd>
    </button>
  );
}

export function Handoff({ turns, reason }: { turns: Turn[]; reason: string | null }) {
  const [state, setState] = useState<string>("idle");
  const agent = useAgentName();
  const local = useDuskie((s) => s.ask?.localOnly ?? false);
  if (!agent) return null;
  const go = () => {
    // Handing off is the opt-in: this chat leaves the PC from here on.
    if (local) setAsk({ localOnly: false });
    setState("opening");
    const messages = turns.filter((t) => !t.error && t.content.trim()).map(({ role, content }) => ({ role, content }));
    handOff(messages, reason)
      .then(() => setState("opened"))
      .catch((e) => setState(String(e)));
  };
  if (state === "opened") {
    return <p className="mt-1.5 text-[12px] text-[rgb(235_235_245/0.62)]">{agent} carries on in the Agents tab.</p>;
  }
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {reason && <p className="text-[12px] text-[rgb(235_235_245/0.6)]">Too much for the local model: {reason}.</p>}
      {local && (
        <p className="text-[12px] text-[rgb(235_235_245/0.6)]">
          This chat is on this PC only. Continuing sends it to {agent}.
        </p>
      )}
      <button
        type="button"
        disabled={state === "opening"}
        onClick={go}
        className={`ak-chip chip self-start disabled:opacity-50 ${reason ? "primary" : ""}`}
      >
        {state === "opening" ? "Opening..." : local ? `Allow and continue in ${agent}` : `Continue in ${agent}`}
      </button>
      {state !== "idle" && state !== "opening" && <p className="text-[12px] text-[#ffb4ae]">{state}</p>}
    </div>
  );
}

/**
 * The answer fell short: ask the same question with a model the user picks.
 * No model is favoured, and a cloud one only runs when they choose it.
 */
export function TryAnother({ from }: { from: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useCached<ProviderStatus[]>("ai-status", api.aiStatus);
  const local = useDuskie((s) => s.ask?.localOnly ?? false);
  const others = (data ?? []).filter((p) => p.available && p.id !== from && p.id !== "semif");
  if (others.length === 0) return null;
  const pick = (p: ProviderStatus) => {
    // Picking a cloud model is the opt-in: this chat leaves the PC from here.
    if (local && !p.local) setAsk({ localOnly: false });
    setAskModel(p.id);
    askAgain();
  };
  return (
    <div className="ak-chips">
      {open ? (
        others.map((p) => (
          <button key={p.id} type="button" onClick={() => pick(p)} className="ak-chip chip">
            {PROVIDER_LABELS[p.id] ?? p.id}
            <span className="text-[rgb(235_235_245/0.6)]">{p.local ? " · on this PC" : " · sends this chat out"}</span>
          </button>
        ))
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="ak-chip chip">
          Try another model
        </button>
      )}
    </div>
  );
}

/** An answer as it arrives: word by word at a reading pace. */
export function Answer({ text, live }: { text: string; live: boolean }) {
  const shown = useReveal(text, live);
  // The first words settle in from a slight blur; after that, words stream.
  return (
    <div className="settle">
      <Markdown text={shown} />
    </div>
  );
}

/** Before the first words: one shimmering line saying what Duskie is
 * doing, with a timer. */
export function LiveStep({ step, since }: { step: string | null; since?: number }) {
  const now = useNow(100);
  const elapsed = since ? Math.max(0, now - since) : null;
  return (
    <p className="ak-status" role="status" aria-live="polite">
      <span className="shimmer-text text-[rgb(235_235_245/0.6)]">
        {step ? `${step}...` : elapsed !== null && elapsed > 4000 ? "Waking up the AI..." : "Thinking..."}
      </span>
      {elapsed !== null && (
        <span className="ak-timer mono" aria-hidden="true">
          {(elapsed / 1000).toFixed(1)} s
        </span>
      )}
    </p>
  );
}

export function Thinking() {
  return (
    <span className="inline-flex gap-1 py-2" role="status" aria-label="Thinking">
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </span>
  );
}

/** Answered offline: ask again once the internet is back. */
export function OfflineChips() {
  const online = useDuskie((s) => s.online);
  const waiting = useDuskie((s) => s.askWhenOnline !== null);
  useEffect(() => {
    if (online || waiting) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        askWhenOnline();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [online, waiting]);
  if (online) return null;
  if (waiting) return <p className="ak-done">Duskie asks again as soon as the internet is back.</p>;
  return (
    <div className="ak-chips">
      <button type="button" onClick={askWhenOnline} className="ak-chip primary chip">
        Ask when I'm back online{" "}
        <kbd>
          <i className="alt-pre">Alt </i>O
        </kbd>
      </button>
    </div>
  );
}
