"use client";

// Dev only: every foundation piece on one page (tokens, springs, mascot
// states, the event wash). Open /dev/foundation/ in the browser to check them.

import { useState } from "react";
import { IslandWash } from "@/components/IslandWash";
import { SPRINGS, spring } from "@/lib/spring";
import { MASCOT_STATES, type MascotState } from "@/lib/types";

const TOKENS = ["--c1", "--c2", "--c3", "--c4", "--sage-ink", "--ok", "--warn", "--err", "--listen"] as const;

export default function FoundationPage() {
  const [mascot, setMascot] = useState<MascotState>("idle");
  const [donePill, setDonePill] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[var(--c1)] p-6 text-[var(--c2)]">
      <h1 className="mb-6 text-lg font-semibold">Foundation</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm text-[var(--ink-2)]">Tokens</h2>
        <div className="flex flex-wrap gap-3">
          {TOKENS.map((t) => (
            <div key={t} className="w-28">
              <div
                className="mb-1 h-12 rounded-[var(--r-md)] border border-[var(--line-2)]"
                style={{ background: `var(${t})` }}
              />
              <code className="text-xs text-[var(--ink-3)]">{t}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm text-[var(--ink-2)]">Springs</h2>
        <table className="text-sm">
          <tbody>
            {Object.entries(SPRINGS).map(([name, s]) => {
              const t = spring(s);
              return (
                <tr key={name}>
                  <td className="pr-6 py-1">{name}</td>
                  <td className="pr-6 py-1 text-[var(--ink-3)]">
                    response {s.response}s, damping {s.damping}
                  </td>
                  <td className="py-1 text-[var(--ink-3)]">
                    stiffness {t.stiffness}, damping {t.damping}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm text-[var(--ink-2)]">Mascot states</h2>
        <div className="flex flex-wrap gap-2">
          {MASCOT_STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setMascot(s)}
              aria-pressed={mascot === s}
              className="rounded-[var(--r-sm)] border border-[var(--line-2)] px-3 py-1.5 text-sm aria-pressed:bg-[var(--fill-3)]"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="relative mb-8 h-40 overflow-hidden rounded-[var(--r-lg)] border border-[var(--line-2)] bg-[var(--fill)]">
        <IslandWash simple={false} mascot={mascot} donePill={donePill} />
        <div className="relative z-10 flex h-full items-center justify-center text-sm text-[var(--ink-2)]">
          Wash shows on success or when a pill is set
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm text-[var(--ink-2)]">Event wash</h2>
        <button
          type="button"
          onClick={() => setDonePill(`Done ${Date.now()}`)}
          className="rounded-[var(--r-sm)] border border-[var(--line-2)] px-3 py-1.5 text-sm"
        >
          Fire a done event
        </button>
      </section>
    </main>
  );
}
