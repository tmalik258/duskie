// The skills in the library: where each one syncs, updates for linked
// ones, Remove, and Sync now.

import { api } from "@/lib/bridge";
import type { LibrarySkill } from "@/lib/types";
import { Button, Segmented } from "../ui";
import { Badge, ORIGIN, TARGETS } from "./pick";

export function LibraryList({
  lib,
  busy,
  note,
  onLib,
  onCheck,
  onSync,
  fail,
}: {
  lib: LibrarySkill[];
  busy: boolean;
  note: string;
  onLib: (l: LibrarySkill[]) => void;
  onCheck: (url: string) => void;
  onSync: () => void;
  fail: (e: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">In your library</span>
      <ul className="flex flex-col divide-y divide-(--border)">
        {lib.map((s) => (
          <li key={s.name} className="flex flex-col gap-2 py-2">
            <div className="flex items-center justify-between gap-4">
              <span className="min-w-0 text-[13px]">
                <span className="flex items-center gap-2 font-medium">
                  {s.name} <Badge>{ORIGIN[s.origin]}</Badge>
                  {s.hasScripts && <Badge>Has scripts</Badge>}
                </span>
                <span className="block truncate text-[12px] text-(--muted)">
                  {s.description}
                  {s.commit ? ` (pinned at ${s.commit.slice(0, 7)})` : ""}
                </span>
              </span>
              <span className="flex gap-2">
                {s.url && (
                  <Button small disabled={busy} onClick={() => onCheck(s.url ?? "")}>
                    Check for update
                  </Button>
                )}
                <Button small onClick={() => api.libraryRemove(s.name).then(onLib).catch(fail)}>
                  Remove
                </Button>
              </span>
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
                      .then(onLib)
                      .catch(fail)
                  }
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button small onClick={onSync}>
          Sync now
        </Button>
        {note && <span className="text-[12px] text-(--muted)">{note}</span>}
      </div>
    </div>
  );
}
