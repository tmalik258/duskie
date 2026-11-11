// A skill row with a tick box, its badges, and helpers for the ticked set.

import type { ReactNode } from "react";
import type { SkillOrigin, SkillTarget } from "@/lib/types";

export const ORIGIN: Record<SkillOrigin, string> = {
  claude: "Claude Code",
  claude_plugin: "Claude plugin",
  codex: "Codex",
  cursor: "Cursor",
  duskie: "Duskie",
  url: "Link",
};

export const TARGETS: [SkillTarget, string][] = [
  ["claude", "Claude Code"],
  ["codex", "Codex"],
  ["cursor", "Cursor"],
  ["local", "Local model"],
];

export function Badge({ children }: { children: string }) {
  return <span className="rounded-full border border-(--border) px-1.5 text-[11px] text-(--muted)">{children}</span>;
}

/** Ticked by default: everything without scripts. */
export function preselect<T extends { name: string; hasScripts: boolean }>(
  list: T[],
  keep: (t: T) => boolean = () => true,
) {
  return new Set(list.filter((s) => !s.hasScripts && keep(s)).map((s) => s.name));
}

export function Pick({
  name,
  description,
  badges,
  checked,
  onChange,
  children,
}: {
  name: string;
  description: string;
  badges: string[];
  checked: boolean;
  onChange: (on: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <li className="py-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={`Add ${name} to library`}
        />
        <span className="min-w-0 text-[13px]">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {name}
            {badges.map((b) => (
              <Badge key={b}>{b}</Badge>
            ))}
          </span>
          <span className="block truncate text-[12px] text-(--muted)">{description}</span>
          {children}
        </span>
      </label>
    </li>
  );
}

export function toggle(set: Set<string>, name: string, on: boolean) {
  const next = new Set(set);
  if (on) next.add(name);
  else next.delete(name);
  return next;
}
