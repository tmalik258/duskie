// A provider's line: status dot, name and hint, then its switch or what it needs.

import { type AiProviderId, PROVIDER_LABELS } from "@/lib/types";
import { StatusDot, Switch } from "../ui";
import { NOT_READY, PROVIDER_HINTS } from "./not-ready";

export function ProviderHead({
  id,
  index,
  checking,
  ok,
  outOfUsage,
  enabled,
  onEnabled,
}: {
  id: AiProviderId;
  index: number;
  checking: boolean;
  ok: boolean;
  outOfUsage: boolean;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
}) {
  return (
    <>
      <StatusDot state={checking ? "checking" : ok ? "ok" : "off"} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">
          {index + 1}. {PROVIDER_LABELS[id]}
        </p>
        <p className="text-[12px] text-(--muted)">{PROVIDER_HINTS[id]}</p>
      </div>
      {!checking && !ok ? (
        // Nothing to switch on yet: the step below sets it up.
        <span className="shrink-0 text-[12.5px] text-(--muted)">{outOfUsage ? "Out of usage" : NOT_READY[id]}</span>
      ) : checking ? (
        <span className="shrink-0 text-[12.5px] text-(--muted)">Checking...</span>
      ) : (
        <Switch checked={enabled} onChange={onEnabled} label={PROVIDER_LABELS[id]} />
      )}
    </>
  );
}
