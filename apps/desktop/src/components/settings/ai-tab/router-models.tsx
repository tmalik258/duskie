"use client";

// Part of ai-tab: RouterModels, CloudKey.

import { useState } from "react";
import { api, type RouterModel } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { type CloudId, PROVIDER_LABELS } from "@/lib/types";
import { Button, Field, Switch } from "../ui";
import { CLOUD_KEYS } from "./not-ready";

/** OpenRouter's models with search, prices and a Free only filter. */
export function RouterModels({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (id: string) => void;
  onError: (e: string) => void;
}) {
  const [models, setModels] = useState<RouterModel[] | null>(null);
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const load = () => {
    setOpen(true);
    if (!models) api.openrouterModels().then(setModels, (e: unknown) => onError(String(e)));
  };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (models ?? [])
    .filter((m) => !freeOnly || m.free)
    .filter((m) => words.every((w) => `${m.id} ${m.name}`.toLowerCase().includes(w)))
    .slice(0, 60);
  const price = (m: RouterModel) =>
    m.input < 0 ? "Price varies" : m.free ? "Free" : `$${m.input.toFixed(2)} in, $${m.output.toFixed(2)} out`;
  const current = models?.find((m) => m.id === value);
  return (
    <div className="flex flex-col gap-2">
      <Field label="Model" hint={current ? price(current) : "Prices are per million tokens"}>
        <Button small onClick={() => (open ? setOpen(false) : load())}>
          <span className="max-w-48 truncate font-mono">{value}</span>
        </Button>
      </Field>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-(--border) p-2">
          <div className="flex items-center gap-2">
            <input
              type="search"
              aria-label="Search models"
              placeholder="Search models"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-(--border) bg-transparent px-2 py-1 text-[12.5px]"
            />
            <span className="flex shrink-0 items-center gap-1.5 text-[12.5px]">
              Free only
              <Switch checked={freeOnly} onChange={setFreeOnly} label="Free only" />
            </span>
          </div>
          {freeOnly && (
            <p className="text-[12px] text-(--muted)">
              Free models allow 20 questions a minute and 50 a day, or 1,000 a day once $10 of credits were ever bought.
            </p>
          )}
          <ul className="settings-scroll flex max-h-56 flex-col overflow-y-auto">
            {models === null && <li className="px-2 py-1 text-[12.5px] text-(--muted)">Loading...</li>}
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={m.id === value}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-left text-[12.5px] hover:bg-(--border) aria-pressed:bg-(--border)"
                >
                  <span className="min-w-0 truncate">
                    {m.name}
                    {!m.tools && <span className="text-(--muted)"> · no tools</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] text-(--muted)">{price(m)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Paste and check a cloud provider's key, or remove the saved one. */
export function CloudKey({
  id,
  onChanged,
  onError,
}: {
  id: CloudId;
  onChanged?: () => void;
  onError: (e: string) => void;
}) {
  const { data: keys, refresh } = useCached<Record<CloudId, boolean>>("cloud-keys", api.cloudKeys);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const info = CLOUD_KEYS[id];
  const done = () => {
    setKey("");
    void refresh().catch(() => undefined);
    onChanged?.();
  };
  const saveKey = () => {
    setBusy(true);
    api
      .cloudKeySet(id, key)
      .then(done, (e: unknown) => onError(String(e)))
      .finally(() => setBusy(false));
  };
  if (keys?.[id]) {
    return (
      <Field label="Key" hint="Saved in Windows Credential Manager">
        <Button small onClick={() => void api.cloudKeyClear(id).then(done, (e: unknown) => onError(String(e)))}>
          Remove key
        </Button>
      </Field>
    );
  }
  return (
    <Field
      label="Key"
      hint={
        <>
          Free from{" "}
          <button type="button" className="underline" onClick={() => void api.aiOpenLink(info.url)}>
            {info.site}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <input
          type="password"
          aria-label={`${PROVIDER_LABELS[id]} key`}
          value={key}
          placeholder="Paste key"
          autoComplete="off"
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && key.trim()) saveKey();
          }}
          className="w-40 rounded-lg border border-(--border) bg-transparent px-2 py-1 font-mono text-[12.5px]"
        />
        <Button small primary onClick={saveKey} disabled={busy || !key.trim()}>
          {busy ? "Checking..." : "Save"}
        </Button>
      </div>
    </Field>
  );
}
