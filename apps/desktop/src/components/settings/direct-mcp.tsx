"use client";

// Apps connected directly over MCP: a program on this PC, or an https
// address. Used before Composio for the same app. A program is arbitrary
// code, so it runs only after the exact command was shown and confirmed;
// variable values go to the keychain; writes stay off tool by tool.

import { useState } from "react";
import { api } from "@/lib/bridge";
import { useDuskie } from "@/lib/store";
import { INPUT, parseEnv, Row } from "./direct-mcp/input";
import { Button, Field, Section, Select } from "./ui";

export function DirectMcpCard({ onError }: { onError: (e: string) => void }) {
  const servers = useDuskie((s) => s.settings.directServers ?? []);
  const [app, setApp] = useState("");
  const [kind, setKind] = useState<"stdio" | "url">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [env, setEnv] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await api.serversSave(
        {
          id: "",
          app: app.trim(),
          kind,
          command: command.trim(),
          args: args.split(/\s+/).filter(Boolean),
          envNames: [],
          url: url.trim(),
          confirmed: false,
          writesAllowed: [],
        },
        parseEnv(env),
      );
      setApp("");
      setCommand("");
      setArgs("");
      setUrl("");
      setEnv("");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Direct (MCP)"
      hint="A program on this PC or an https address that speaks MCP. Used before Composio for the same app."
      keywords="mcp direct stdio server connect tools apps url"
    >
      {servers.length === 0 ? (
        <p className="text-[13px] text-(--muted)">No direct servers yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {servers.map((s) => (
            <Row key={s.id} s={s} onError={onError} />
          ))}
        </ul>
      )}
      <Field label="App">
        <input
          aria-label="App"
          value={app}
          placeholder="github"
          className={INPUT}
          onChange={(e) => setApp(e.target.value)}
        />
      </Field>
      <Field label="Runs as">
        <Select
          label="Runs as"
          value={kind}
          onChange={(v) => setKind(v as "stdio" | "url")}
          options={[
            { value: "stdio", label: "A program on this PC" },
            { value: "url", label: "An https address" },
          ]}
        />
      </Field>
      {kind === "stdio" ? (
        <>
          <Field label="Program" hint="The program only. Put each argument in the next box.">
            <input
              aria-label="Program"
              value={command}
              placeholder="npx"
              className={INPUT}
              onChange={(e) => setCommand(e.target.value)}
            />
          </Field>
          <Field label="Arguments">
            <input
              aria-label="Arguments"
              value={args}
              placeholder="-y @modelcontextprotocol/server-github"
              className={`${INPUT} font-mono text-[12px]`}
              onChange={(e) => setArgs(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <Field label="Address">
          <input
            aria-label="Address"
            value={url}
            placeholder="https://"
            className={INPUT}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
      )}
      <Field
        label={kind === "stdio" ? "Variables" : "Headers"}
        hint="One NAME=value per line. Values are kept in your system keychain."
      >
        <textarea
          aria-label={kind === "stdio" ? "Variables" : "Headers"}
          value={env}
          rows={2}
          placeholder="GITHUB_TOKEN=..."
          className={`${INPUT} font-mono text-[12px]`}
          onChange={(e) => setEnv(e.target.value)}
        />
      </Field>
      <Button
        disabled={busy || !app.trim() || (kind === "stdio" ? !command.trim() : !url.trim())}
        onClick={() => void add()}
      >
        {busy ? "Checking..." : "Add server"}
      </Button>
    </Section>
  );
}
