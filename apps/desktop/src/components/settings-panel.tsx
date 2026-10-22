"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/friendly";
import { useScrollEdge } from "@/lib/hooks";
import { useDuskie } from "@/lib/store";
import { Ic } from "./icon";
import { AiTab } from "./settings/ai-tab";
import { AppearanceTab } from "./settings/appearance-tab";
import { ConnectionsTab } from "./settings/connections-tab";
import { HomeTab } from "./settings/home-tab";
import { MemoryTab } from "./settings/memory-tab";
import { PrivacyTab } from "./settings/privacy-tab";
import { ShortcutsTab } from "./settings/shortcuts-tab";
import { SkillsTab } from "./settings/skills-tab";
import { StorageTab } from "./settings/storage-tab";
import { SettingsQuery } from "./settings/ui";
import { GROUPS, REMEMBER_MS, type SettingsTab, tabFor } from "./settings-panel/settings-tabs";

/** Where Settings was when it last closed. Lives outside the component,
 * which unmounts when the island closes. */
let leftAt: { tab: SettingsTab; scroll: number; at: number } | null = null;

function recent() {
  return leftAt && Date.now() - leftAt.at < REMEMBER_MS ? leftAt : null;
}

/** Settings, shown inside the island: tabs and a search over all of them. */
export function SettingsPanel() {
  const ready = useDuskie((s) => s.ready);
  const [tab, setTab] = useState<SettingsTab>(() => recent()?.tab ?? "home");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const edges = useScrollEdge();
  const scrollerRef = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      edges(el);
    },
    [edges],
  );
  const tabRef = useRef(tab);
  tabRef.current = tab;
  // Kept as it scrolls: the element is already gone when unmounting.
  const scrolled = useRef(0);
  const wantedTab = useDuskie((s) => s.ask?.settingsTab);
  // A new tab starts at its top.
  const pick = useCallback((t: SettingsTab) => {
    setTab(t);
    scroller.current?.scrollTo({ top: 0 });
  }, []);

  // Focus search once the panel is ready to type into.
  useEffect(() => {
    if (!ready) return;
    searchRef.current?.focus({ preventScroll: true });
  }, [ready]);

  // Opened at a given tab (back from connecting an app): that tab, at its top.
  useEffect(() => {
    const t = tabFor(wantedTab);
    if (t) pick(t);
  }, [wantedTab, pick]);

  // Reopened within a minute: back to the same spot. The tab's content
  // loads in pieces, so keep trying for a moment until it is tall enough.
  useLayoutEffect(() => {
    if (!ready) return;
    const back = recent();
    if (!back || back.tab !== tabRef.current || back.scroll <= 0) return;
    let frames = 0;
    let raf = 0;
    const restore = () => {
      const el = scroller.current;
      if (!el) return;
      el.scrollTop = back.scroll;
      if (Math.abs(el.scrollTop - back.scroll) > 2 && frames++ < 60) raf = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // Remember where it was on close.
  useEffect(
    () => () => {
      leftAt = { tab: tabRef.current, scroll: scrolled.current, at: Date.now() };
    },
    [],
  );
  const [error, setError] = useState<string | null>(null);
  // Errors read as what to do next, not raw messages.
  const report = useCallback((e: string) => setError(friendlyError(e)), []);
  const open = useCallback(
    (id: string) => {
      const t = tabFor(id);
      if (t) {
        setQuery("");
        pick(t);
      }
    },
    [pick],
  );

  if (!ready) return null;
  const searching = query.trim() !== "";
  const show = (id: SettingsTab) => searching || tab === id;

  const body = (
    <SettingsQuery.Provider value={query.trim()}>
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          scrolled.current = e.currentTarget.scrollTop;
        }}
        className="settings-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-0.5 pb-3"
      >
        {searching ? (
          <HomeTab onError={report} onOpenTab={open} />
        ) : (
          (["home", "sounds", "notifications", "code", "updates", "setup"] as const).includes(tab as "home") && (
            <HomeTab
              onError={report}
              onOpenTab={open}
              part={tab === "home" ? "general" : (tab as "sounds" | "notifications" | "code" | "updates" | "setup")}
            />
          )
        )}
        {show("appearance") && <AppearanceTab onError={report} />}
        {(searching || tab === "ai" || tab === "voice") && (
          <AiTab onError={report} part={searching ? undefined : tab === "voice" ? "voice" : "models"} />
        )}
        {(show("connections") || (!searching && tab === "code")) && (
          <ConnectionsTab onError={report} part={searching ? undefined : tab === "code" ? "code" : "apps"} />
        )}
        {show("privacy") && <PrivacyTab onError={report} />}
        {show("memory") && <MemoryTab onError={report} />}
        {show("shortcuts") && <ShortcutsTab onError={report} />}
        {show("storage") && <StorageTab onError={report} />}
        {show("skills") && <SkillsTab onError={report} />}
      </div>
    </SettingsQuery.Provider>
  );
  const alert = error && (
    <p
      role="alert"
      className="mb-2 flex shrink-0 items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      <span className="min-w-0 break-words">{error}</span>
      <button type="button" onClick={() => setError(null)} aria-label="Hide" className="shrink-0 opacity-70">
        ×
      </button>
    </p>
  );

  const current = GROUPS.flatMap((g) => g.items).find((i) => i.id === tab);
  return (
    <div className="island-settings st-split flex min-h-0 flex-1 overflow-hidden">
      <nav aria-label="Settings sections" className="st-side">
        <label className="st-search shrink-0">
          <Ic name="search" size={14} />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            spellCheck={false}
          />
          <kbd>/</kbd>
        </label>
        <div className="st-side-links">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col">
              <p className="st-group">{g.label}</p>
              {g.items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="st-item"
                  aria-current={!searching && tab === i.id ? "page" : undefined}
                  onMouseDown={(e) => {
                    // Keep the nav from scrolling when the last item is focused.
                    // Focus moved by script from the search box would show
                    // the keyboard ring, so the click is marked as a click.
                    e.preventDefault();
                    (document.activeElement as HTMLElement | null)?.blur();
                    e.currentTarget.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
                  }}
                  onClick={() => {
                    setQuery("");
                    pick(i.id);
                  }}
                >
                  <span className="inline-flex shrink-0">
                    <Ic name={i.icon} size={15} />
                  </span>
                  <span className="truncate">{i.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 pb-3">
          <p className="st-title">{searching ? "Search" : current?.label}</p>
          <p className="st-blurb">{searching ? `Settings matching "${query.trim()}"` : current?.blurb}</p>
        </div>
        {alert}
        {body}
      </div>
    </div>
  );
}
