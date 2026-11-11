"use client";

// Setup checklist: what is installed, connected and configured, with the
// exact command for each missing piece. Used by the welcome steps and the
// Setup tab in Settings. Every check runs again on "Check again", and for a
// couple of minutes after a Run so a finished install turns green.
// In welcome, items expand their one-click how-to here so onboarding never
// dumps the user into Settings mid-flow.
// Rows paint at once: the last known status (cached), or the catalog's
// placeholders on the very first run. Refreshing keeps every row on screen.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { stopWaiting, useDuskie } from "@/lib/store";
import type { SetupGroup, SetupItem } from "@/lib/types";
import { ActivityProgress } from "./activity-progress";
import { BrowserInstallPanel } from "./setup-browser";
import { GROUP_TITLES, mergeRows, SectionTitle, useSetupStatus } from "./setup-checklist/group-titles";
import { SetupRow, SetupSpinner, SetupStatusMark, SmallButton } from "./setup-checklist-row";
import { ComposioAppsRow } from "./welcome/composio-apps-row";

export function SetupChecklist({
  groups,
  onOpenTab,
  /** Keep how-to inside the checklist (welcome) instead of jumping to a Settings tab. */
  inlineGuides,
}: {
  groups: SetupGroup[];
  onOpenTab?: (tab: string) => void;
  inlineGuides?: boolean;
}) {
  const { status, checking, check, refreshQuiet, watchForChanges } = useSetupStatus();
  const [error, setError] = useState<string | null>(null);
  // Coming back from a step finished elsewhere: make sure its row shows.
  const justDone = useDuskie((s) => s.justDone);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!inlineGuides) return;
    void refreshQuiet().catch(() => undefined);
  }, [inlineGuides, refreshQuiet]);

  // Stable callbacks, so a row only re-renders when its own data changes.
  const run = useCallback(
    (id: string) => {
      setError(null);
      api
        .setupRun(id)
        .then(watchForChanges)
        .catch((e) => {
          stopWaiting();
          setError(String(e));
        });
    },
    [watchForChanges],
  );
  const toggleGuide = useCallback((id: string) => setOpenGuide((open) => (open === id ? null : id)), []);
  // Quiet: one-click finishes (hooks, browser pair) must not pulse Checking….
  const done = useCallback(() => {
    void refreshQuiet();
    watchForChanges();
  }, [refreshQuiet, watchForChanges]);

  const items = mergeRows(groups, status?.items);
  const recommended = items.filter((i) => i.recommended);
  const doneCount = recommended.filter((i) => i.done).length;
  // Finished steps fold into one line, so the list is what is left to do.
  // The welcome's Composio row stays open once connected: its apps are there.
  // Browser and Composio stay open when done so you can pair another browser
  // or connect more apps without digging into the folded "ready" line.
  const stays = (i: SetupItem) =>
    !i.done ||
    i.id === justDone ||
    (i.id === "composio" && (justDone?.startsWith("app:") ?? false)) ||
    showDone ||
    (inlineGuides === true && (i.id === "composio" || i.id === "browser"));
  const row = (item: SetupItem) => (
    <SetupRow
      key={item.id}
      item={item}
      checking={checking}
      onRun={run}
      guideOpen={openGuide === item.id}
      onToggleGuide={toggleGuide}
      onOpenTab={onOpenTab}
      inlineGuides={inlineGuides}
      onDone={done}
    >
      {inlineGuides && item.id === "composio" && item.done && <ComposioAppsRow />}
      {inlineGuides && item.id === "browser" && item.done && <BrowserInstallPanel onDone={done} />}
    </SetupRow>
  );

  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <ActivityProgress sources={["setup", "voice"]} />
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[12px] text-[rgb(235_235_245/0.6)]">
          {status === null
            ? "\u00a0"
            : recommended.length > 0 && doneCount === recommended.length
              ? "Everything recommended is set up."
              : `${doneCount} of ${recommended.length} recommended steps done.`}
        </p>
        <SmallButton
          onClick={() => {
            void check();
            watchForChanges();
          }}
          disabled={checking}
        >
          {checking ? (
            <>
              <SetupSpinner />
              Checking…
            </>
          ) : (
            "Check again"
          )}
        </SmallButton>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-[12px] text-red-200">
          {error}
        </p>
      )}

      {groups.includes("tools") && status?.installAll && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-[#0a84ff]/15 px-3.5 py-2.5 ring-1 ring-inset ring-[#0a84ff]/40">
          <div className="flex items-center gap-2">
            <p className="flex-1 font-medium text-white">Install everything recommended</p>
            <SmallButton
              onClick={() => {
                void navigator.clipboard.writeText(status.installAll ?? "").catch(() => undefined);
              }}
            >
              Copy command
            </SmallButton>
            <SmallButton primary onClick={() => run("all")}>
              Install all
            </SmallButton>
          </div>
        </div>
      )}

      {groups.map((g) => {
        const inGroup = items.filter((i) => i.group === g);
        if (inGroup.length === 0) return null;
        const ready = inGroup.filter((i) => !stays(i));
        const main = inGroup.filter((i) => i.recommended && stays(i));
        const extra = inGroup.filter((i) => !i.recommended && stays(i));
        return (
          <section key={g} className="flex flex-col gap-1.5">
            {groups.length > 1 && <SectionTitle>{GROUP_TITLES[g]}</SectionTitle>}
            {main.map(row)}
            {ready.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDone(true)}
                disabled={checking}
                className="chip flex items-center gap-2 rounded-2xl px-3.5 py-2 text-left text-[12px] text-[rgb(235_235_245/0.6)] hover:bg-white/[0.04] hover:text-white disabled:opacity-80"
              >
                <SetupStatusMark checking={checking} done />
                <span className="min-w-0 flex-1 truncate">
                  {ready.map((i) => i.title).join(", ")} {ready.length === 1 ? "is" : "are"} ready
                </span>
              </button>
            )}
            {extra.length > 0 && (
              <>
                <SectionTitle hint="Nice to have. Skip any of these.">Optional</SectionTitle>
                {extra.map(row)}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
