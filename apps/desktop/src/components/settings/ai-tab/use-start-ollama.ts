import { useState } from "react";
import { api } from "@/lib/bridge";

/** Start (or install) Ollama, wait for it to answer, then refresh the given lists. */
export function useStartOllama(opensApp: boolean | undefined, reloads: (() => Promise<unknown>)[]) {
  const [starting, setStarting] = useState<string | null>(null);
  const startOllama = async () => {
    setStarting(opensApp ? "Starting..." : "Installing...");
    try {
      await api.setupRun("ollama");
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const m = await api.localModels();
        if (m.reachable) break;
      }
    } catch {
      setStarting("Could not start it. Try again");
      return;
    }
    setStarting(null);
    for (const reload of reloads) void reload().catch(() => undefined);
  };
  return { starting, startOllama };
}
