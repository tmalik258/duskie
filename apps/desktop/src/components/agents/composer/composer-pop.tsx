"use client";

// The list above the composer: slash commands by group, or project files.

import { Fragment, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { AgentCommand } from "@/lib/agent-commands";
import { scrollIfActive } from "../../ask/parts";
import { fromPick, parents } from "../../attach/context";
import type { PopPlace } from "./use-pop-place";

export function ComposerPop({
  popRef,
  float,
  slash,
  commands,
  files,
  project,
  at,
  onHover,
  onCommand,
  onFile,
}: {
  popRef: RefObject<HTMLDivElement | null>;
  float: PopPlace;
  slash: boolean;
  commands: AgentCommand[];
  files: string[];
  project: string;
  at: number;
  onHover: (i: number) => void;
  onCommand: (c: AgentCommand) => void;
  onFile: (f: string) => void;
}) {
  let lastGroup = "";
  const option = (i: number) => ({
    type: "button" as const,
    role: "option",
    "aria-selected": i === at,
    "data-sel": i === at,
    ref: scrollIfActive(i === at),
    onMouseMove: () => onHover(i),
    className: "it",
  });
  return createPortal(
    <div
      ref={popRef}
      className="ak-pop ak-pop-float ak-in"
      role="listbox"
      aria-label={slash ? "Commands" : "Files"}
      style={{
        position: "fixed",
        left: float.left,
        bottom: float.bottom,
        width: "max-content",
        maxWidth: float.maxWidth,
        zIndex: 100,
      }}
    >
      {slash ? (
        commands.map((c, i) => {
          const head = c.group !== lastGroup;
          lastGroup = c.group;
          return (
            <Fragment key={c.name}>
              {head && <p className="g">{c.group}</p>}
              <button {...option(i)} onClick={() => onCommand(c)}>
                <span className="c mono">{c.name}</span>
                <span className="d">{c.description}</span>
              </button>
            </Fragment>
          );
        })
      ) : (
        <>
          <p className="g">Files and folders in {project}</p>
          {files.map((f, i) => (
            <button key={f} {...option(i)} onClick={() => onFile(f)}>
              <span className="c mono">{fromPick(f).name}</span>
              <span className="d">{parents(f)}</span>
            </button>
          ))}
        </>
      )}
    </div>,
    document.body,
  );
}
