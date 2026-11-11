"use client";

// Part of chat: yamlBlock, AddSkill, TAG_NAMES, modelOf, ActIcon, SaveRecipe, seconds, Steps, StopIcon.

import { useState } from "react";
import { api } from "@/lib/bridge";
import { useNow } from "@/lib/hooks";
import { type AiSettings, CLOUD_IDS, type CloudId } from "@/lib/types";
import { Tip } from "../../tip";

/** The YAML block of an answer, if it has one. */
export function yamlBlock(text: string): string | null {
  const m = text.match(/```ya?ml\s*\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

export function AddSkill({ yaml }: { yaml: string }) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const install = async () => {
    try {
      const name = await api.skillInstall(yaml);
      setState({ ok: true, message: `Added "${name}". Manage it in Settings > Skills.` });
    } catch (err) {
      setState({ ok: false, message: String(err) });
    }
  };
  if (state)
    return <p className={`mt-1.5 text-[12.5px] ${state.ok ? "text-[#30d158]" : "text-[#ffb4ae]"}`}>{state.message}</p>;
  return (
    <button type="button" onClick={() => void install()} className="ak-chip primary chip justify-self-start">
      Add skill
    </button>
  );
}

/** Who answered, short, as the tag under an answer reads. */
export const TAG_NAMES: Record<string, string> = {
  local: "Local",
  claude_code: "Claude Code",
  codex: "Codex",
  anthropic: "Claude API",
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  xai: "Grok",
  instant: "Done without AI",
};

/** The model name under an answer, short: "qwen3:4b", "sonnet". */
export function modelOf(ai: AiSettings, provider: string): string {
  const m =
    provider === "local"
      ? ai.local.model
      : provider === "claude_code"
        ? ai.claudeCode.model
        : provider === "codex"
          ? ai.codex.model
          : provider === "anthropic"
            ? ai.anthropic.model
            : (CLOUD_IDS as string[]).includes(provider)
              ? ai[provider as CloudId].model
              : "";
  return m.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

export function ActIcon({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

/** Keeps the question as a recipe, to run again by name or on a trigger. */
export function SaveRecipe({ prompt }: { prompt: string }) {
  const [saved, setSaved] = useState<string | null>(null);
  if (!prompt.trim()) return null;
  if (saved) return <span className="max-w-40 truncate whitespace-nowrap">{saved}</span>;
  return (
    <Tip label="Save as recipe">
      <button
        type="button"
        onClick={() =>
          void api
            .recipeSave({ id: "", name: "", prompt, trigger: { when: "manual" }, auto: false, enabled: true })
            .then(setSaved)
            .catch((e) => setSaved(String(e)))
        }
        aria-label="Save as recipe"
        className="ak-act chip"
      >
        <ActIcon d="M7 4h10v16l-5-3.5L7 20z" />
      </button>
    </Tip>
  );
}

/** "1.2 s", or "850 ms" under a second. */
export function seconds(ms: number): string {
  return ms < 1000 ? `${Math.round(ms / 10) * 10} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** The steps of a multi-step task: done ones ticked, the current one live
 * with a timer. Folds to one line once the answer is in. */
export function Steps({
  steps,
  running,
  since,
  tookMs,
}: {
  steps: string[];
  running: boolean;
  since?: number;
  tookMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow(running ? 100 : 60_000);
  const elapsed = running && since ? Math.max(0, now - since) : null;
  if (!running && !open) {
    return (
      <button
        type="button"
        aria-expanded="false"
        onClick={() => setOpen(true)}
        className="ak-steps chip text-left hover:text-white"
      >
        <span className="ok">✓</span>
        {steps.length} {steps.length === 1 ? "step" : "steps"}
        {tookMs !== undefined && ` · ${seconds(tookMs)}`}
      </button>
    );
  }
  // Steps only grow, in order, so their position is a stable id.
  const keyed = steps.map((s, n) => ({ s, id: `${n}:${s}` }));
  return (
    <div className="grid gap-1">
      {!running && (
        <button
          type="button"
          aria-expanded="true"
          onClick={() => setOpen(false)}
          className="ak-steps chip text-left hover:text-white"
        >
          <span className="ok">✓</span>
          {steps.length} {steps.length === 1 ? "step" : "steps"}
          {tookMs !== undefined && ` · ${seconds(tookMs)}`}
          <span className="ml-1 opacity-60">Hide</span>
        </button>
      )}
      <ol
        className="grid gap-0.5 px-1 text-[12px]"
        role={running ? "status" : undefined}
        aria-live={running ? "polite" : undefined}
      >
        {keyed.map(({ s, id }, i) => {
          const live = running && i === steps.length - 1;
          return (
            <li
              key={id}
              className={`flex items-center gap-1.5 ${live ? "text-white/80" : "text-[rgb(235_235_245/0.45)]"}`}
            >
              <span className={live ? "ak-dot animate-pulse bg-white" : "text-[#30d158]"}>{live ? "" : "✓"}</span>
              <span className={live ? "shimmer-text min-w-0 flex-1" : "min-w-0 flex-1"}>{s}</span>
              {live && elapsed !== null && (
                <span className="ak-timer mono" aria-hidden="true">
                  · {(elapsed / 1000).toFixed(1)} s
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
