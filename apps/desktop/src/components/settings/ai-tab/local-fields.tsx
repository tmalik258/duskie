// The local model's settings: chat and vision models, Start Ollama, server URL.

import type { AiSettings, LocalModels, SetupItem } from "@/lib/types";
import { Button, Field, Select, TextField } from "../ui";

export function LocalFields({
  ai,
  models,
  ollama,
  starting,
  startOllama,
  save,
}: {
  ai: AiSettings;
  models: LocalModels | null;
  ollama: SetupItem | undefined;
  starting: string | null;
  startOllama: () => Promise<void>;
  save: (next: Partial<AiSettings>) => Promise<unknown>;
}) {
  const chatModels: [string, string][] = [
    ["", models?.chat.length ? `Newest (${models.chat[0]})` : "Newest installed"],
    ...(models?.chat ?? []).map((m) => [m, m] as [string, string]),
  ];
  return (
    <>
      <Field
        label="Model"
        hint={
          models === null
            ? "\u00a0"
            : models.reachable
              ? `${models.chat.length} chat ${models.chat.length === 1 ? "model" : "models"} installed`
              : "Ollama is not running"
        }
      >
        {models && !models.reachable ? (
          <Button primary onClick={() => void startOllama()} disabled={starting?.endsWith("...")}>
            {starting ?? (ollama && !ollama.opensApp && ollama.runnable ? "Install Ollama" : "Start Ollama")}
          </Button>
        ) : (
          <Select
            label="Local model"
            value={ai.local.model}
            options={chatModels}
            onChange={(model) => void save({ local: { ...ai.local, model } })}
          />
        )}
      </Field>
      <Field label="Vision model" hint="For pictures without text">
        <Select
          label="Vision model"
          value={!ai.local.visionModel || ai.local.visionModel === "off" ? "off" : ai.local.visionModel}
          options={[["off", "Off (read text)"], ...(models?.vision ?? []).map((m) => [m, m] as [string, string])]}
          onChange={(visionModel) => void save({ local: { ...ai.local, visionModel } })}
        />
      </Field>
      <details className="text-[12.5px]">
        <summary className="cursor-pointer text-(--muted)">Server</summary>
        <div className="mt-2">
          <Field label="Server URL">
            <TextField
              label="Server URL"
              value={ai.local.baseUrl}
              mono
              className="w-56"
              onCommit={(baseUrl) => save({ local: { ...ai.local, baseUrl } })}
            />
          </Field>
        </div>
      </details>
    </>
  );
}
