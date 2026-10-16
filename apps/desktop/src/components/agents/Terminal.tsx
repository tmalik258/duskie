"use client";

// A terminal under the editor, started in the project folder. xterm loads
// only when the panel opens, and the shell closes with it.

import { useEffect, useRef } from "react";
import { api, EVENTS, listen } from "@/lib/bridge";

export function Terminal({ root }: { root: string }) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    let gone = false;
    let id: number | null = null;
    const cleanup: (() => void)[] = [];
    void (async () => {
      const [{ Terminal: Xterm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/xterm/css/xterm.css"),
      ]);
      if (gone || !host.current) return;
      const term = new Xterm({
        fontSize: 12,
        fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace',
        theme: { background: "#141418" },
        cursorBlink: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host.current);
      fit.fit();
      cleanup.push(() => term.dispose());
      const un = await listen(EVENTS.termData, (p) => {
        if (p.id !== id) return;
        if (p.data) term.write(p.data);
        if (p.done) term.write("\r\n[closed]\r\n");
      });
      cleanup.push(un);
      id = await api.termOpen(root, term.cols, term.rows);
      if (gone) {
        void api.termClose(id);
        return;
      }
      const input = term.onData((d) => id !== null && void api.termWrite(id, d).catch(() => {}));
      cleanup.push(() => input.dispose());
      const ro = new ResizeObserver(() => {
        fit.fit();
        if (id !== null) void api.termResize(id, term.cols, term.rows).catch(() => {});
      });
      ro.observe(host.current);
      cleanup.push(() => ro.disconnect());
      term.focus();
    })();
    return () => {
      gone = true;
      if (id !== null) void api.termClose(id);
      for (const c of cleanup.reverse()) c();
    };
  }, [root]);
  return <section ref={host} className="ed-term" aria-label="Terminal" />;
}
