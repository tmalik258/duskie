"use client";

// Part of home-tab: DAY_SUMMARY_SKILL, SOUND_KITS, END_OF_DAY, HomePart, TAB_NAMES, DaySummaryToggle, LeftElsewhere, CodeFolders, CLONE_INPUT, CloneRules, KitStatus.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { useCached } from "@/lib/cache";
import { checkKit, SYNTH_KIT } from "@/lib/sound/snd-sound";
import type { Folder, Found, SkillInfo } from "@/lib/types";
import { usePendingByTab } from "../../setup-checklist/group-titles";
import { Tip } from "../../tip";
import { Field, FolderPicker, Toggle } from "../ui";

const DAY_SUMMARY_SKILL = "system.day-summary";

export const SOUND_KITS: [string, string][] = [
  [SYNTH_KIT, "Duskie"],
  ["01", "Classic"],
];

export const END_OF_DAY: [string, string][] = [16, 17, 18, 19, 20, 21, 22].map((h) => [
  String(h),
  `${h > 12 ? h - 12 : h} pm`,
]);

export type HomePart = "general" | "sounds" | "notifications" | "code" | "updates" | "setup";

const TAB_NAMES: Record<string, string> = { ai: "AI", connections: "Apps", privacy: "Privacy" };

/** Standup / timesheet card after the day ends. On (Ask) by default. */
export function DaySummaryToggle({ onError }: { onError: (e: string) => void }) {
  const [skill, setSkill] = useState<SkillInfo | null>(null);
  useEffect(() => {
    void api
      .skillsList()
      .then((list) => setSkill(list.find((s) => s.id === DAY_SUMMARY_SKILL) ?? null))
      .catch((e: unknown) => onError(String(e)));
  }, [onError]);
  if (!skill) return null;
  return (
    <Toggle
      label="End of day summary"
      hint="Standup / timesheet card after your day ends. Asks before showing."
      checked={skill.enabled}
      onChange={(enabled) => {
        setSkill({ ...skill, enabled });
        void api.skillSet(DAY_SUMMARY_SKILL, enabled, false).catch((e: unknown) => {
          onError(String(e));
          setSkill({ ...skill, enabled: skill.enabled });
        });
      }}
    />
  );
}

/** Steps left on other tabs, as one tap each, so Home never repeats them. */
export function LeftElsewhere({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const pending = usePendingByTab();
  const tabs = Object.keys(TAB_NAMES).filter((t) => pending[t]?.length);
  if (tabs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
      <span className="text-(--muted)">Also to set up:</span>
      {tabs.map((t) => (
        <Tip key={t} label={pending[t].map((i) => i.title).join(", ")}>
          <button
            type="button"
            onClick={() => onOpenTab(t)}
            className="chip rounded-full bg-(--surface) px-2.5 py-1 font-medium text-(--text) hover:bg-(--hover)"
          >
            {TAB_NAMES[t]} ({pending[t].length})
          </button>
        </Tip>
      ))}
    </div>
  );
}

export function CodeFolders({ chosen, onChange }: { chosen: string[]; onChange: (next: string[]) => void }) {
  const { data } = useCached<Found>("setup-detect", api.setupDetect);
  const found: Folder[] = data?.codeFolders ?? [];
  return (
    <>
      {chosen.length === 0 && found.length > 0 && (
        <p className="text-[12px] text-(--muted)">None picked, so Duskie looks in all the ones it found.</p>
      )}
      <FolderPicker
        found={found}
        chosen={chosen}
        onChange={onChange}
        empty={data ? "No git repos found in the usual places. Add the folder that holds your projects." : ""}
      />
    </>
  );
}

/** Same chrome as TextField, live value so Add does not race blur. */
const CLONE_INPUT =
  "min-w-0 rounded-md border border-(--border) bg-transparent px-2 py-1 text-[13px] outline-none placeholder:text-(--muted) focus:border-(--accent)";

/** Where clones go by owner: learned from your clones, editable here. */
export function CloneRules({
  rules,
  onChange,
}: {
  rules: Record<string, string>;
  onChange: (r: Record<string, string>) => void;
}) {
  const [owner, setOwner] = useState("");
  const [folder, setFolder] = useState("");
  const entries = Object.entries(rules);
  const add = () => {
    if (!owner.trim() || !folder.trim()) return;
    onChange({ ...rules, [owner.trim()]: folder.trim() });
    setOwner("");
    setFolder("");
  };
  return (
    <Field
      label="Where clones go"
      hint="Copy a repo link and Duskie offers to clone it here. Learned from where you clone."
      stack
    >
      <div className="flex flex-col gap-1.5">
        {entries.map(([o, f]) => (
          <div key={o} className="flex items-center gap-2 text-[13px]">
            <span className="mono min-w-0 flex-1 truncate">
              {o} goes to {f}
            </span>
            <button
              type="button"
              className="chip"
              onClick={() => {
                const next = { ...rules };
                delete next[o];
                onChange(next);
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex min-w-0 items-center gap-2">
          <input
            className={`${CLONE_INPUT} flex-1`}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner, e.g. acme"
            aria-label="Owner"
            spellCheck={false}
          />
          <input
            className={`${CLONE_INPUT} flex-[2]`}
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Folder, e.g. D:\\Acme"
            aria-label="Folder"
            spellCheck={false}
          />
          <button type="button" className="chip shrink-0" onClick={add}>
            Add
          </button>
        </div>
      </div>
    </Field>
  );
}

export function KitStatus({ kit }: { kit: string }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void checkKit(kit).then((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [kit]);
  if (!error) return null;
  return (
    <p role="alert" className="text-[12px] text-red-500">
      This kit could not load, so a fallback tone plays instead: {error}
    </p>
  );
}
