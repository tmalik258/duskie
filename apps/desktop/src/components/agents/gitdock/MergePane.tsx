"use client";

// Merge: a pull that stopped on conflicts, solved here. Each file shows the
// first conflict side by side; pick Yours, Theirs or Both, or open it in the
// editor. Finish applies every pick and commits; Undo goes back to before.

import { useState } from "react";
import { api } from "@/lib/bridge";
import type { MergeState } from "@/lib/types";
import { Ic } from "../../Icon";

type Side = "mine" | "theirs" | "both";
const SIDES: [Side, string][] = [
  ["mine", "Yours"],
  ["theirs", "Theirs"],
  ["both", "Both"],
];

export function MergePane({
  path,
  state,
  onChanged,
  onOpen,
}: {
  path: string;
  state: MergeState;
  onChanged: () => void;
  onOpen: (file: string) => void;
}) {
  const [picks, setPicks] = useState<Record<string, Side>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const files = state.files;
  const chosen = files.filter((f) => picks[f.file]).length;

  const end = async (finish: boolean) => {
    setBusy(true);
    setNote(null);
    try {
      if (finish) for (const f of files) await api.mergeKeep(path, f.file, picks[f.file]);
      const r = await api.mergeEnd(path, finish);
      setNote(r.message);
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <div className="gbody single mg">
      <div className="mg-head">
        <span className="mg-dot" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <b className="block">
            {files.length} {files.length === 1 ? "file has" : "files have"} conflicts
          </b>
          <span className="mg-sub">
            Pick a side for each{state.stashed ? ". Your changes come back when you finish." : "."}
          </span>
        </span>
        <span className="mg-prog">
          {chosen}/{files.length}
        </span>
      </div>
      <div className="mg-list">
        {files.map((f) => (
          <div key={f.file} className="mg-file" data-done={!!picks[f.file]}>
            <div className="mg-fh">
              <Ic name="file" size={13} />
              <span className="mg-name" title={f.file}>
                <b>{f.file.split("/").pop()}</b>
                <span className="mono">{f.file.split("/").slice(0, -1).join("/")}</span>
              </span>
              <button
                type="button"
                className="btn ghost sm icon"
                aria-label={`Open ${f.file} in the editor`}
                onClick={() => onOpen(f.file)}
              >
                <Ic name="open" size={13} />
              </button>
            </div>
            <div className="mg-fh mg-fh2">
              <span className="cnt flex-1">
                {f.spots} {f.spots === 1 ? "conflict" : "conflicts"}
                {f.spots > 1 ? ", first shown" : ""}
              </span>
              <fieldset className="mg-seg" aria-label={`Keep for ${f.file}`}>
                {SIDES.map(([side, label]) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={picks[f.file] === side}
                    disabled={busy}
                    onClick={() => setPicks((p) => ({ ...p, [f.file]: side }))}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="mg-sides">
              <div data-on={picks[f.file] === "mine" || picks[f.file] === "both"}>
                <span className="mg-lbl">Yours</span>
                <pre className="mono">{f.mine || "(nothing)"}</pre>
              </div>
              <div data-on={picks[f.file] === "theirs" || picks[f.file] === "both"}>
                <span className="mg-lbl">Theirs</span>
                <pre className="mono">{f.theirs || "(nothing)"}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mg-foot">
        {note && <span className="cnt min-w-0 flex-1 truncate">{note}</span>}
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void end(false)}>
          Undo merge
        </button>
        <button
          type="button"
          className="btn primary sm"
          disabled={busy || chosen < files.length}
          onClick={() => void end(true)}
        >
          Finish merge
        </button>
      </div>
    </div>
  );
}
