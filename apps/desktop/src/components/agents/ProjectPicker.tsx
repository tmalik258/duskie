"use client";

import { useState } from "react";
import { api } from "@/lib/bridge";
import { Select } from "../settings/ui";

/** Repo folder plus its two parents, so same-named projects stay distinct. */
export function projectPlace(path: string): string {
  const home = path
    .replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+/, "~")
    .replace(/^\/Users\/[^/]+/, "~")
    .replace(/^\/home\/[^/]+/, "~");
  const parts = home.split(/[\\/]+/).filter(Boolean);
  return (parts.length <= 3 ? parts : parts.slice(-3)).join("\\");
}

export function folderName(path: string): string {
  return (
    path
      .split(/[\\/]+/)
      .filter(Boolean)
      .at(-1) ?? path
  );
}

export function ProjectPicker({
  projects,
  path,
  onChange,
  menuWidth = 340,
}: {
  projects: { name: string; path: string }[];
  path: string;
  onChange: (path: string) => void;
  menuWidth?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const list = projects;
  const choose = async (next: string) => {
    setError(null);
    if (next) {
      onChange(next);
      return;
    }
    if (picking) return;
    setPicking(true);
    try {
      const folder = await api.projectPickFolder();
      if (folder) onChange(folder);
    } catch (e) {
      setError(String(e));
    } finally {
      setPicking(false);
    }
  };
  return (
    <span data-project-picker>
      <Select
        variant="plain"
        overlay
        searchable
        menuWidth={menuWidth}
        label="Project"
        value={path}
        current={picking ? "Choosing folder..." : !path ? "Select folder" : !list.some((p) => p.path === path) ? folderName(path) : undefined}
        onChange={(next) => void choose(next)}
        group="Project"
        options={[
          ...list.map((p) => ({ value: p.path, label: p.name, sub: projectPlace(p.path), title: p.path })),
          {
            value: "",
            label: "Choose another folder...",
            sub: "Browse this PC",
            sepBefore: list.length > 0,
            alwaysVisible: true,
          },
        ]}
      />
      {error && (
        <span className="ak-err" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
