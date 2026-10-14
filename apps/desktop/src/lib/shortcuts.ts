/** Key combo for display / parse; strips a leading Off marker (`-`). */
export function shortcutBinding(value: string): string {
  const t = value.trim();
  return t.startsWith("-") ? t.slice(1).trim() : t;
}

/** True when the shortcut is registered (has keys and is not Off). */
export function shortcutEnabled(value: string): boolean {
  const t = value.trim();
  return t.length > 0 && !t.startsWith("-");
}
