"use client";

// One library of skills for Claude Code, Codex, Cursor and the local model.
// Skills are copied, never run. Skills with scripts are marked and left
// unticked, and a link or an update shows what would change before anything does.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { FoundSkill, LibrarySkill, LinkPreview } from "@/lib/types";
import { LibraryList } from "./skill-library/library-list";
import { LinkPreviewCard } from "./skill-library/link-preview";
import { ORIGIN, Pick, preselect, toggle } from "./skill-library/pick";
import { Button } from "./ui";

export function SkillLibrary({ onError }: { onError: (e: string) => void }) {
  const [found, setFound] = useState<FoundSkill[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [lib, setLib] = useState<LibrarySkill[]>([]);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [linkChosen, setLinkChosen] = useState<Set<string>>(new Set());
  const fail = useCallback((e: unknown) => onError(String(e)), [onError]);

  const review = useCallback(
    () =>
      api
        .libraryReview()
        .then((f) => {
          setFound(f);
          setChosen(preselect(f));
        })
        .catch(fail),
    [fail],
  );
  useEffect(() => {
    api.libraryList().then(setLib).catch(fail);
    void review();
  }, [fail, review]);

  const addFound = () =>
    api
      .libraryImport([...chosen])
      .then((l) => {
        setLib(l);
        return review();
      })
      .catch(fail);

  const fetchLink = (url: string) => {
    setBusy(true);
    api
      .libraryFetchUrl(url)
      .then((p) => {
        setPreview(p);
        setLinkChosen(preselect(p.skills, (s) => s.status !== "same"));
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const addLinked = () => {
    if (!preview) return;
    api
      .libraryInstallFetched(preview.url, preview.commit, [...linkChosen])
      .then((l) => {
        setLib(l);
        setPreview(null);
        setLink("");
      })
      .catch(fail);
  };

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
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim()) fetchLink(link.trim());
        }}
      >
        <input
          aria-label="GitHub link to a repo or skill folder"
          className="min-w-0 flex-1 rounded-md border border-(--border) bg-transparent px-2 py-1 text-[13px]"
          placeholder="Paste a GitHub link to a repo or skill folder"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Button small disabled={busy || !link.trim()} onClick={() => fetchLink(link.trim())}>
          {busy ? "Looking" : "Look at link"}
        </Button>
      </form>

      {preview && (
        <LinkPreviewCard
          preview={preview}
          chosen={linkChosen}
          onChosen={setLinkChosen}
          onAdd={addLinked}
          onCancel={() => setPreview(null)}
        />
      )}

      {found.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">
              <span className="font-medium">Not in the library yet</span>
              <span className="block text-[12px] text-(--muted)">
                From Claude Code, Codex, Cursor or plugins on this PC. Add them to manage where they sync.
              </span>
            </span>
            <Button small disabled={chosen.size === 0} onClick={() => void addFound()}>
              Add to library
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-(--border)">
            {found.map((f) => (
              <Pick
                key={f.name}
                name={f.name}
                description={f.description}
                badges={[ORIGIN[f.origin], ...(f.hasScripts ? ["Has scripts"] : [])]}
                checked={chosen.has(f.name)}
                onChange={(on) => setChosen((c) => toggle(c, f.name, on))}
              />
            ))}
          </ul>
        </div>
      )}

      {lib.length === 0 ? (
        found.length === 0 &&
        !preview && (
          <p className="text-[13px] text-(--muted)">
            Nothing in the library yet. Paste a GitHub link above, or install Claude Code, Codex or Cursor skills on
            this PC.
          </p>
        )
      ) : (
        <LibraryList lib={lib} busy={busy} note={note} onLib={setLib} onCheck={fetchLink} onSync={sync} fail={fail} />
      )}
    </div>
  );
}
