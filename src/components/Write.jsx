import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { fmt, nextStatus, wc } from '../lib/util.js';
import { checkGrammar, MAX_CHARS } from '../lib/grammar.js';
import { applyReplacement, htmlToPlain, rangeFromOffsets, toHtml } from '../lib/richtext.js';

const STATUS_LABEL = { draft: 'draft', revised: 'revised', final: 'final' };
function Mark({ status }) {
  if (status === 'draft') return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="var(--pencil)" strokeWidth="1.7" strokeDasharray="2.5 3.6" strokeLinecap="round" /></svg>;
  if (status === 'revised') return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><path d="M5 15c-1-6 4-11 10-10 6 0 9 5 8 10s-6 9-12 8c-3-1-5-3-6-8z" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true"><circle cx="14" cy="14" r="10.5" fill="var(--ink)" /><path d="M9 14.5l3.5 3.5L19 10.5" fill="none" stroke="var(--paper)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// Finds the paragraph-level block (direct child of the editor) that the
// current selection is inside, for indent/outdent and paragraph style.
function currentBlock(root) {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode || !root.contains(sel.anchorNode)) return null;
  let n = sel.anchorNode;
  while (n && n.parentElement !== root) n = n.parentElement;
  return n instanceof HTMLElement ? n : null;
}
const LEVELS = [0, 2.2, 4.4, 6.6, 8.8]; // em, on top of the base first-line indent

function GrammarPanel({ html, taRef, onApplied }) {
  const [issues, setIssues] = useState([]);
  const [state, setState] = useState('idle'); // idle | checking | error | done
  const [error, setError] = useState('');
  const ctrlRef = useRef(null);

  async function runCheck(h) {
    if (ctrlRef.current) ctrlRef.current.abort();
    const plain = htmlToPlain(h);
    if (plain.length > MAX_CHARS) { setState('error'); setError(`This scene is over ${fmt(MAX_CHARS)} characters — too long to check in one pass. Try a shorter scene.`); return; }
    if (!plain.trim()) { setIssues([]); setState('done'); return; }
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState('checking'); setError('');
    try {
      const found = await checkGrammar(plain, { signal: ctrl.signal });
      setIssues(found);
      setState('done');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setState('error'); setError(e.message || 'Couldn\u2019t reach the grammar checker.');
    }
  }

  useEffect(() => {
    const t = setTimeout(() => runCheck(html), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  function select(offset, length) {
    const el = taRef.current;
    if (!el) return;
    const range = rangeFromOffsets(el, offset, offset + length);
    if (!range) return;
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function apply(issue, replacement) {
    const el = taRef.current;
    if (!el) return;
    if (applyReplacement(el, issue.offset, issue.offset + issue.length, replacement)) onApplied();
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
        <button className="link" type="button" onClick={() => runCheck(html)}>Check now</button>
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
  const { data, updateScene, beginSession, bumpSession } = useData();
  const scene = data.scenes.find((s) => s.id === sceneId);
  const chapter = scene && data.chapters.find((c) => c.id === scene.chapter_id);
  const [html, setHtml] = useState(() => toHtml(scene?.text));
  const [empty, setEmpty] = useState(!scene?.text);
  const [focus, setFocus] = useState(false);
  const [grammarOpen, setGrammarOpen] = useState(false);
  const [marks, setMarks] = useState({ bold: false, italic: false });
  const taRef = useRef(null);
  const saveT = useRef(null);
  const sessionId = useRef(null);
  const lastWc = useRef(scene ? scene.word_count : 0);
  const idleT = useRef(null);
  const lastTick = useRef(0);

  useEffect(() => {
    const h = toHtml(scene?.text);
    setHtml(h);
    setEmpty(!htmlToPlain(h).trim());
    if (taRef.current) taRef.current.innerHTML = h;
    lastWc.current = scene?.word_count || 0;
    sessionId.current = scene ? beginSession(project.id, scene.id) : null;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* deprecated API, best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  useEffect(() => () => clearTimeout(saveT.current), []);

  function commit(h) {
    setHtml(h);
    const plain = htmlToPlain(h);
    setEmpty(!plain.trim());
    const n = wc(plain);
    const delta = n - lastWc.current;
    lastWc.current = n;
    if (sessionId.current && delta) bumpSession(sessionId.current, { words: delta });
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => { updateScene(scene.id, { text: h, word_count: n }); }, 700);
  }
  function onInput() { commit(taRef.current.innerHTML); tickTime(); }
  function commitFromDOM() { commit(taRef.current.innerHTML); }
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

  function updateMarks() {
    try { setMarks({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic') }); }
    catch (e) { /* ignore */ }
  }
  useEffect(() => {
    document.addEventListener('selectionchange', updateMarks);
    return () => document.removeEventListener('selectionchange', updateMarks);
  }, []);

  function format(cmd) {
    taRef.current.focus();
    try { document.execCommand(cmd); } catch (e) { /* ignore */ }
    updateMarks();
    onInput();
  }
  function indent(dir) {
    const block = currentBlock(taRef.current);
    if (!block) return;
    const cur = LEVELS.indexOf(parseFloat(block.dataset.indent || '0'));
    const next = Math.max(0, Math.min(LEVELS.length - 1, (cur < 0 ? 0 : cur) + dir));
    const em = LEVELS[next];
    if (em === 0) { delete block.dataset.indent; block.style.textIndent = ''; }
    else { block.dataset.indent = String(em); block.style.textIndent = `${em}em`; }
    onInput();
  }
  function setStyle(kind) {
    const block = currentBlock(taRef.current);
    if (!block) return;
    block.classList.toggle('center', kind === 'center');
    onInput();
  }
  function onKeyDown(e) {
    if (e.key === 'Tab') { e.preventDefault(); indent(e.shiftKey ? -1 : 1); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); format('bold'); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); format('italic'); }
  }

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
  const hereWords = useMemo(() => wc(htmlToPlain(html)), [html]);

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
          <div className="editToolbar" role="toolbar" aria-label="Formatting" onMouseDown={(e) => e.preventDefault()}>
            <button type="button" aria-pressed={marks.bold} aria-label="Bold" onClick={() => format('bold')}><b>B</b></button>
            <button type="button" aria-pressed={marks.italic} aria-label="Italic" onClick={() => format('italic')}><i>I</i></button>
            <span className="tdiv" />
            <button type="button" aria-label="Outdent" onClick={() => indent(-1)}>⇤</button>
            <button type="button" aria-label="Indent" onClick={() => indent(1)}>⇥</button>
            <span className="tdiv" />
            <button type="button" aria-label="Normal paragraph" onClick={() => setStyle('normal')}>¶</button>
            <button type="button" aria-label="Centered paragraph" onClick={() => setStyle('center')}>≡</button>
          </div>
        </>
      )}
      <div className="editorWrap">
        {empty && !focus && <span className="editorPlaceholder">Start writing…</span>}
        <div
          ref={taRef} className="editorBody" role="textbox" aria-multiline="true" aria-label="Scene text"
          contentEditable suppressContentEditableWarning spellCheck="true" autoCapitalize="sentences"
          onInput={onInput} onKeyDown={onKeyDown}
          onFocus={() => { lastTick.current = Date.now(); }}
        />
      </div>
      {!focus && (
        <div className="tallybar">
          <span className="small">{fmt(hereWords)} words here · {fmt(total)} in the manuscript</span>
        </div>
      )}
      {!focus && grammarOpen && <GrammarPanel html={html} taRef={taRef} onApplied={commitFromDOM} />}
    </article>
  );
}
