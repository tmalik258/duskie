// Model and path for a provider that runs a CLI (Claude Code, Codex).

import { Field, Select, type SelectOption, TextField } from "../ui";

export function CliFields({
  name,
  bin,
  model,
  models,
  path,
  onModel,
  onPath,
}: {
  name: string;
  bin: string;
  model: string;
  models: SelectOption[];
  path: string;
  onModel: (model: string) => void;
  onPath: (path: string) => void;
}) {
  return (
    <>
      <Field label="Model" hint="Availability depends on your plan and CLI version.">
        <Select label={`${name} model`} value={model} options={models} onChange={onModel} />
      </Field>
      <details className="text-[12.5px]">
        <summary className="cursor-pointer text-(--muted)">Where {bin} is</summary>
        <div className="mt-2">
          <Field label={`Path to ${bin}`} hint="Empty finds it on PATH">
            <TextField
              label={`Path to ${bin}`}
              value={path}
              placeholder={bin}
              mono
              className="w-56"
              onCommit={onPath}
            />
          </Field>
        </div>
      </details>
    </>
  );
}
