// What a pasted link would add: each skill, whether it is new or an update,
// its size and any scripts, before anything is copied.

import type { LinkPreview } from "@/lib/types";
import { Button } from "../ui";
import { Pick, toggle } from "./pick";

export function LinkPreviewCard(p: {
  preview: LinkPreview;
  chosen: Set<string>;
  onChosen: (f: (c: Set<string>) => Set<string>) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-(--border) p-3">
      <span className="text-[13px]">
        At commit <span className="font-mono">{p.preview.commit.slice(0, 7)}</span>. Nothing runs when you add.
      </span>
      <ul className="flex flex-col divide-y divide-(--border)">
        {p.preview.skills.map((s) => (
          <Pick
            key={s.name}
            name={s.name}
            description={s.description}
            badges={[
              s.status === "new" ? "New" : s.status === "changed" ? "Update" : "Same as yours",
              `${s.files} file${s.files === 1 ? "" : "s"}, ${Math.max(1, Math.round(s.bytes / 1024))} KB`,
              ...(s.hasScripts ? ["Has scripts"] : []),
            ]}
            checked={p.chosen.has(s.name)}
            onChange={(on) => p.onChosen((c) => toggle(c, s.name, on))}
          >
            {s.diff.length > 0 && (
              <span className="mt-1 block font-mono text-[11px] text-(--muted)">{s.diff.join(", ")}</span>
            )}
          </Pick>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button small primary disabled={p.chosen.size === 0} onClick={p.onAdd}>
          Add to library
        </Button>
        <Button small onClick={p.onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
