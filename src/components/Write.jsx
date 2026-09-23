import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';
import { fmt, nextStatus, wc } from '../lib/util.js';
import { checkGrammar, MAX_CHARS } from '../lib/grammar.js';

const STATUS_LABEL = { draft: 'draft', revised: 'revised', final: 'final' };
function Mark({ status }) {
  if (status === 'draft') return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="var(--pencil)" strokeWidth="1.7" strokeDasharray="2.5 3.6" strokeLinecap="round" /></svg>;
  if (status === 'revised') return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="M5 15c-1-6 4-11 10-10 6 0 9 5 8 10s-6 9-12 8c-3-1-5-3-6-8z" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><circle cx="14" cy="14" r="10.5" fill="var(--ink)" /><path d="M9 14.5l3.5 3.5L19 10.5" fill="none" stroke="var(--paper)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function GrammarPanel({ text, taRef, onApply }) {
  const [issues, setIssues] = useState([]);
  const [state, setState] = useState('idle'); // idle | checking | error | done
  const [error, setError] = useState('');
  const ctrlRef = useRef(null);

  async function runCheck(t) {
    if (ctrlRef.current) ctrlRef.current.abort();
    if (t.length > MAX_CHARS) { setState('error'); setError(`This scene is over ${fmt(MAX_CHARS)} characters — too long to check in one pass. Try a shorter scene.`); return; }
    if (!t.trim()) { setIssues([]); setState('done'); return; }
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState('checking'); setError('');
    try {
      const found = await checkGrammar(t, { signal: ctrl.signal });
      setIssues(found);
      setState('done');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setState('error'); setError(e.message || 'Couldn\u2019t reach the grammar checker.');
    }
  }

  useEffect(() => {
    const t = setTimeout(() => runCheck(text), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  function select(offset, length) {
    const el = taRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(offset, offset + length);
  }
  function apply(issue, replacement) {
    select(issue.offset, issue.length);
    onApply(issue.offset, issue.length, replacement);
    setIssues((list) => list.filter((i) => i.id !== issue.id));
  }
  function dismiss(id) { setIssues((list) => list.filter((i) => i.id !== id)); }

  return (
    <div className="grammarPanel">
      <div className="gStatus">
        <span className="small">
          {state === 'checking' && 'Checking…'}
          {state === 'error' && error}
          {state === 'done' && (issues.length ? `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}` : 'No issues found.')}
        </span>
        <button className="link" type="button" onClick={() => runCheck(text)}>Check now</button>
      </div>
      {issues.map((it) => {
        const ctx = it.context;
        const before = ctx ? ctx.text.slice(0, ctx.offset) : '';
        const flagged = ctx ? ctx.text.slice(ctx.offset, ctx.offset + ctx.length) : '';
        const after = ctx ? ctx.text.slice(ctx.offset + ctx.length) : '';
        return (
          <div key={it.id} className="gIssue">
            <button type="button" className="gCtx" onClick={() => select(it.offset, it.length)}>
              {before}<mark>{flagged}</mark>{after}
            </button>
            <p className="gMsg">{it.message}</p>
            {it.replacements.length > 0 && (
              <div className="gChips">
                {it.replacements.map((r, i) => (
                  <button key={i} type="button" onClick={() => apply(it, r)}>{r || '(remove)'}</button>
                ))}
              </div>
            )}
            <button className="link" type="button" onClick={() => dismiss(it.id)}>Ignore</button>
          </div>
        );
      })}
    </div>
  );
}

export default function Write({ project, sceneId, onFocusChange }) {
  const { data, updateScene, updateChapter, beginSession, bumpSession } = useData();
  const { notify } = useUI();
  const scene = data.scenes.find((s) => s.id === sceneId);
  const chapter = scene && data.chapters.find((c) => c.id === scene.chapter_id);
  const [text, setText] = useState(scene?.text || '');
  const [focus, setFocus] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const taRef = useRef(null);
  const saveT = useRef(null);
  const sessionId = useRef(null);
  const lastWc = useRef(scene ? scene.word_count : 0);
  const idleT = useRef(null);
  const lastTick = useRef(0);

  useEffect(() => {
    setText(scene?.text || '');
    lastWc.current = scene?.word_count || 0;
    sessionId.current = scene ? beginSession(project.id, scene.id) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  useEffect(() => () => clearTimeout(saveT.current), []);

  function autogrow(el) { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }
  useEffect(() => { autogrow(taRef.current); }, [text]);

  function commit(v) {
    setText(v);
    const n = wc(v);
    const delta = n - lastWc.current;
    lastWc.current = n;
    if (sessionId.current && delta) bumpSession(sessionId.current, { words: delta });
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => { updateScene(scene.id, { text: v, word_count: n }); }, 700);
  }
  function onInput(e) { commit(e.target.value); tickTime(); }
  function applyFix(offset, length, replacement) {
    commit(text.slice(0, offset) + replacement + text.slice(offset + length));
  }
  function tickTime() {
    const now = Date.now();
    if (now - lastTick.current > 1000 && sessionId.current) {
      const delta = Math.min(20, Math.round((now - (lastTick.current || now)) / 1000));
      if (lastTick.current) bumpSession(sessionId.current, { seconds: delta });
    }
    lastTick.current = now;
    clearTimeout(idleT.current);
    idleT.current = setTimeout(() => { lastTick.current = 0; }, 15000);
  }
  useEffect(() => () => clearTimeout(idleT.current), []);

  function cycleStatus() {
    if (!scene) return;
    updateScene(scene.id, { status: nextStatus(scene.status) });
  }

  function toggleFocus() {
    const on = !focus;
    setFocus(on);
    onFocusChange?.(on);
    if (on) setTimeout(() => taRef.current?.focus(), 0);
  }
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && focus) toggleFocus(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const total = useMemo(() => data.scenes.filter((s) => s.project_id === project.id).reduce((a, s) => a + s.word_count, 0), [data.scenes, project.id]);

  if (!scene) {
    return (
      <div className="empty">
        <p>This novel has no scenes yet. Add a chapter from the Outline tab to begin.</p>
      </div>
    );
  }

  return (
    <article className="sheet" style={focus ? { boxShadow: 'none', border: 0, background: 'transparent' } : undefined}>
      {!focus && (
        <div className="sheetHead">
          <span className="pencil">{chapter?.title || 'chapter'}, {scene.title || 'untitled scene'}</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <button className="tbtn" type="button" aria-pressed={grammarOpen} onClick={() => setGrammarOpen((v) => !v)}>Grammar</button>
            <button className="tbtn" type="button" onClick={toggleFocus}>Focus</button>
          </span>
        </div>
      )}
      {focus && (
        <div style={{ textAlign: 'right', marginBottom: 8 }}>
          <button className="tbtn" type="button" onClick={toggleFocus}>Leave focus</button>
        </div>
      )}
      {!focus && (
        <>
          <input
            className="sceneTitle" value={scene.title} placeholder="Scene title"
            onChange={(e) => updateScene(scene.id, { title: e.target.value })}
          />
          <button className="statusrow" type="button" onClick={cycleStatus} aria-label={`Status: ${STATUS_LABEL[scene.status]}. Tap to change`}>
            <Mark status={scene.status} /><span className="pencil">{STATUS_LABEL[scene.status]}</span>
          </button>
        </>
      )}
      <textarea
        ref={taRef} className="editorTextarea" value={text} onChange={onInput}
        placeholder="Start writing…" spellCheck="true" autoCapitalize="sentences"
        onFocus={() => { lastTick.current = Date.now(); }}
      />
      {!focus && (
        <div className="tallybar">
          <span className="small">{fmt(wc(text))} words here · {fmt(total)} in the manuscript</span>
        </div>
      )}
      {!focus && grammarOpen && <GrammarPanel text={text} taRef={taRef} onApply={applyFix} />}
    </article>
  );
}

