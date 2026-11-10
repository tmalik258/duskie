"use client";

// Part of settings-panel: SETTINGS_TABS, SettingsTab, GROUPS, MOVED, tabFor, REMEMBER_MS.

import type { IcName } from "../icon";

export const SETTINGS_TABS = [
  { id: "home", label: "Home" },
  { id: "appearance", label: "Appearance" },
  { id: "ai", label: "AI" },
  { id: "connections", label: "Apps" },
  { id: "memory", label: "Memory" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "storage", label: "Storage" },
  { id: "privacy", label: "Privacy" },
  { id: "skills", label: "Skills" },
  { id: "sounds", label: "Sounds" },
  { id: "notifications", label: "Notifications" },
  { id: "voice", label: "Voice" },
  { id: "code", label: "Code and Git" },
  { id: "updates", label: "Updates" },
  { id: "setup", label: "Setup" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

/** Design layout: the sections grouped in a sidebar, with a short line on each. */
export const GROUPS: { label: string; items: { id: SettingsTab; label: string; icon: IcName; blurb: string }[] }[] = [
  {
    label: "Duskie",
    items: [
      {
        id: "home",
        label: "General",
        icon: "home",
        blurb: "How Duskie starts, how your day is shaped, and when it stays quiet.",
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: "palette",
        blurb: "The look of Duskie, the island and the wash behind it.",
      },
      { id: "sounds", label: "Sounds", icon: "bell", blurb: "Soft cues for what happens, and how loud." },
      {
        id: "notifications",
        label: "Notifications",
        icon: "spark",
        blurb: "Windows stays quiet. Only what matters comes up on the island.",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { id: "ai", label: "AI models", icon: "cpu", blurb: "Which brain answers, and which one writes code." },
      { id: "voice", label: "Voice", icon: "mic", blurb: "Runs on this PC. Audio is never saved or sent." },
      { id: "memory", label: "Memory", icon: "brain", blurb: "What Duskie knows about you. All of it is editable." },
      {
        id: "skills",
        label: "Skills",
        icon: "bolt",
        blurb: "What Duskie offers, and what it now does on its own.",
      },
    ],
  },
  {
    label: "Connections",
    items: [
      { id: "connections", label: "Apps", icon: "plug", blurb: "Accounts Duskie can read from and act in." },
      {
        id: "code",
        label: "Code and Git",
        icon: "branch",
        blurb: "Where your projects live, and the editor they open in.",
      },
    ],
  },
  {
    label: "System",
    items: [
      { id: "shortcuts", label: "Shortcuts", icon: "key", blurb: "Click a shortcut, then press the new keys." },
      { id: "privacy", label: "Privacy", icon: "shield", blurb: "What Duskie notices, and what it never looks at." },
      { id: "storage", label: "Storage", icon: "disk", blurb: "What takes space on this PC." },
      { id: "updates", label: "Updates", icon: "update", blurb: "New versions, and what this one is." },
      { id: "setup", label: "Setup", icon: "check", blurb: "Tools that make Duskie better, one click each." },
    ],
  },
];

/** Old tab ids (links from setup items and older builds) to the new ones. */
const MOVED: Record<string, SettingsTab> = {
  general: "home",
  today: "home",
  about: "home",
  browser: "connections",
  apps: "connections",
  calendar: "connections",
  search: "privacy",
  sensors: "privacy",
};

export function tabFor(id: string | undefined): SettingsTab | null {
  if (!id) return null;
  if (SETTINGS_TABS.some((t) => t.id === id)) return id as SettingsTab;
  return MOVED[id] ?? null;
}

/** How long Settings reopens where it was left (tab and scroll). */
export const REMEMBER_MS = 60_000;
