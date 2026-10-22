// Apps that match what is typed, with a private window row for each browser.

import { api } from "@/lib/bridge";
import { runOpen } from "@/lib/store";
import type { InstantResults } from "@/lib/types";
import type { Item } from "./item";

/** Start-menu private browsing shortcuts (Zen ships one; we synthesize the rest). */
function isPrivateAppName(name: string): boolean {
  return /\b(private|incognito|inprivate)\b/i.test(name);
}

/** Label for a synthesized private browser row. */
function privateBrowserLabel(browser: string): string {
  switch (browser) {
    case "edge":
      return "Edge InPrivate";
    case "firefox":
      return "Firefox Private";
    case "zen":
      return "Zen Private";
    case "brave":
      return "Brave Incognito";
    case "samsung":
      return "Samsung Internet Private";
    default:
      return "Chrome Incognito";
  }
}

/** Browsers get a separate private/incognito row (like Zen's Start-menu
 * "Private Browsing"), not a Ctrl Enter shortcut on the main app. */
export function appItems(apps: InstantResults["apps"]): Item[] {
  const items: Item[] = [];
  const privateBrowsers = new Set(
    apps.filter((a) => a.browser && isPrivateAppName(a.name)).map((a) => a.browser as string),
  );
  for (const a of apps) {
    const browser = a.browser ?? null;
    const privateNamed = !!(browser && isPrivateAppName(a.name));
    items.push({
      id: `app:${a.id}`,
      group: items.length === 0 ? "Apps" : undefined,
      icon: <span className="text-[11px] font-bold text-white">{a.name.slice(0, 1).toUpperCase()}</span>,
      label: a.name,
      hint: a.minutes >= 60 ? `${Math.round(a.minutes / 60)} h this week` : undefined,
      run: () =>
        void runOpen(async () => {
          await api.appLaunch(a.id, privateNamed && browser ? { private: true, browser } : undefined);
          return true;
        }, `Opened ${a.name}`),
      keepText: true,
    });
    if (browser && !privateNamed && !privateBrowsers.has(browser)) {
      privateBrowsers.add(browser);
      const label = privateBrowserLabel(browser);
      items.push({
        id: `app-private:${browser}`,
        icon: <span className="text-[11px] font-bold text-white">{label.slice(0, 1).toUpperCase()}</span>,
        label,
        hint: "Private window",
        run: () =>
          void runOpen(async () => {
            await api.appLaunch(a.id, { private: true, browser });
            return true;
          }, `Opened ${label}`),
        keepText: true,
      });
    }
  }
  return items;
}
