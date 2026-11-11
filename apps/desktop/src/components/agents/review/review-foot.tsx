"use client";

import { Ic } from "../../icon";

/** What is left, file arrows, Accept all remaining and Finish. */
export function ReviewFoot({
  left,
  filesLeft,
  finished,
  fileAt,
  fileCount,
  goFile,
  acceptRemaining,
  finish,
}: {
  left: number;
  filesLeft: number;
  finished: boolean;
  fileAt: number;
  fileCount: number;
  goFile: (i: number) => void;
  acceptRemaining: () => void;
  finish: () => void;
}) {
  return (
    <div className="rv-foot">
      <span className="sum">
        {left > 0
          ? `${left} ${left === 1 ? "change" : "changes"} left in ${filesLeft} ${filesLeft === 1 ? "file" : "files"}`
          : "Everything reviewed"}
        {!finished && <span className="shimmer-text"> · loading</span>}
      </span>
      <button
        type="button"
        className="rv-ico"
        aria-label="Previous file"
        title="Previous file ([)"
        disabled={fileAt === 0}
        onClick={() => goFile(fileAt - 1)}
      >
        <span className="flip">
          <Ic name="chevr" size={13} />
        </span>
      </button>
      <button
        type="button"
        className="rv-ico"
        aria-label="Next file"
        title="Next file (])"
        disabled={fileAt >= fileCount - 1}
        onClick={() => goFile(fileAt + 1)}
      >
        <Ic name="chevr" size={13} />
      </button>
      <button type="button" className="rv-btn" disabled={left === 0} onClick={acceptRemaining}>
        Accept all remaining
      </button>
      <button type="button" className="rv-btn primary" disabled={left > 0} onClick={finish}>
        Finish review
      </button>
    </div>
  );
}
