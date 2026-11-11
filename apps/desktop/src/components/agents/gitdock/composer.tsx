"use client";

// The commit composer under the file list: one message box with a sparkle
// that writes it from the staged diff, Amend, and the Commit button.
// Ctrl+Enter commits.

import { useEffect, useState } from "react";
import { api } from "@/lib/bridge";
import { Ic } from "../../icon";
import { Tip } from "../../tip";

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

  const ok = amend || (staged > 0 && message.trim() !== "");

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

  return (
    <div className="composer-g">
      <div className="msgbox sumrow">
        <textarea
          className="field no-scrollbar"
          rows={4}
          value={message}
          placeholder={
            amend ? "Keep the last message, or write a new one" : "Commit message - title, blank line, then why"
          }
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
      <p className={`hint${amend && pushed ? " warn" : ""}`}>{hint}</p>
    </div>
  );
}
