"use client";

// One library of skills for Claude Code, Codex and the local model. Skills
// are copied, never run: a skill with scripts is marked so the user knows.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { FoundSkill, LibrarySkill, SkillOrigin, SkillTarget } from "@/lib/types";
import { Button, Segmented } from "./ui";

const ORIGIN: Record<SkillOrigin, string> = {
  claude: "Claude Code",
  claude_plugin: "Claude plugin",
  codex: "Codex",
  duskie: "Duskie",
  url: "Link",
};

const TARGETS: [SkillTarget, string][] = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["local", "Local model"],
];

function Badge({ children }: { children: string }) {
  return <span className="rounded-full border border-(--border) px-1.5 text-[11px] text-(--muted)">{children}</span>;
}

export function SkillLibrary({ onError }: { onError: (e: string) => void }) {
  const [found, setFound] = useState<FoundSkill[]>([]);
  const [lib, setLib] = useState<LibrarySkill[]>([]);
  const [note, setNote] = useState("");
  const fail = useCallback((e: unknown) => onError(String(e)), [onError]);
  const refresh = useCallback(() => {
    api.libraryList().then(setLib).catch(fail);
    api.libraryReview().then(setFound).catch(fail);
  }, [fail]);
  useEffect(refresh, [refresh]);

  const importAll = (names: string[]) =>
    api
      .libraryImport(names)
      .then((l) => {
        setLib(l);
        return api.libraryReview().then(setFound);
      })
      .catch(fail);
  const sync = () =>
    api
      .librarySync()
      .then((r) => {
        const parts = [`${r.written.length} written`];
        if (r.conflicts.length) parts.push(`${r.conflicts.length} changed by hand, left alone`);
        if (r.backups.length) parts.push(`${r.backups.length} backed up`);
        setNote(parts.join(", "));
      })
      .catch(fail);

  return (
    <div className="flex flex-col gap-3">
      {found.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">
              {found.length} skill{found.length === 1 ? "" : "s"} found on this PC
            </span>
            <Button small onClick={() => importAll(found.map((f) => f.name))}>
              Add all
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-(--border)">
            {found.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-4 py-2">
                <span className="min-w-0 text-[13px]">
                  <span className="flex items-center gap-2 font-medium">
                    {f.name} <Badge>{ORIGIN[f.origin]}</Badge>
                    {f.hasScripts && <Badge>Has scripts</Badge>}
                  </span>
                  <span className="block truncate text-[12px] text-(--muted)">{f.description}</span>
                </span>
                <Button small onClick={() => importAll([f.name])}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lib.length === 0 ? (
        <p className="text-[13px] text-(--muted)">No skills in your library yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--border)">
          {lib.map((s) => (
            <li key={s.name} className="flex flex-col gap-2 py-2">
              <div className="flex items-center justify-between gap-4">
                <span className="min-w-0 text-[13px]">
                  <span className="flex items-center gap-2 font-medium">
                    {s.name} <Badge>{ORIGIN[s.origin]}</Badge>
                    {s.hasScripts && <Badge>Has scripts</Badge>}
                  </span>
                  <span className="block truncate text-[12px] text-(--muted)">{s.description}</span>
                </span>
                <Button small onClick={() => api.libraryRemove(s.name).then(setLib).catch(fail)}>
                  Remove
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                {TARGETS.map(([t, label]) => (
                  <Segmented
                    key={t}
                    label={label}
                    value={s.targets[t] === false ? "off" : "on"}
                    options={[
                      ["on", `${label} on`],
                      ["off", "Off"],
                    ]}
                    onChange={(v) =>
                      api
                        .librarySetTarget(s.name, t, v === "on")
                        .then(setLib)
                        .catch(fail)
                    }
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {lib.length > 0 && (
        <div className="flex items-center gap-3">
          <Button small onClick={sync}>
            Sync now
          </Button>
          {note && <span className="text-[12px] text-(--muted)">{note}</span>}
        </div>
      )}
    </div>
  );
}
