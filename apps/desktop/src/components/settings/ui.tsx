"use client";

// Building blocks shared by the settings tabs. Sections hide themselves when
// the settings search does not match their title, hint or keywords.

/** "keepassxc.exe" reads as "Keepassxc", "1password.exe" as "1password". */
export function appName(exe: string): string {
  const base = exe
    .replace(/\.exe$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : exe;
}

export * from "./ui/folder-picker";
export * from "./ui/row";
export * from "./ui/select";
export * from "./ui/settings-query";
export * from "./ui/shortcut-recorder";
export * from "./ui/status-dot";
export * from "./ui/switch";
