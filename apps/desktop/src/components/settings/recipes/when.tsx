"use client";

// Part of recipes: WHEN, DAYS, describeTrigger, blank, TriggerFields.

import type { Trigger } from "@/lib/types";
import { Field, Select, TextField } from "../ui";

const WHEN: [Trigger["when"], string][] = [
  ["manual", "When I ask"],
  ["time", "At a time"],
  ["notification", "On a notification"],
  ["download", "When a download finishes"],
  ["meeting_ended", "When a meeting ends"],
  ["app_opened", "When an app opens"],
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function describeTrigger(t: Trigger): string {
  switch (t.when) {
    case "time":
      return t.days.length ? `${t.days.join(", ")} at ${t.time}` : `Every day at ${t.time}`;
    case "notification":
      return `On a notification${t.app ? ` from ${t.app}` : ""}${t.contains ? ` with "${t.contains}"` : ""}`;
    case "download":
      return t.kind ? `When a ${t.kind} download finishes` : "When a download finishes";
    case "meeting_ended":
      return "When a meeting ends";
    case "app_opened":
      return `When ${t.app || "an app"} opens`;
    default:
      return "When I ask";
  }
}

function blank(when: Trigger["when"]): Trigger {
  switch (when) {
    case "time":
      return { when, time: "09:00", days: [] };
    case "notification":
      return { when, app: "", contains: "" };
    case "download":
      return { when, kind: "" };
    case "app_opened":
      return { when, app: "" };
    case "meeting_ended":
      return { when };
    default:
      return { when: "manual" };
  }
}

export function TriggerFields({ trigger, onChange }: { trigger: Trigger; onChange: (t: Trigger) => void }) {
  return (
    <>
      <Field label="Runs">
        <Select
          label="When it runs"
          value={trigger.when}
          options={WHEN}
          onChange={(when) => onChange(blank(when as Trigger["when"]))}
        />
      </Field>
      {trigger.when === "time" && (
        <>
          <Field label="Time" hint="24 hour, like 17:00">
            <TextField
              label="Time"
              value={trigger.time}
              className="w-24"
              onCommit={(time) => onChange({ ...trigger, time })}
            />
          </Field>
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="sr-only">Days</legend>
            {DAYS.map((d) => {
              const on = trigger.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({ ...trigger, days: on ? trigger.days.filter((x) => x !== d) : [...trigger.days, d] })
                  }
                  className={`chip rounded-full px-2.5 py-1 text-[12px] capitalize ${
                    on ? "bg-(--text) text-(--bg)" : "bg-(--surface) text-(--text)/80 hover:bg-(--hover)"
                  }`}
                >
                  {d}
                </button>
              );
            })}
            <span className="self-center text-[11.5px] text-(--muted)">None picked: every day</span>
          </fieldset>
        </>
      )}
      {(trigger.when === "notification" || trigger.when === "app_opened") && (
        <Field label="App">
          <TextField
            label="App"
            value={trigger.app}
            placeholder="WhatsApp"
            className="w-40"
            onCommit={(app) => onChange({ ...trigger, app })}
          />
        </Field>
      )}
      {trigger.when === "notification" && (
        <Field label="Only with the word" hint="Optional">
          <TextField
            label="Only with the word"
            value={trigger.contains}
            placeholder="invoice"
            className="w-40"
            onCommit={(contains) => onChange({ ...trigger, contains })}
          />
        </Field>
      )}
      {trigger.when === "download" && (
        <Field label="Kind" hint="Optional: pdf, image, document">
          <TextField
            label="Download kind"
            value={trigger.kind}
            placeholder="pdf"
            className="w-32"
            onCommit={(kind) => onChange({ ...trigger, kind })}
          />
        </Field>
      )}
    </>
  );
}
