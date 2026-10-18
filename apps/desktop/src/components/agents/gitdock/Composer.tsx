"use client";

// The commit composer under the file list: one message box with a sparkle
// that writes it from the staged diff, a counter for the title line, Amend,
// and the Commit button. Ctrl+Enter commits.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { Ic } from "../../Icon";
import { Tip } from "../../Tip";

const TITLE_MAX = 72;
const TITLE_WARN = 50;

export function Composer({
  path,
  branch,
  staged,
  total,
  busy,
  act,
}: {
  path: string;
  branch: string;
  staged: number;
  total: number;
  busy: boolean;
  act: (work: () => Promise<string>) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [writing, setWriting] = useState(false);

  const title = message.split("\n")[0] ?? "";
  const len = title.length;
  const ok = amend || (staged > 0 && message.trim() !== "");
  const counter = len > TITLE_MAX ? "over" : len > TITLE_WARN ? "warn" : "";

  // Amending a commit that is already on the remote needs a force push: say so.
  useEffect(() => {
    if (!amend) return;
    let live = true;
    void api
      .gitLastCommitPushed(path)
      .then((p) => live && setPushed(p))
      .catch(() => live && setPushed(false));
    return () => {
      live = false;
    };
  }, [amend, path]);

  const write = () => {
    setWriting(true);
    void act(async () => {
      setMessage(await api.gitWriteMessage(path));
      return "Message written from the staged changes. Edit it if you like.";
    }).finally(() => setWriting(false));
  };
  const commit = () => {
    if (!ok || busy) return;
    void act(async () => {
      const done = amend ? await api.gitAmend(path, message.trim() || undefined) : await api.gitCommit(path, message);
      setMessage("");
      setAmend(false);
      return done;
    });
  };

  let hint = `On ${branch || "this branch"}. Ctrl Enter to commit.`;
  if (staged === 0 && !amend) hint = "Stage a file to commit.";
  else if (!amend && message.trim() === "") hint = "Write a message, or tap the sparkle to write it from your changes.";
  else if (amend && pushed) hint = "This commit is already on the remote, so you will need to force push.";
  else if (len > TITLE_MAX) hint = "The first line is the title and gets cut off on GitHub past 72 characters.";
  const warn = (amend && pushed) || len > TITLE_MAX;

  return (
    <div className="composer-g">
      <div className="msgbox sumrow">
        <textarea
          className="field"
          rows={3}
          value={message}
          placeholder={amend ? "Keep the last message, or write a new one" : "Commit message"}
          aria-label="Commit message"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <Tip label="Write it from the staged changes">
          <button
            type="button"
            className={`aibtn${writing ? " busy" : ""}`}
            aria-label="Write the message"
            disabled={busy || total === 0}
            onClick={write}
          >
            <Ic name="spark" size={14} />
          </button>
        </Tip>
        {len > 0 && <span className={`cc ${counter}`}>{`${len}/${TITLE_MAX}`}</span>}
      </div>
      <div className="crow">
        <label className="gcheck">
          <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} />
          Amend
        </label>
        <button type="button" className="btn primary" disabled={busy || !ok} onClick={commit}>
          {amend ? "Amend commit" : staged > 0 ? `Commit ${staged} file${staged > 1 ? "s" : ""}` : "Commit"}
        </button>
      </div>
      <p className={`hint${warn ? " warn" : ""}`}>{hint}</p>
    </div>
  );
}
