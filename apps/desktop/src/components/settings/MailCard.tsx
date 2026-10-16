"use client";

// Settings > Notifications: connect Gmail so new mail arrives straight from
// the account. Duskie reads who a message is from and a few yes or no
// answers about it. It never keeps or logs the text.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import type { MailStatus } from "@/lib/types";
import { Button, Field } from "./ui";

const LABEL: Record<MailStatus["state"], string> = {
  disconnected: "Not connected",
  connected: "Connected",
  offline: "Offline, will retry",
  auth_expired: "Sign in again",
};

export function MailCard({ onError }: { onError: (e: string) => void }) {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.mailStatus().then(setStatus);
    // Keep the label honest while Settings is open.
    const timer = setInterval(() => void api.mailStatus().then(setStatus), 15000);
    return () => clearInterval(timer);
  }, []);

  const run = (call: () => Promise<MailStatus>) => {
    setBusy(true);
    call()
      .then(setStatus)
      .catch((e) => onError(String(e)))
      .finally(() => setBusy(false));
  };

  if (!status) return null;
  const connected = status.state !== "disconnected";
  return (
    <Field
      label="Gmail"
      hint={
        status.configured
          ? "Reads who an email is from, never its text. Skips mail you already read elsewhere."
          : "Google sign-in is not set up in this build yet."
      }
    >
      <span className="text-[12px] text-(--muted)" role="status">
        {LABEL[status.state]}
      </span>
      {connected && status.state !== "auth_expired" ? (
        <Button small disabled={busy} onClick={() => run(api.mailDisconnect)}>
          Disconnect
        </Button>
      ) : (
        <Button small disabled={busy || !status.configured} onClick={() => run(api.mailConnect)}>
          {busy ? "Waiting for Google" : status.state === "auth_expired" ? "Sign in again" : "Connect Gmail"}
        </Button>
      )}
    </Field>
  );
}
