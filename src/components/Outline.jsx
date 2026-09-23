import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';
import { BEATS, fmt, nextStatus, sortBy } from '../lib/util.js';

const STATUS_LABEL = { draft: 'draft', revised: 'revised', final: 'final' };
function Mark({ status }) {
  if (status === 'draft') return <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="var(--pencil)" strokeWidth="1.7" strokeDasharray="2.5 3.6" strokeLinecap="round" /></svg>;
  if (status === 'revised') return <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden="true"><path d="M5 15c-1-6 4-11 10-10 6 0 9 5 8 10s-6 9-12 8c-3-1-5-3-6-8z" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 28 28" width="20" height="20" aria-hidden="true"><circle cx="14" cy="14" r="10.5" fill="var(--ink)" /><path d="M9 14.5l3.5 3.5L19 10.5" fill="none" stroke="var(--paper)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function Outline({ project, onOpenScene }) {
  const { data, updateProject, addChapter, updateChapter, deleteChapter, addScene, updateScene, deleteScene, reorderScenes, reorderChapters } = useData();
  const { confirm } = useUI();
  const mode = project.outline_mode || 'loose';
  const [flipped, setFlipped] = useState(null);
  const deckRef = useRef(null);
  const dragRef = useRef(null);

  function setMode(m) { updateProject(project.id, { outline_mode: m }); }

  const chapters = sortBy(data.chapters.filter((c) => c.project_id === project.id), 'position');
  const scenesOf = (chapterId) => sortBy(data.scenes.filter((s) => s.chapter_id === chapterId), 'position');
  const allScenes = sortBy(data.scenes.filter((s) => s.project_id === project.id), 'position');

  /* ---------------- slots for dragging ---------------- */
  function looseSlots() {
    const out = [];
    chapters.forEach((c) => { out.push({ type: 'tape', chapterId: c.id, label: c.title || 'Untitled chapter' }); scenesOf(c.id).forEach((s) => out.push({ type: 'card', id: s.id })); });
    return out;
  }
  function beatSlots(field) {
    const out = [];
    BEATS[mode].forEach((label, i) => {
      const g = allScenes.filter((s) => (s[field] ?? -1) === i);
      out.push({ type: 'tape', beat: i, label, count: g.length });
      g.forEach((s) => out.push({ type: 'card', id: s.id }));
    });
    const un = allScenes.filter((s) => s[field] == null);
    if (un.length) { out.push({ type: 'tape', beat: -1, label: 'Unplaced', count: un.length }); un.forEach((s) => out.push({ type: 'card', id: s.id })); }
    return out;
  }
  const field = mode === 'three' ? 'beat_three' : 'beat_stc';
  const slots = mode === 'loose' ? looseSlots() : beatSlots(field);

  function commitFromDOM() {
    const nodes = Array.from(deckRef.current.querySelectorAll('[data-slot]'));
    if (mode === 'loose') {
      let chapterId = null, pos = 0, chapterOrder = [], chapterPos = 0;
      const sceneRows = [];
      nodes.forEach((n) => {
        if (n.dataset.tape) { chapterId = n.dataset.tape; pos = 0; chapterOrder.push({ id: chapterId, position: chapterPos++ }); }
        else if (chapterId) sceneRows.push({ id: n.dataset.card, chapter_id: chapterId, position: pos++ });
      });
      if (sceneRows.length) reorderScenes(sceneRows);
      if (chapterOrder.length) reorderChapters(chapterOrder);
    } else {
      let beat = null, pos = 0;
      const rows = [];
      nodes.forEach((n) => {
        if (n.dataset.tape !== undefined) { beat = +n.dataset.beat; pos = 0; }
        else if (beat !== null) rows.push({ id: n.dataset.card, [field]: beat < 0 ? null : beat, position: pos++ });
      });
      if (rows.length) reorderScenes(rows);
    }
  }

  function onPointerDown(e) {
    const hole = e.target.closest('[data-hole]');
    if (!hole) return;
    const card = hole.closest('[data-slot="card"]');
    dragRef.current = { card };
    card.classList.add('lift');
    try { hole.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  }
  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const kids = Array.from(deckRef.current.children).filter((c) => c !== drag.card);
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2 && e.clientX >= r.left - 4 && e.clientX <= r.right + 200) {
        if (k !== drag.card.nextElementSibling) deckRef.current.insertBefore(drag.card, k);
        return;
      }
    }
    deckRef.current.appendChild(drag.card);
  }
  function endDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    drag.card.classList.remove('lift');
    commitFromDOM();
  }

  async function removeChapter(id, title, count) {
    const ok = await confirm(`Delete “${title || 'Untitled chapter'}” and its ${count} ${count === 1 ? 'scene' : 'scenes'}? This can’t be undone.`, 'Delete chapter');
    if (ok) deleteChapter(id);
  }
  async function removeScene(id, title) {
    const ok = await confirm(`Delete “${title || 'Untitled scene'}”? This can’t be undone.`, 'Delete scene');
    if (ok) deleteScene(id);
  }

  return (
    <div>
      <div className="mode" role="group" aria-label="Structure">
        <button type="button" aria-pressed={mode === 'loose'} onClick={() => setMode('loose')}>Freeform</button>
        <button type="button" aria-pressed={mode === 'three'} onClick={() => setMode('three')}>Three-act</button>
        <button type="button" aria-pressed={mode === 'stc'} onClick={() => setMode('stc')}>Save the Cat</button>
      </div>
      <div
        className="deck" ref={deckRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
      >
        {slots.map((slot, i) => {
          if (slot.type === 'tape') {
            if (mode === 'loose') {
              const ch = chapters.find((c) => c.id === slot.chapterId);
              const count = scenesOf(slot.chapterId).length;
              return (
                <div key={'t' + i} className="tape" data-slot="tape" data-tape={slot.chapterId}>
                  <input
                    value={ch?.title || ''} onChange={(e) => updateChapter(slot.chapterId, { title: e.target.value })}
                    style={{ border: 0, background: 'transparent', font: 'inherit', fontWeight: 700, color: 'var(--ink)', width: '9rem' }}
                  />
                  <span className="cnt">{count} {count === 1 ? 'scene' : 'scenes'}</span>
                  <span style={{ display: 'flex', gap: 2 }}>
                    <button className="link" type="button" onClick={() => addScene(slot.chapterId, project.id)}>+ scene</button>
                    <button className="link danger" type="button" onClick={() => removeChapter(slot.chapterId, ch?.title, count)}>delete</button>
                  </span>
                </div>
              );
            }
            return (
              <div key={'t' + i} className="tape" data-slot="tape" data-tape="" data-beat={slot.beat}>
                <span>{slot.label}</span>
                <span className="cnt">{slot.count} {slot.count === 1 ? 'scene' : 'scenes'}</span>
              </div>
            );
          }
          const s = data.scenes.find((x) => x.id === slot.id);
          if (!s) return null;
          const isFlipped = flipped === s.id;
          return (
            <div key={s.id} className="card" data-slot="card" data-card={s.id}>
              {!isFlipped ? (
                <button type="button" className="face" onClick={(e) => { if (!e.target.closest('[data-hole],[data-mk]')) setFlipped(s.id); }}>
                  <div className="cTop"><span>{fmt(allScenes.findIndex((x) => x.id === s.id) + 1)}</span><span>{data.chapters.find((c) => c.id === s.chapter_id)?.title || ''}</span></div>
                  <div className="cTitle">{s.title || 'Untitled scene'}</div>
                  <div className="cSyn">{s.text ? s.text.slice(0, 120) : 'No text yet.'}</div>
                  <div className="cFoot">
                    <span className="cW">{fmt(s.word_count)} w</span>
                    <span data-mk role="button" tabIndex={0} className="mk"
                      onClick={(e) => { e.stopPropagation(); updateScene(s.id, { status: nextStatus(s.status) }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); updateScene(s.id, { status: nextStatus(s.status) }); } }}
                      aria-label={`Status: ${STATUS_LABEL[s.status]}. Tap to change`}>
                      <Mark status={s.status} />
                    </span>
                  </div>
                  <span data-hole className="hole" aria-label={`Drag to reorder ${s.title}`}>⠿</span>
                </button>
              ) : (
                <button type="button" className="face" style={{ textAlign: 'left' }} onClick={() => setFlipped(null)}>
                  <b style={{ display: 'block', fontFamily: 'var(--wf)', fontWeight: 700, fontSize: 13, borderBottom: '1.5px solid var(--red)', marginBottom: 4 }}>{s.title}</b>
                  <p style={{ fontSize: 11.5, lineHeight: 1.4, margin: 0 }}>{s.text ? s.text.slice(0, 180) : 'No text yet.'}</p>
                  <div style={{ position: 'absolute', bottom: 6, left: 9, right: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <button className="link" type="button" onClick={(e) => { e.stopPropagation(); onOpenScene(s.id); }}>open</button>
                    <button className="link danger" type="button" onClick={(e) => { e.stopPropagation(); removeScene(s.id, s.title); }}>delete</button>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {mode === 'loose' && (
        <p style={{ marginTop: 10 }}>
          <button className="btn" type="button" onClick={() => addChapter(project.id)}>+ Add chapter</button>
        </p>
      )}
      <p className="pencil hint">drag a card by its handle to reorder{mode === 'loose' ? ' or move it to another chapter' : ' between beats'}. tap a card to flip it, tap its mark to change status.</p>
    </div>
  );
}
