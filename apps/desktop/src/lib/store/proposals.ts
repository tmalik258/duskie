// Proposals and retries in Ask, and watching a wait until it finishes.

import { api } from "../bridge";
import type { Proposal } from "../types";
import type { AskState } from "./ask-types";
import { useDuskie } from "./duskie-state";
import { finishWaiting } from "./panel-events";
import { sendChat } from "./send-chat";
import { stopWaiting, WAIT_LIMIT_MS, WAIT_POLL_MS } from "./waiting";

/** Checks the step being waited for; done or too long brings the panel back. */
export function watchWaiting(): () => void {
  let busy = false;
  const id = setInterval(() => {
    const waiting = useDuskie.getState().waiting;
    if (!waiting || busy) return;
    if (Date.now() - waiting.since > WAIT_LIMIT_MS) {
      stopWaiting();
      return;
    }
    // Composio apps finish via composio://changed, not setup status.
    if (waiting.id.startsWith("app:")) return;
    busy = true;
    const name = waiting.label.charAt(0).toUpperCase() + waiting.label.slice(1);
    // Extension install: finish only when this browser connects, not any paired one.
    if (waiting.id === "browser" && waiting.target) {
      const target = waiting.target;
      api
        .browsersStatus()
        .then((browsers) => {
          if (useDuskie.getState().waiting?.id !== waiting.id) return;
          if (browsers.some((b) => b.id === target && b.connected)) {
            finishWaiting(waiting, `Done. ${name} is connected.`);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
      return;
    }
    api
      .setupStatus()
      .then((status) => {
        if (useDuskie.getState().waiting?.id !== waiting.id) return;
        const item = status.items.find((i) => i.id === waiting.id);
        if (item?.done) {
          finishWaiting(
            waiting,
            waiting.doneLine ??
              (item.group === "connect" ? `Done. ${name} is connected.` : `All set. ${name} is installed.`),
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  }, WAIT_POLL_MS);
  return () => clearInterval(id);
}

/** Runs an action Ask offered, and records what happened on its button. */
export async function runProposal(id: string) {
  const mark = (ran: NonNullable<Proposal["ran"]>) =>
    useDuskie.setState({
      turns: useDuskie
        .getState()
        .turns.map((t) =>
          t.proposals?.some((p) => p.id === id)
            ? { ...t, proposals: t.proposals.map((p) => (p.id === id ? { ...p, ran } : p)) }
            : t,
        ),
    });
  try {
    mark(await api.aiRunProposal(id));
  } catch (e) {
    mark({ ok: false, message: String(e), undoId: null, path: null });
  }
}

/** Undoes what a tapped action did; marks it so Undo does not show again. */
export async function undoProposal(id: string): Promise<string> {
  const p = useDuskie
    .getState()
    .turns.flatMap((t) => t.proposals ?? [])
    .find((x) => x.id === id);
  if (!p?.ran?.undoId) return "Nothing to undo.";
  const message = await api.actionUndo(p.ran.undoId);
  useDuskie.setState({
    turns: useDuskie.getState().turns.map((t) =>
      t.proposals?.some((x) => x.id === id)
        ? {
            ...t,
            proposals: t.proposals.map((x) => (x.id === id && x.ran ? { ...x, ran: { ...x.ran, undone: true } } : x)),
          }
        : t,
    ),
  });
  return message;
}

export const setAsk = (patch: Partial<AskState>) => {
  const ask = useDuskie.getState().ask;
  if (ask) useDuskie.setState({ ask: { ...ask, ...patch } });
};

export function retryLast(): boolean {
  const { turns, chatId } = useDuskie.getState();
  const last = turns[turns.length - 1];
  const question = turns[turns.length - 2];
  if (chatId || !last?.error || question?.role !== "user") return false;
  useDuskie.setState({ turns: turns.slice(0, -2) });
  return sendChat(question.content);
}

/** Asks the last question again; `think` lets the local model reason first. */
export function askAgain(think = false): boolean {
  const { turns, chatId } = useDuskie.getState();
  const question = turns[turns.length - 2];
  if (chatId || question?.role !== "user") return false;
  useDuskie.setState({ turns: turns.slice(0, -2) });
  return sendChat(question.content, { think });
}

/** Asks the last question again, letting the local model think first. */
export function thinkHarder(): boolean {
  return askAgain(true);
}
