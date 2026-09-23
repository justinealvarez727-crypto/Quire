import { useEffect, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';
import Write from './Write.jsx';
import Outline from './Outline.jsx';
import Bible from './Bible.jsx';
import MindMap from './MindMap.jsx';
import Research from './Research.jsx';
import ProgressTab from './ProgressTab.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { download, orderedScenes } from '../lib/util.js';
import { htmlToPlain } from '../lib/richtext.js';

const TABS = [
  ['write', 'Write'], ['outline', 'Outline'], ['bible', 'Bible'],
  ['map', 'Map'], ['research', 'Research'], ['progress', 'Progress']
];

export default function ProjectShell({ projectId, onBack }) {
  const { data, updateProject, deleteProject, saveState } = useData();
  const { notify, confirm } = useUI();
  const project = data.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState('write');
  const [sceneId, setSceneId] = useState(null);
  const [focus, setFocus] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!project) return;
    const ordered = orderedScenes(data, project.id);
    if (!ordered.some((s) => s.id === sceneId)) setSceneId(ordered[0]?.id || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, data.chapters, data.scenes]);

  if (!project) return null;

  async function removeProject() {
    const ok = await confirm(`Delete “${project.title || 'Untitled novel'}” and everything in it? This can’t be undone.`, 'Delete novel');
    if (ok) { await deleteProject(project.id); onBack(); }
  }
  function exportManuscript() {
    const chapters = data.chapters.filter((c) => c.project_id === project.id).sort((a, b) => a.position - b.position);
    const out = [project.title || 'Untitled novel', ''];
    chapters.forEach((c) => {
      out.push('', c.title || 'Untitled chapter', '');
      const scenes = data.scenes.filter((s) => s.chapter_id === c.id).sort((a, b) => a.position - b.position);
      scenes.forEach((s, i) => { if (i > 0) out.push('', '*   *   *', ''); out.push(htmlToPlain(s.text).trim()); });
    });
    const slug = (project.title || 'novel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'novel';
    download(slug + '.txt', out.join('\n') + '\n');
    notify('Manuscript downloaded.');
  }

  const ordered = orderedScenes(data, project.id);

  return (
    <div className="app shell">
      {!focus && (
        <div style={{ gridColumn: '1/-1' }} className="shellHead">
          <button className="back" type="button" onClick={onBack}>‹ Novels</button>
          <input value={project.title} placeholder="Novel title" onChange={(e) => updateProject(project.id, { title: e.target.value })}
            style={{ flex: 1, border: 0, background: 'transparent', font: '700 17px var(--type)', color: 'var(--ink)', minWidth: 0 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={'saveTag' + (saveState === 'error' ? ' bad' : '')}>
              {saveState === 'error' ? 'Couldn\u2019t save' : saveState === 'saving' ? 'Saving…' : 'Saved'}
            </span>
            <button className="link" type="button" onClick={() => setShowSettings(true)}>Aa</button>
          </span>
        </div>
      )}

      {!focus && (
        <nav className="sideNav" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-current={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
          <hr style={{ border: 0, borderTop: '1px solid var(--edge)', margin: '10px 0' }} />
          <button type="button" onClick={exportManuscript}>Export .txt</button>
          <button type="button" onClick={removeProject} style={{ color: 'var(--red)' }}>Delete novel</button>
        </nav>
      )}

      <main className="shellMain" style={focus ? { gridColumn: '1/-1' } : undefined}>
        {showSettings ? (
          <div>
            <div className="sheetHead" style={{ marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>Settings</h2>
              <button className="tbtn" type="button" onClick={() => setShowSettings(false)}>Back</button>
            </div>
            <SettingsPanel />
          </div>
        ) : (
          <>
            {tab === 'write' && (
              <div>
                {!focus && ordered.length > 0 && (
                  <select value={sceneId || ''} onChange={(e) => setSceneId(e.target.value)}
                    style={{ margin: '10px 2px', border: '1px solid var(--edge)', background: 'var(--card)', padding: '8px 10px', fontFamily: 'var(--type)', fontSize: 13, maxWidth: '100%' }}>
                    {data.chapters.filter((c) => c.project_id === project.id).sort((a, b) => a.position - b.position).map((c) => (
                      <optgroup key={c.id} label={c.title || 'Untitled chapter'}>
                        {data.scenes.filter((s) => s.chapter_id === c.id).sort((a, b) => a.position - b.position).map((s) => (
                          <option key={s.id} value={s.id}>{s.title || 'Untitled scene'}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <Write project={project} sceneId={sceneId} onFocusChange={setFocus} />
              </div>
            )}
            {tab === 'outline' && <Outline project={project} onOpenScene={(id) => { setSceneId(id); setTab('write'); }} />}
            {tab === 'bible' && <Bible project={project} />}
            {tab === 'map' && <MindMap project={project} onOpenScene={(id) => { setSceneId(id); setTab('write'); }} />}
            {tab === 'research' && <Research project={project} />}
            {tab === 'progress' && <ProgressTab project={project} />}
          </>
        )}
      </main>

      {!focus && !showSettings && (
        <nav id="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" aria-current={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
