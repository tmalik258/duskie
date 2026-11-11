"use client";

// The Local agent's model chip: the Ollama models on this PC, picked like
// the Claude Code and Codex models. Takes effect on the next message.

import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import type { LocalModels } from "@/lib/types";
import { Select } from "../../settings/ui";

const GREEN = "#30d158";

export function LocalModelChip({ shown, onModel }: { shown?: string | null; onModel: (m: string | null) => void }) {
  const { data } = useCached<LocalModels>("local-models", api.localModels, undefined, true);
  const chat = data?.chat ?? [];
  // Coding models first: they make the edits reliably.
  const models = [...chat.filter((m) => m.includes("coder")), ...chat.filter((m) => !m.includes("coder"))];
  const current = shown ?? "Local model";
  if (models.length === 0)
    return (
      <span className="ak-cchip">
        <i className="ak-cdot" style={{ background: GREEN }} />
        {current}
      </span>
    );
  return (
    <span className="ak-cmodel">
      <i className="ak-cdot" style={{ background: GREEN }} aria-hidden="true" />
      <Select
        variant="plain"
        overlay
        label="Model"
        menuWidth={280}
        group="Models on this PC, from your next message"
        current={current}
        value={shown ?? ""}
        onChange={(v) => onModel(v)}
        options={models.map((m) => ({
          value: m,
          label: m,
          sub: m.includes("coder") ? "Coding model" : undefined,
          color: GREEN,
        }))}
      />
    </span>
  );
}
