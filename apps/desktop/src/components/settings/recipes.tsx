"use client";

// Recipes: saved tasks that run by name in Ask, or on a trigger. Each runs as
// an ordinary Ask question, so sending or paying still waits for a tap.

import { useState } from "react";
import { api } from "@/lib/bridge";
import { useDuskie } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import { describeTrigger, TriggerFields } from "./recipes/when";
import { Button, Field, TextField, Toggle } from "./ui";

export function Recipes({ onError }: { onError: (e: string) => void }) {
  const recipes = useDuskie((s) => s.settings.recipes);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const save = (r: Recipe) =>
    api
      .recipeSave(r)
      .then((m) => setNote(m))
      .catch((e) => onError(String(e)));

  return (
    <div className="flex flex-col gap-2.5 text-[13px]">
      {recipes.length === 0 && !draft && (
        <p className="text-(--muted)">
          None yet. Ask for something, then press Save as recipe, or say "every Friday at 5, email my timesheet".
        </p>
      )}
      {recipes.map((r) => (
        <details key={r.id} className="rounded-xl border border-(--border) px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block truncate text-[12px] text-(--muted)">
                {describeTrigger(r.trigger)}
                {r.auto ? ", starts alone" : ""}
                {r.enabled ? "" : ", off"}
              </span>
            </span>
            <Button
              small
              onClick={() =>
                void api
                  .recipeRun(r.id)
                  .then(setNote)
                  .catch((e) => onError(String(e)))
              }
            >
              Run
            </Button>
          </summary>
          <div className="mt-3 flex flex-col gap-2.5">
            <Field label="Instruction">
              <TextField
                label="Instruction"
                value={r.prompt}
                className="w-64"
                onCommit={(prompt) => void save({ ...r, prompt })}
              />
            </Field>
            <TriggerFields trigger={r.trigger} onChange={(trigger) => void save({ ...r, trigger })} />
            <Toggle
              label="Start without asking"
              hint="Sending, posting and paying still wait for your tap"
              checked={r.auto}
              onChange={(auto) => void save({ ...r, auto })}
            />
            <Toggle label="On" checked={r.enabled} onChange={(enabled) => void save({ ...r, enabled })} />
            <div>
              <Button
                small
                onClick={() =>
                  void api
                    .recipeDelete(r.id)
                    .then(setNote)
                    .catch((e) => onError(String(e)))
                }
              >
                Delete
              </Button>
            </div>
          </div>
        </details>
      ))}
      {draft ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-(--border) px-3 py-2.5">
          <Field label="Name">
            <TextField
              label="Recipe name"
              value={draft.name}
              placeholder="Send timesheet"
              className="w-56"
              onCommit={(name) => setDraft({ ...draft, name })}
            />
          </Field>
          <Field label="Instruction" hint="What you would type in Ask">
            <TextField
              label="Recipe instruction"
              value={draft.prompt}
              placeholder="Email my timesheet to Sara"
              className="w-64"
              onCommit={(prompt) => setDraft({ ...draft, prompt })}
            />
          </Field>
          <TriggerFields trigger={draft.trigger} onChange={(trigger) => setDraft({ ...draft, trigger })} />
          <div className="flex gap-2">
            <Button
              small
              primary
              disabled={!draft.prompt.trim()}
              onClick={() => void save(draft).then(() => setDraft(null))}
            >
              Save
            </Button>
            <Button small onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            small
            onClick={() =>
              setDraft({ id: "", name: "", prompt: "", trigger: { when: "manual" }, auto: false, enabled: true })
            }
          >
            New recipe
          </Button>
        </div>
      )}
      {note && <p className="text-[12px] text-(--muted)">{note}</p>}
    </div>
  );
}
