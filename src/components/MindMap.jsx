import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';

const TYPE = {
  idea: { label: 'idea', var: '--pencil', nw: 'new idea' },
  character: { label: 'person', var: '--red', nw: 'new person' },
  place: { label: 'place', var: '--blue', nw: 'new place' },
  scene: { label: 'scene', var: '--ink', nw: 'new scene' }
};
const MH = 38;
const trunc = (l) => (l.length > 26 ? l.slice(0, 25) + '…' : l);

export default function MindMap({ project, onOpenScene }) {
  const { data, addMapNode, updateMapNode, deleteMapNode, addMapEdge, updateMapEdge, deleteMapEdge } = useData();
  const { confirm } = useUI();
  const nodes = data.map_nodes.filter((n) => n.project_id === project.id);
  const edges = data.map_edges.filter((e) => e.project_id === project.id);
  const [sel, setSel] = useState(null); // { k:'n'|'e', id }
  const [linking, setLinking] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const worldRef = useRef(null);
  const ctxRef = useRef(null);
  const ptsRef = useRef({});

  const nodeById = (id) => nodes.find((n) => n.id === id);
  const edgeById = (id) => edges.find((e) => e.id === id);
  function measure(l) {
    if (!ctxRef.current) { try { ctxRef.current = document.createElement('canvas').getContext('2d'); } catch (e) { /* ignore */ } }
    const fam = getComputedStyle(document.documentElement).getPropertyValue('--type') || 'monospace';
    if (ctxRef.current) { ctxRef.current.font = '400 13px ' + fam; return Math.max(96, Math.round(ctxRef.current.measureText(trunc(l)).width + 34)); }
    return Math.max(96, l.length * 8 + 34);
  }

  function svgRect() { return svgRef.current.getBoundingClientRect(); }
  function toWorld(cx, cy) { const r = svgRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; }

  function fit() {
    if (!nodes.length || !svgRef.current) return;
    const r = svgRect();
    if (!r.width) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    nodes.forEach((n) => { const w = measure(n.label) / 2; x0 = Math.min(x0, n.x - w); x1 = Math.max(x1, n.x + w); y0 = Math.min(y0, n.y - MH / 2 - 18); y1 = Math.max(y1, n.y + MH / 2); });
    const pad = 24;
    const k = Math.min((r.width - pad * 2) / (x1 - x0 || 1), (r.height - pad * 2) / (y1 - y0 || 1), 1.3);
    setView({ k, x: r.width / 2 - ((x0 + x1) / 2) * k, y: r.height / 2 - ((y0 + y1) / 2) * k });
  }
  useEffect(() => { fit(); /* eslint-disable-next-line */ }, [project.id]);

  function geom(e) {
    const a = nodeById(e.a), b = nodeById(e.b);
    if (!a || !b) return null;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const cx = mx - (dy / len) * 16, cy = my + (dx / len) * 16;
    return { d: `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`, lx: 0.25 * a.x + 0.5 * cx + 0.25 * b.x, ly: 0.25 * a.y + 0.5 * cy + 0.25 * b.y };
  }

  function zoomAt(cx, cy, f) {
    setView((v) => {
      const r = svgRect(), k = Math.max(0.35, Math.min(2.6, v.k * f));
      const wx = (cx - r.left - v.x) / v.k, wy = (cy - r.top - v.y) / v.k;
      return { k, x: cx - r.left - wx * k, y: cy - r.top - wy * k };
    });
  }

  function tapNode(id) {
    if (linking && linking !== id) {
      const dup = edges.some((e) => (e.a === linking && e.b === id) || (e.a === id && e.b === linking));
      if (!dup) { const row = addMapEdge(project.id, linking, id, ''); setLinking(null); if (row) setSel({ k: 'e', id: row.id }); return; }
      setLinking(null); setSel({ k: 'n', id }); return;
    }
    setLinking(null); setSel({ k: 'n', id });
  }

  function onPointerDown(e) {
    const target = e.target;
    ptsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const count = Object.keys(ptsRef.current).length;
    if (count === 2) {
      const ks = Object.keys(ptsRef.current), a = ptsRef.current[ks[0]], b = ptsRef.current[ks[1]];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const r = svgRect();
      setDrag({ t: 'pinch', d0, k0: view.k, wx: (mx - r.left - view.x) / view.k, wy: (my - r.top - view.y) / view.k });
      return;
    }
    if (count > 2) return;
    const tn = target.closest('[data-node]');
    const te = target.closest('[data-edge]');
    if (tn) { const n = nodeById(tn.getAttribute('data-node')); const w = toWorld(e.clientX, e.clientY); setDrag({ t: 'node', id: n.id, ox: n.x - w.x, oy: n.y - w.y, sx: e.clientX, sy: e.clientY, moved: false, x: n.x, y: n.y }); }
    else if (te) setDrag({ t: 'edge', id: te.getAttribute('data-edge'), sx: e.clientX, sy: e.clientY, moved: false });
    else setDrag({ t: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false });
  }
  function onPointerMove(e) {
    if (!ptsRef.current[e.pointerId]) return;
    ptsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!drag) return;
    if (drag.t === 'pinch') {
      const ks = Object.keys(ptsRef.current);
      if (ks.length < 2) return;
      const a = ptsRef.current[ks[0]], b = ptsRef.current[ks[1]];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, k = Math.max(0.35, Math.min(2.6, drag.k0 * d / drag.d0));
      const r = svgRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      setView({ k, x: mx - r.left - drag.wx * k, y: my - r.top - drag.wy * k });
      return;
    }
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    if (drag.t === 'node') { const w = toWorld(e.clientX, e.clientY); drag.x = w.x + drag.ox; drag.y = w.y + drag.oy; setDrag({ ...drag }); }
    else if (drag.t === 'pan') setView((v) => ({ ...v, x: drag.vx + dx, y: drag.vy + dy }));
  }
  function onPointerUp(e) {
    delete ptsRef.current[e.pointerId];
    const was = drag;
    if (!was) return;
    if (was.t === 'pinch') { if (Object.keys(ptsRef.current).length < 2) setDrag(null); return; }
    setDrag(null);
    if (was.moved) {
      if (was.t === 'node') updateMapNode(was.id, { x: was.x, y: was.y });
      return;
    }
    if (was.t === 'node') tapNode(was.id);
    else if (was.t === 'edge') { setLinking(null); setSel({ k: 'e', id: was.id }); }
    else { setLinking(null); setSel(null); }
  }

  function addNode(type) {
    const r = svgRect();
    const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const row = addMapNode(project.id, { kind: type, label: TYPE[type].nw, x: c.x + (Math.random() * 60 - 30), y: c.y + (Math.random() * 60 - 30) });
    setLinking(null); setSel({ k: 'n', id: row.id });
  }
  async function del() {
    if (!sel) return;
    if (sel.k === 'n') await deleteMapNode(sel.id); else await deleteMapEdge(sel.id);
    setSel(null); setLinking(null);
  }
  function renameSel(v) {
    if (!sel) return;
    if (sel.k === 'n') updateMapNode(sel.id, { label: v }); else updateMapEdge(sel.id, { label: v });
  }
  function tidy() {
    const arr = nodes.map((n) => ({ ...n }));
    if (!arr.length) return;
    const vel = {}; arr.forEach((n) => (vel[n.id] = { x: 0, y: 0 }));
    for (let s = 0; s < 70; s++) {
      arr.forEach((a, i) => { for (let j = i + 1; j < arr.length; j++) { const b = arr[j]; const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.5, d = Math.sqrt(d2), f = 16000 / d2; const fx = dx / d * f, fy = dy / d * f; vel[a.id].x -= fx; vel[a.id].y -= fy; vel[b.id].x += fx; vel[b.id].y += fy; } });
      edges.forEach((e) => { const a = arr.find((x) => x.id === e.a), b = arr.find((x) => x.id === e.b); if (!a || !b) return; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 190) * 0.03; vel[a.id].x += dx / d * f; vel[a.id].y += dy / d * f; vel[b.id].x -= dx / d * f; vel[b.id].y -= dy / d * f; });
      let cx = 0, cy = 0; arr.forEach((n) => { cx += n.x; cy += n.y; }); cx /= arr.length; cy /= arr.length;
      arr.forEach((n) => { const v = vel[n.id]; v.x += (cx - n.x) * 0.01; v.y += (cy - n.y) * 0.01; v.x *= 0.6; v.y *= 0.6; n.x += Math.max(-12, Math.min(12, v.x)); n.y += Math.max(-12, Math.min(12, v.y)); });
    }
    arr.forEach((n) => updateMapNode(n.id, { x: n.x, y: n.y }));
    setTimeout(fit, 50);
  }

  const displayNodes = nodes.map((n) => (drag?.t === 'node' && drag.id === n.id ? { ...n, x: drag.x, y: drag.y } : n));
  const selEntry = sel ? (sel.k === 'n' ? nodeById(sel.id) : edgeById(sel.id)) : null;

  return (
    <div>
      <div className="mapbar">
        <span className="small">add</span>
        <button className="tbtn" type="button" onClick={() => addNode('idea')}>Idea</button>
        <button className="tbtn" type="button" onClick={() => addNode('character')}>Person</button>
        <button className="tbtn" type="button" onClick={() => addNode('place')}>Place</button>
        <span className="grow" />
        <button className="tbtn" type="button" onClick={tidy}>Tidy</button>
        <button className="tbtn" type="button" aria-label="Zoom out" onClick={() => { const r = svgRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.25); }}>−</button>
        <button className="tbtn" type="button" aria-label="Zoom in" onClick={() => { const r = svgRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); }}>+</button>
        <button className="tbtn" type="button" onClick={fit}>Fit</button>
      </div>
      <div className="mapwrap">
        <svg ref={svgRef} className="mapSvg" role="application" aria-label="Mind map canvas"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onWheel={(e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1); }}>
          <g ref={worldRef} transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {edges.map((e) => { const g = geom(e); if (!g) return null; const s = sel?.k === 'e' && sel.id === e.id; return (
              <g key={e.id} data-edge={e.id}>
                <path d={g.d} fill="none" stroke="transparent" strokeWidth="20" />
                <path d={g.d} fill="none" stroke={s ? 'var(--red)' : 'var(--pencil)'} strokeWidth={s ? 2.4 : 1.4} strokeLinecap="round" />
              </g>
            ); })}
            {edges.filter((e) => e.label).map((e) => { const g = geom(e); if (!g) return null; return (
              <text key={'l' + e.id} className="elabel" x={g.lx} y={g.ly + 5} data-edge={e.id}>{e.label}</text>
            ); })}
            {displayNodes.map((n) => {
              const w = measure(n.label), s = sel?.k === 'n' && sel.id === n.id, lk = linking === n.id;
              const tag = TYPE[n.kind]?.label || 'idea';
              return (
                <g key={n.id} className="node" data-node={n.id} transform={`translate(${n.x - w / 2} ${n.y - MH / 2})`}>
                  <text className="ntype" x="0" y="-5">{tag}</text>
                  <rect width={w} height={MH} fill="var(--card)" stroke={s || lk ? 'var(--red)' : 'var(--edge)'} strokeWidth={s || lk ? 2 : 1} strokeDasharray={lk ? '4 3' : undefined} />
                  <rect width="5" height={MH} fill={`var(${TYPE[n.kind]?.var || '--pencil'})`} />
                  <text className="nlabel" x="15" y={MH / 2 + 4.5}>{trunc(n.label)}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      {sel && (
        <div className="insp">
          <span className="small">{sel.k === 'n' ? (TYPE[selEntry?.kind]?.label || 'idea') : 'link'}</span>
          <input value={selEntry?.label || ''} placeholder={sel.k === 'n' ? 'Name' : "What connects them?"} onChange={(e) => renameSel(e.target.value)} />
          {sel.k === 'n' && <button className="tbtn" type="button" onClick={() => setLinking(sel.id)}>Link to…</button>}
          <button className="tbtn" type="button" onClick={del}>Delete</button>
        </div>
      )}
      <p className="pencil hint">{linking ? 'now tap the node you want to connect it to.' : 'drag a node to move it. tap one to edit or link it. pinch or scroll to zoom.'}</p>
    </div>
  );
}
