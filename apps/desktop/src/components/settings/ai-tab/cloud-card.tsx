"use client";

// Part of ai-tab: CloudCard.

import { type CloudId, PROVIDER_LABELS } from "@/lib/types";
import { Field, TextField } from "../ui";
import { CLOUD_KEYS } from "./not-ready";
import { CloudKey, RouterModels } from "./router-models";

/** A cloud provider's key (kept in Credential Manager) and model. */
export function CloudCard({
  id,
  model,
  onModel,
  onChanged,
  onError,
}: {
  id: CloudId;
  model: string;
  onModel: (model: string) => void;
  onChanged: () => void;
  onError: (e: string) => void;
}) {
  const info = CLOUD_KEYS[id];
  return (
    <>
      <CloudKey id={id} onChanged={onChanged} onError={onError} />
      {id === "openrouter" ? (
        <RouterModels value={model || info.model} onChange={onModel} onError={onError} />
      ) : (
        <Field label="Model" hint={`Empty uses ${info.model}`}>
          <TextField
            label={`${PROVIDER_LABELS[id]} model`}
            value={model}
            placeholder={info.model}
            mono
            className="w-56"
            onCommit={onModel}
          />
        </Field>
      )}
    </>
  );
}
