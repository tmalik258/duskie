// Ask's scrolling body: clipboard, history, search results, the chat, the
// first-run card, or the rows under the input.

import { Chat } from "../chat";
import { HistoryList } from "../history";
import { Results } from "../lists";
import { Clips } from "../lists/chat-history";
import { FirstRun } from "../states";
import { openHit } from "./file-open";
import { RowList } from "./row-list";
import type { AskPanelModel } from "./use-ask-panel";

export function AskBody({ m }: { m: AskPanelModel }) {
  const { s, hits, scrollMax } = m;
  const style = { maxHeight: scrollMax };
  if (m.showClips && s.clips) {
    return (
      <div key="clips" className="ak-scroll ak-in" style={style}>
        <Clips
          items={m.shownClips}
          filtered={m.clipFilter.length > 0}
          active={Math.min(s.pick, m.shownClips.length - 1)}
          onHover={s.setPick}
        />
      </div>
    );
  }
  if (m.inHistory) {
    return (
      <div key="history" className="ak-scroll ak-in" style={style}>
        <HistoryList
          rows={m.history}
          active={Math.min(s.pick, Math.max(m.history.length - 1, 0))}
          onHover={s.setPick}
          onClear={m.clearChats}
        />
      </div>
    );
  }
  if (m.showHits && hits) {
    return (
      <div key="hits" className="ak-scroll ak-in" style={style}>
        <Results
          query={hits.query}
          items={hits.items}
          loading={hits.loading === true}
          onBack={m.closeHits}
          active={Math.min(s.pick, hits.items.length - 1)}
          onHover={s.setPick}
          onOpen={(h) => openHit(h.source, h.reference, h.title)}
        />
      </div>
    );
  }
  if (m.showChat && !(m.asking && m.items.length > 0 && !m.inChat)) {
    return (
      <div key="chat" ref={m.chatRef} onScroll={m.onScroll} className="ak-scroll" style={style}>
        <Chat turns={m.turns} />
      </div>
    );
  }
  if (m.firstRun) return <FirstRun />;
  if (m.items.length === 0) return null;
  return (
    <RowList
      items={m.items}
      active={m.active}
      asking={m.asking}
      slash={m.slash}
      outsideChat={!m.showChat}
      maxHeight={scrollMax}
      onHover={s.setSelected}
      onRun={m.runRow}
    />
  );
}
