// Windows Settings pages and switches that match what is typed:
// "turn on hotspot", "hotspot off", "open bluetooth settings".

import { api } from "@/lib/bridge";
import { runOpen, useDuskie } from "@/lib/store";
import type { Command } from "../Starters";
import { WINDOWS_PAGES } from "../windowsPages";

export function windowsCommands(q: string): Command[] {
  const want = /\b(on|enable|start)\b/.test(q) ? true : /\b(off|disable|stop)\b/.test(q) ? false : null;
  const wq = q
    .replace(/^(open\s+)?(windows\s+)?settings?\s*/, "")
    .replace(/\b(turn|switch|set|please|the|my|on|off|enable|disable|start|stop)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const pages = (
    wq.length >= 3 ? WINDOWS_PAGES.filter((p) => p.words.some((w) => w.startsWith(wq) || wq.startsWith(w))) : []
  ).slice(0, 2);
  return pages.flatMap((p) => {
    const open: Command = {
      id: `winset:${p.page}`,
      label: `${p.label} settings`,
      hint: "Windows Settings",
      icon: "settings",
      run: () =>
        void runOpen(async () => {
          await api.windowsSettingsOpen(p.page);
          return true;
        }, `Opened ${p.label} settings`),
    };
    const name = p.switch;
    if (!name) return [open];
    const flip = (on: boolean): Command => ({
      id: `switch:${name}:${on}`,
      label: `Turn ${p.label.replace(/^Do Not/, "do not")} ${on ? "on" : "off"}`,
      hint: "This PC",
      icon: "settings",
      stay: true,
      run: () => {
        const asked = `Turn ${p.label} ${on ? "on" : "off"}`;
        const say = (content: string, error?: string) =>
          useDuskie.setState((st) => ({
            turns: [...st.turns, { role: "user", content: asked }, { role: "assistant", content, error }],
          }));
        void api.pcSwitch(name, on).then(
          (done) => say(`${done}.`),
          (e: unknown) => say("", String(e)),
        );
      },
    });
    const flips = want === null ? [flip(true), flip(false)] : [flip(want)];
    return [...flips, open];
  });
}
