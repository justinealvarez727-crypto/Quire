import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createStore } from './store.js';
import { useAuth } from './AuthContext.jsx';
import { uid, wc, ymd, resizeImage } from './util.js';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

const TABLES = ['projects', 'chapters', 'scenes', 'entries', 'scene_links', 'map_nodes', 'map_edges', 'research_items', 'sessions'];
const EMPTY = Object.fromEntries(TABLES.map((t) => [t, []]));

export function DataProvider({ children }) {
  const { user } = useAuth();
  const store = useMemo(() => createStore(), []);
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [saveState, setSaveState] = useState('idle'); // idle | saving | error
  const pending = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    setStatus('loading');
    try {
      const eq = store.local ? {} : { user_id: user.id };
      const projects = await store.list('projects', { eq });
      const ids = projects.map((p) => p.id);
      const inIds = (rows) => rows.filter((r) => ids.includes(r.project_id));
      const rest = await Promise.all(
        ['chapters', 'scenes', 'entries', 'map_nodes', 'map_edges', 'research_items', 'sessions'].map((t) =>
          store.local ? store.list(t) : store.list(t)
        )
      );
      const byTable = Object.fromEntries(
        ['chapters', 'scenes', 'entries', 'map_nodes', 'map_edges', 'research_items', 'sessions'].map((t, i) => [t, inIds(rest[i])])
      );
      const sceneIds = byTable.scenes.map((s) => s.id);
      const allLinks = await store.list('scene_links');
      const scene_links = allLinks.filter((l) => sceneIds.includes(l.scene_id));
      setData({ projects, scene_links, ...byTable });
      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }, [user, store]);

  useEffect(() => { load(); }, [load]);

  function track(p) {
    pending.current++;
    setSaveState('saving');
    p.then(
      () => { pending.current--; if (pending.current <= 0) { pending.current = 0; setSaveState('idle'); } },
      (e) => { console.error(e); pending.current = Math.max(0, pending.current - 1); setSaveState('error'); }
    );
    return p;
  }
  const patch = (table, id, changes) =>
    setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? { ...r, ...changes } : r)) }));
  const addRow = (table, row) => setData((d) => ({ ...d, [table]: [...d[table], row] }));
  const dropRow = (table, id) => setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }));
  const dropWhere = (table, fn) => setData((d) => ({ ...d, [table]: d[table].filter((r) => !fn(r)) }));

  /* ---------------- projects ---------------- */
  async function addProject(title) {
    const row = {
      id: uid(), user_id: user.id, title: title || 'Untitled novel', goal_type: 'words', period: 'daily',
      period_goal: 500, book_goal: 80000, outline_mode: 'loose', position: data.projects.length, created_at: new Date().toISOString()
    };
    addRow('projects', row);
    await track(store.insert('projects', row));
    addChapter(row.id); // seed a first chapter + scene so Write/Outline aren't empty
    return row;
  }
  function updateProject(id, changes) { patch('projects', id, changes); track(store.update('projects', id, changes)); }
  async function deleteProject(id) {
    dropRow('projects', id);
    dropWhere('chapters', (r) => r.project_id === id);
    dropWhere('scenes', (r) => r.project_id === id);
    dropWhere('entries', (r) => r.project_id === id);
    dropWhere('map_nodes', (r) => r.project_id === id);
    dropWhere('map_edges', (r) => r.project_id === id);
    dropWhere('research_items', (r) => r.project_id === id);
    dropWhere('sessions', (r) => r.project_id === id);
    await track(store.remove('projects', id));
  }

  /* ---------------- chapters / scenes ---------------- */
  function addChapter(projectId) {
    const pos = data.chapters.filter((c) => c.project_id === projectId).length;
    const row = { id: uid(), project_id: projectId, title: `Chapter ${pos + 1}`, position: pos };
    addRow('chapters', row);
    track(store.insert('chapters', row));
    addScene(row.id, projectId, false);
    return row;
  }
  function updateChapter(id, changes) { patch('chapters', id, changes); track(store.update('chapters', id, changes)); }
  async function deleteChapter(id) {
    const scenes = data.scenes.filter((s) => s.chapter_id === id).map((s) => s.id);
    dropWhere('scene_links', (l) => scenes.includes(l.scene_id));
    dropWhere('scenes', (s) => s.chapter_id === id);
    dropRow('chapters', id);
    await track(store.remove('chapters', id));
  }
  function addScene(chapterId, projectId, track_ = true) {
    const pos = data.scenes.filter((s) => s.chapter_id === chapterId).length;
    const row = {
      id: uid(), project_id: projectId, chapter_id: chapterId, title: 'Untitled scene', text: '',
      word_count: 0, status: 'draft', beat_three: null, beat_stc: null, position: pos, updated_at: new Date().toISOString()
    };
    addRow('scenes', row);
    if (track_) track(store.insert('scenes', row));
    return row;
  }
  function updateScene(id, changes) {
    const next = { ...changes, updated_at: new Date().toISOString() };
    patch('scenes', id, next);
    track(store.update('scenes', id, next));
  }
  async function deleteScene(id) {
    dropWhere('scene_links', (l) => l.scene_id === id);
    dropRow('scenes', id);
    await track(store.remove('scenes', id));
  }
  function reorderScenes(rows) {
    // rows: [{id, chapter_id, position, beat_three?, beat_stc?}]
    setData((d) => ({
      ...d,
      scenes: d.scenes.map((s) => {
        const r = rows.find((x) => x.id === s.id);
        return r ? { ...s, ...r } : s;
      })
    }));
    rows.forEach((r) => track(store.update('scenes', r.id, r)));
  }
  function reorderChapters(rows) {
    setData((d) => ({ ...d, chapters: d.chapters.map((c) => { const r = rows.find((x) => x.id === c.id); return r ? { ...c, ...r } : c; }) }));
    rows.forEach((r) => track(store.update('chapters', r.id, { position: r.position })));
  }

  /* ---------------- story bible ---------------- */
  function addEntry(projectId, kind, fields = {}) {
    const row = { id: uid(), project_id: projectId, kind, name: '', fields, created_at: new Date().toISOString() };
    addRow('entries', row);
    track(store.insert('entries', row));
    return row;
  }
  function updateEntry(id, changes) { patch('entries', id, changes); track(store.update('entries', id, changes)); }
  async function deleteEntry(id) {
    dropWhere('scene_links', (l) => l.entry_id === id);
    dropWhere('map_nodes', (n) => n.entry_id === id);
    dropRow('entries', id);
    await track(store.remove('entries', id));
  }
  function toggleLink(sceneId, entryId) {
    const existing = data.scene_links.find((l) => l.scene_id === sceneId && l.entry_id === entryId);
    if (existing) {
      dropRow('scene_links', existing.id);
      track(store.remove('scene_links', existing.id));
    } else {
      const row = { id: uid(), scene_id: sceneId, entry_id: entryId };
      addRow('scene_links', row);
      track(store.insert('scene_links', row));
    }
  }

  /* ---------------- mind map ---------------- */
  function addMapNode(projectId, node) {
    const row = { id: uid(), project_id: projectId, kind: 'idea', label: '', x: 0, y: 0, entry_id: null, scene_id: null, ...node };
    addRow('map_nodes', row);
    track(store.insert('map_nodes', row));
    return row;
  }
  function updateMapNode(id, changes) { patch('map_nodes', id, changes); track(store.update('map_nodes', id, changes)); }
  async function deleteMapNode(id) {
    dropWhere('map_edges', (e) => e.a === id || e.b === id);
    dropRow('map_nodes', id);
    await track(store.remove('map_nodes', id));
  }
  function addMapEdge(projectId, a, b, label = '') {
    if (a === b) return null;
    if (data.map_edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return null;
    const row = { id: uid(), project_id: projectId, a, b, label };
    addRow('map_edges', row);
    track(store.insert('map_edges', row));
    return row;
  }
  function updateMapEdge(id, changes) { patch('map_edges', id, changes); track(store.update('map_edges', id, changes)); }
  async function deleteMapEdge(id) { dropRow('map_edges', id); await track(store.remove('map_edges', id)); }

  /* ---------------- research ---------------- */
  function addResearchItem(projectId, item) {
    const pos = data.research_items.filter((r) => r.project_id === projectId).length;
    const row = { id: uid(), project_id: projectId, kind: 'note', title: '', body: '', url: null, image_path: null, position: pos, created_at: new Date().toISOString(), ...item };
    addRow('research_items', row);
    track(store.insert('research_items', row));
    return row;
  }
  function updateResearchItem(id, changes) { patch('research_items', id, changes); track(store.update('research_items', id, changes)); }
  async function deleteResearchItem(id) {
    const row = data.research_items.find((r) => r.id === id);
    dropRow('research_items', id);
    if (row?.image_path) await track(store.delImage(row.image_path));
    await track(store.remove('research_items', id));
  }
  async function uploadResearchImage(projectId, file) {
    const blob = await resizeImage(file);
    const path = `${user.id}/${projectId}/${uid()}.jpg`;
    await track(store.putImage(path, blob));
    return path;
  }
  async function researchImageUrl(path) { return store.imageUrl(path); }

  /* ---------------- sessions (goals & progress) ---------------- */
  function beginSession(projectId, sceneId) {
    const row = { id: uid(), project_id: projectId, scene_id: sceneId, day: ymd(), words: 0, seconds: 0, started_at: new Date().toISOString() };
    addRow('sessions', row);
    track(store.insert('sessions', row));
    return row.id;
  }
  function bumpSession(sessionId, delta) {
    setData((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, words: s.words + (delta.words || 0), seconds: s.seconds + (delta.seconds || 0) } : s))
    }));
    const cur = data.sessions.find((s) => s.id === sessionId);
    const words = (cur?.words || 0) + (delta.words || 0);
    const seconds = (cur?.seconds || 0) + (delta.seconds || 0);
    track(store.update('sessions', sessionId, { words, seconds }));
  }

  const value = {
    data, status, saveState, isLocal: store.local, reload: load,
    addProject, updateProject, deleteProject,
    addChapter, updateChapter, deleteChapter, addScene, updateScene, deleteScene, reorderScenes, reorderChapters,
    addEntry, updateEntry, deleteEntry, toggleLink,
    addMapNode, updateMapNode, deleteMapNode, addMapEdge, updateMapEdge, deleteMapEdge,
    addResearchItem, updateResearchItem, deleteResearchItem, uploadResearchImage, researchImageUrl,
    beginSession, bumpSession, wc
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
