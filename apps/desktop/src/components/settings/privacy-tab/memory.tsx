"use client";

// Part of privacy-tab: Memory.

import { useState } from "react";
import { api } from "@/lib/bridge";
import { updateSettings, useDuskie } from "@/lib/store";
import { Button } from "../ui";

/** Facts about the user, given to every model, plus learned paths. */
export function Memory({ onError }: { onError: (e: string) => void }) {
  const memory = useDuskie((s) => s.settings.memory);
  const [draft, setDraft] = useState("");
  const [cleared, setCleared] = useState(false);
  const save = (next: string[]) => void updateSettings({ memory: next }).catch((e: unknown) => onError(String(e)));
  const add = () => {
    const v = draft.trim();
    if (v && !memory.includes(v)) save([...memory, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2 text-[13px]">
      {memory.length === 0 ? (
        <p className="text-(--muted)">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {memory.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">{m}</span>
              <Button small onClick={() => save(memory.filter((x) => x !== m))}>
                Forget
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="Something to remember"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Sign my emails as Ali"
          className="min-w-0 flex-1 rounded-lg border border-(--border) bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-(--accent)"
        />
        <Button small primary disabled={!draft.trim()} onClick={add}>
          Add
        </Button>
      </form>
      <div className="flex items-center gap-2 text-[12px] text-(--muted)">
        <span className="flex-1">Duskie also remembers which buttons worked in each app and site.</span>
        <Button
          small
          onClick={() =>
            void api
              .knowHowClear()
              .then(() => setCleared(true))
              .catch((e) => onError(String(e)))
          }
        >
          {cleared ? "Cleared" : "Clear"}
        </Button>
      </div>
    </div>
  );
}
