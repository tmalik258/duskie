"use client";

// Part of setup-checklist: GROUP_TITLES, WATCH_EVERY_MS, WATCH_TIMES, useSetupStatus, mergeRows, SectionTitle, SetupItems, usePendingByTab.

import { useCallback, useEffect, useRef, useState } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";
import { SETUP_STATUS_CACHE_KEY, useCached } from "@/lib/cache";
import { stopWaiting, useDuskie } from "@/lib/store";
import type { SetupGroup, SetupItem } from "@/lib/types";
import { SETUP_CATALOG, skeletonItem } from "../setup-catalog";
import { SetupRow } from "../setup-checklist-row";

export const GROUP_TITLES: Record<SetupGroup, string> = {
  ai: "AI",
  connect: "Connections",
  tools: "Tools",
};

const WATCH_EVERY_MS = 6000;

const WATCH_TIMES = 20;

export function useSetupStatus() {
  const {
    data: status,
    refreshing: statusBusy,
    refresh,
    set,
  } = useCached(SETUP_STATUS_CACHE_KEY, api.setupStatus, undefined, true);
  const { refresh: refreshDetect } = useCached("setup-detect", api.setupDetect);
  // Covers the full Check-again round-trip (status + detect), not only one cache.
  const [recheck, setRecheck] = useState(false);
  const checking = status === null || statusBusy || recheck;
  const watch = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setRecheck(true);
    try {
      await Promise.all([refresh({ busy: true }), refreshDetect({ busy: true }).catch(() => undefined)]);
    } finally {
      setRecheck(false);
    }
  }, [refresh, refreshDetect]);

  /** Same as Check again, without the Checking… pulse (e.g. after a browser pairs). */
  const refreshQuiet = useCallback(async () => {
    await Promise.all([refresh(), refreshDetect().catch(() => undefined)]);
  }, [refresh, refreshDetect]);

  /** Checks again every few seconds for a while, after starting an install. */
  const watchForChanges = useCallback(() => {
    if (watch.current) clearInterval(watch.current);
    let left = WATCH_TIMES;
    watch.current = setInterval(() => {
      left -= 1;
      if (left <= 0 && watch.current) clearInterval(watch.current);
      void api
        .setupStatus()
        .then(set)
        .catch(() => undefined);
    }, WATCH_EVERY_MS);
  }, [set]);

  useEffect(
    () => () => {
      if (watch.current) clearInterval(watch.current);
    },
    [],
  );

  useEffect(() => {
    const off = listen(EVENTS.browsersChanged, () => {
      void api
        .setupStatus()
        .then(set)
        .catch(() => undefined);
    });
    return () => {
      void off.then((f) => f());
    };
  }, [set]);

  return { status, checking, check, refreshQuiet, watchForChanges };
}

/**
 * Rows in one fixed order: the catalog's, with live data in place of each
 * placeholder once it is known, then anything new from Rust at the end. So
 * rows never move or pop in when the data arrives.
 */
export function mergeRows(groups: SetupGroup[], live: SetupItem[] | undefined): SetupItem[] {
  const catalog = SETUP_CATALOG.filter((c) => groups.includes(c.group));
  if (!live) return catalog.map(skeletonItem);
  const byId = new Map(live.filter((i) => groups.includes(i.group)).map((i) => [i.id, i]));
  const rows: SetupItem[] = [];
  for (const c of catalog) {
    const item = byId.get(c.id);
    if (item) rows.push(item);
    byId.delete(c.id);
  }
  return [...rows, ...byId.values()];
}

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <h3 className="flex items-baseline gap-2 px-1 pt-2 text-[12px] font-semibold text-[rgb(235_235_245/0.62)]">
      {children}
      {hint && <span className="font-normal text-[rgb(235_235_245/0.45)]">{hint}</span>}
    </h3>
  );
}

/**
 * The setup steps for one thing, inside its own card (Claude Code's install,
 * hooks and tools in its AI card). Only what is left to do; nothing once done.
 */
export function SetupItems({ ids }: { ids: string[] }) {
  const { status, watchForChanges, check } = useSetupStatus();
  const [error, setError] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const justDone = useDuskie((s) => s.justDone);
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
  const done = useCallback(() => {
    void check();
    watchForChanges();
  }, [check, watchForChanges]);
  if (!status) return null;
  const rows = ids
    .map((id) => status.items.find((i) => i.id === id))
    .filter((i): i is SetupItem => Boolean(i && (!i.done || i.id === justDone)));
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 text-[13px]">
      {rows.map((item) => (
        <SetupRow
          key={item.id}
          item={item}
          onRun={run}
          guideOpen={openGuide === item.id}
          onToggleGuide={toggleGuide}
          inlineGuides
          onDone={done}
        />
      ))}
      {error && (
        <p role="alert" className="text-[12px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Recommended steps not done yet, by the Settings tab that has them. */
export function usePendingByTab(): Record<string, SetupItem[]> {
  const { status } = useSetupStatus();
  const out: Record<string, SetupItem[]> = {};
  for (const i of status?.items ?? []) {
    const tab = i.tab ?? (i.group === "ai" ? "ai" : null);
    if (i.done || !i.recommended || i.group === "tools" || !tab || tab === "home") continue;
    out[tab] = [...(out[tab] ?? []), i];
  }
  return out;
}
