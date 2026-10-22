from pathlib import Path
p = Path('apps/desktop/src/components/agents/board.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace('  tuneSession,', '  sessionView,\n  startHere,')
s = s.replace('import { AgentMark,', 'import { Composer, AgentMark,')
s = s.replace('import { ChatControls } from "./Controls";\n', '')
s = s.replace('  const live = sessions.filter((s) => !s.restored || s.status !== "ended");', '  const live = sessions;')
s = s.replace('  const [text, setText] = useState("");\n  const grid', '  const text = target?.view?.draft ?? "";\n  const setText = (draft: string) => { if (target) sessionView(target.id, { draft }); };\n  const grid')
s = s.replace('''    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));''', '''    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".ak-board .ak-composer input")?.focus({ preventScroll: true }));''')
a = s.index('      {target && (\n        <div className="ak-composer ak-two">')
b = s.index('\n    </div>\n  );\n}', a)
s = s[:a] + '''      {target && <Composer session={target} working={target.status === "working" || target.status === "waiting"} text={text} setText={setText} onSend={send} keys={true}
        onClear={() => void api.agentProject(target.id).then((path) => { setLayout("one"); startHere(path); })}
        onReview={() => { sessionView(target.id, { reviewing: true }); setLayout("one"); useAgents.setState({ current: target.id }); }}
        onRewind={() => { setLayout("one"); useAgents.setState({ current: target.id }); }} />}
''' + s[b:]
p.write_text(s, encoding='utf-8')
