"use client";

// Part of privacy-tab: PauseStatus, ClearIndex, SearchSettings, Capabilities.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { useNow } from "@/lib/hooks";
import { updateSettings, useDuskie } from "@/lib/store";
import { type CapabilityInfo, type Folder, type Found, isPaused, type LocalModels, type Pause } from "@/lib/types";
import { Button, Field, FolderPicker, Select, Toggle } from "../ui";

export function PauseStatus({ pause }: { pause: Pause }) {
  const now = useNow(10_000);
  let text = "Duskie is noticing things.";
  if (pause.kind === "indefinite") text = "Paused until you resume.";
  if (pause.kind === "until" && isPaused(pause, now)) {
    const minutes = Math.max(1, Math.round((Date.parse(pause.until) - now) / 60_000));
    text = `Paused for about ${minutes} more min.`;
  }
  return <p className="text-sm">{text}</p>;
}

function ClearIndex({ onDone }: { onDone: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const id = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(id);
  }, [sure]);
  return (
    <Button
      small
      onClick={() => {
        if (!sure) return setSure(true);
        setSure(false);
        void api.searchClear().then(onDone);
      }}
    >
      {sure ? "Delete everything?" : "Clear"}
    </Button>
  );
}

export function SearchSettings({ onError }: { onError: (e: string) => void }) {
  const folders = useDuskie((s) => s.settings.indexFolders);
  const semantic = useDuskie((s) => s.settings.semanticSearch);
  const { data: detected } = useCached<Found>("setup-detect", api.setupDetect);
  const found: Folder[] = detected?.searchFolders ?? [];
  const { data: models } = useCached<LocalModels>("local-models", api.localModels);
  const { data: status, refresh: reload } = useCached("search-status", api.searchStatus);
  const refresh = () => void reload().catch(() => undefined);
  const setSemantic = (patch: Partial<typeof semantic>) =>
    updateSettings({ semanticSearch: { ...semantic, ...patch } }).catch((e: unknown) => onError(String(e)));
  const embed = models?.embed ?? [];
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <FolderPicker
        found={found}
        chosen={folders}
        empty={detected ? "No usual folders found. Add one below." : ""}
        onChange={(indexFolders) =>
          void updateSettings({ indexFolders })
            .then(() => api.searchReindex())
            .catch((e: unknown) => onError(String(e)))
        }
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-(--muted)">
          {status === null ? "\u00a0" : `${status.items.toLocaleString()} items indexed`}
          {semantic.enabled && status && status.embedded > 0 && `, ${status.embedded.toLocaleString()} by meaning`}
        </span>
        <div className="flex gap-1.5">
          <Button
            small
            onClick={() => {
              void api.searchReindex();
              setTimeout(refresh, 15_000);
            }}
          >
            Re-index
          </Button>
          <ClearIndex onDone={refresh} />
        </div>
      </div>
      <Toggle
        label="Search by meaning"
        hint="Not just the exact words"
        checked={semantic.enabled}
        onChange={(enabled) => void setSemantic({ enabled })}
      />
      {semantic.enabled && (
        <Field
          label="Embedding model"
          hint={embed.length ? "Found in Ollama" : "None found. Install the search model in AI > Local."}
        >
          <Select
            label="Embedding model"
            value={semantic.model}
            options={embed.map((m) => [m, m])}
            onChange={(model) => void setSemantic({ model })}
          />
        </Field>
      )}
      {semantic.enabled && status?.embedError && (
        <p className="text-[12px] text-(--muted)">Search by meaning is waiting: {status.embedError}</p>
      )}
    </div>
  );
}

export function Capabilities({ onError }: { onError: (e: string) => void }) {
  const [info, setInfo] = useState<CapabilityInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(
    (rescan: boolean) => {
      setBusy(true);
      api
        .capabilitiesGet(rescan)
        .then(setInfo)
        .catch((e) => onError(String(e)))
        .finally(() => setBusy(false));
    },
    [onError],
  );
  useEffect(() => load(false), [load]);
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <div className="flex flex-wrap gap-1.5">
        {info?.found.length ? (
          info.found.map((f) => (
            <span key={f} className="rounded-full bg-(--surface) px-2.5 py-1">
              {f}
            </span>
          ))
        ) : (
          <span className="text-(--muted)">Nothing found yet.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button small onClick={() => load(true)} disabled={busy}>
          {busy ? "Scanning..." : "Rescan"}
        </Button>
        <Button
          small
          onClick={() =>
            void api
              .choicesReset()
              .then((n) => setNotice(n ? `Forgot ${n} learned choices.` : "No learned choices yet."))
          }
        >
          Forget learned choices
        </Button>
      </div>
      {notice && <p className="text-[12px] text-(--muted)">{notice}</p>}
      {info && (
        <p className="text-[12px] text-(--muted)">
          Your own skills: <span className="font-mono break-all">{info.skillsDir}</span>
        </p>
      )}
      {info?.skillErrors.map((e) => (
        <p key={e} className="text-[12px] text-red-500">
          {e}
        </p>
      ))}
    </div>
  );
}
