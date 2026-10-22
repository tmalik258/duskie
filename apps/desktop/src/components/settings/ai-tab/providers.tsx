"use client";

// AI providers in the order Duskie tries them, each with its switch and settings.

import { Reorder } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CLAUDE_MODELS, CODEX_MODELS, explicitModel, FAST_CLAUDE_MODEL, FAST_CODEX_MODEL } from "@/lib/ai-models";
import { api } from "@/lib/bridge";
import { SETUP_STATUS_CACHE_KEY, useCached } from "@/lib/cache";
import { updateSettings } from "@/lib/store";
import {
  AI_PROVIDERS,
  type AiProviderId,
  type AiSettings,
  type LocalModels,
  type ProviderStatus,
  type SetupStatus,
} from "@/lib/types";
import { SetupItems } from "../../setup-checklist/group-titles";
import { Button, Field, Select } from "../ui";
import { CliFields } from "./cli-fields";
import { CloudCard } from "./cloud-card";
import { LocalFields } from "./local-fields";
import { CODING_AGENTS, DragRow, isCloud, PROVIDER_SETUP } from "./not-ready";
import { ProviderHead } from "./provider-head";
import { useStartOllama } from "./use-start-ollama";

export function Providers({ ai, onError }: { ai: AiSettings; onError: (e: string) => void }) {
  // Last known answers paint at once; dots and lists only change when the data does.
  // Revalidate on mount so StatusDot and model lists agree with Ollama right now.
  const { data: status, refresh: reloadStatus } = useCached<ProviderStatus[]>(
    "ai-status",
    api.aiStatus,
    undefined,
    true,
  );
  const { data: models, refresh: reloadModels } = useCached<LocalModels>(
    "local-models",
    api.localModels,
    undefined,
    true,
  );
  const { data: setup, refresh: reloadSetup } = useCached<SetupStatus>(SETUP_STATUS_CACHE_KEY, api.setupStatus);
  const ollama = setup?.items.find((i) => i.id === "ollama");
  const { starting, startOllama } = useStartOllama(ollama?.opensApp, [reloadModels, reloadStatus, reloadSetup]);
  const first = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check when the local server address changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void reloadStatus().catch(() => undefined);
    void reloadModels().catch(() => undefined);
  }, [ai.local.baseUrl]);

  const save = (next: Partial<AiSettings>) =>
    updateSettings({ ai: { ...ai, ...next } }).catch((e: unknown) => onError(String(e)));
  const available = (id: string) => status?.find((s) => s.id === id)?.available;
  const move = (id: AiProviderId, delta: number) => {
    const order = [...ai.order];
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void save({ order });
  };
  const enabled = (id: AiProviderId) =>
    id === "claude_code"
      ? ai.claudeCode.enabled
      : id === "codex"
        ? ai.codex.enabled
        : id === "anthropic"
          ? ai.anthropic.enabled
          : isCloud(id)
            ? ai[id].enabled
            : ai.local.enabled;
  const setEnabled = (id: AiProviderId, on: boolean) => {
    if (id === "claude_code") void save({ claudeCode: { ...ai.claudeCode, enabled: on } });
    else if (id === "codex") void save({ codex: { ...ai.codex, enabled: on } });
    else if (id === "anthropic") void save({ anthropic: { ...ai.anthropic, enabled: on } });
    else if (isCloud(id)) void save({ [id]: { ...ai[id], enabled: on } });
    else void save({ local: { ...ai.local, enabled: on } });
  };
  const saved = ai.order.filter((id) => AI_PROVIDERS.includes(id));
  // While dragging, the list follows the cursor; it is saved on drop.
  const [dragged, setDragged] = useState<AiProviderId[] | null>(null);
  const order = dragged ?? saved;
  const drop = () => {
    if (dragged) void save({ order: dragged });
    setDragged(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Reorder.Group as="ol" axis="y" values={order} onReorder={setDragged} className="flex flex-col gap-3">
        {order.map((id, i) => (
          <DragRow key={id} value={id} onDrop={drop} onStep={(delta) => move(id, delta)}>
            {(handle) => (
              <>
                <div className="flex items-center gap-3">
                  {handle}
                  <ProviderHead
                    id={id}
                    index={i}
                    // Local ready follows local-models (same source as the dropdowns),
                    // not ai-status, so "Not running" never fights a populated model list.
                    checking={id === "local" ? models === null : status === null}
                    ok={id === "local" ? models?.reachable === true : Boolean(available(id))}
                    outOfUsage={id === "claude_code" && Boolean(setup?.items.find((x) => x.id === "claude_code")?.done)}
                    enabled={enabled(id)}
                    onEnabled={(on) => setEnabled(id, on)}
                  />
                </div>
                <SetupItems ids={PROVIDER_SETUP[id]} />
                {id === "claude_code" && (
                  <CliFields
                    name="Claude Code"
                    bin="claude"
                    model={explicitModel(ai.claudeCode.model, FAST_CLAUDE_MODEL)}
                    models={CLAUDE_MODELS}
                    path={ai.claudeCode.path}
                    onModel={(model) => void save({ claudeCode: { ...ai.claudeCode, model } })}
                    onPath={(path) => save({ claudeCode: { ...ai.claudeCode, path } })}
                  />
                )}
                {id === "codex" && (
                  <CliFields
                    name="Codex"
                    bin="codex"
                    model={explicitModel(ai.codex.model, FAST_CODEX_MODEL)}
                    models={CODEX_MODELS}
                    path={ai.codex.path}
                    onModel={(model) => void save({ codex: { ...ai.codex, model } })}
                    onPath={(path) => save({ codex: { ...ai.codex, path } })}
                  />
                )}
                {id === "anthropic" && (
                  <Field label="Model">
                    <Select
                      label="Anthropic model"
                      value={explicitModel(ai.anthropic.model, FAST_CLAUDE_MODEL)}
                      options={CLAUDE_MODELS}
                      onChange={(model) => void save({ anthropic: { ...ai.anthropic, model } })}
                    />
                  </Field>
                )}
                {isCloud(id) && (
                  <CloudCard
                    id={id}
                    model={ai[id].model}
                    onModel={(model) => void save({ [id]: { ...ai[id], model } })}
                    onChanged={() => void reloadStatus().catch(() => undefined)}
                    onError={onError}
                  />
                )}
                {id === "local" && (
                  <LocalFields
                    ai={ai}
                    models={models}
                    ollama={ollama}
                    starting={starting}
                    startOllama={startOllama}
                    save={save}
                  />
                )}
              </>
            )}
          </DragRow>
        ))}
      </Reorder.Group>
      <Field label="Coding agent" hint="Makes changes for Ask">
        <Select
          label="Coding agent"
          value={ai.codingAgent}
          options={CODING_AGENTS}
          onChange={(codingAgent) => void save({ codingAgent })}
        />
      </Field>
      <div>
        <Button
          small
          onClick={() => {
            void reloadStatus().catch(() => undefined);
            void reloadModels().catch(() => undefined);
          }}
        >
          Check again
        </Button>
      </div>
    </div>
  );
}
