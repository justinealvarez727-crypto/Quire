import { useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';
import { sortBy } from '../lib/util.js';

const KIND_LABEL = { character: 'Person', place: 'Place', plot: 'Timeline event' };

function ScenePresence({ project, entryId }) {
  const { data, toggleLink } = useData();
  const scenes = sortBy(data.scenes.filter((s) => s.project_id === project.id), 'position');
  const linked = new Set(data.scene_links.filter((l) => l.entry_id === entryId).map((l) => l.scene_id));
  if (!scenes.length) return null;
  return (
    <div className="pres" aria-label="Appears in scenes">
      <span className="small" style={{ marginRight: 4 }}>in scenes</span>
      {scenes.map((s, i) => (
        <button key={s.id} type="button" className={linked.has(s.id) ? 'on' : ''} title={s.title}
          onClick={() => toggleLink(s.id, entryId)}>{i + 1}</button>
      ))}
    </div>
  );
}

function CharacterCard({ project, entry }) {
  const { updateEntry, deleteEntry } = useData();
  const { confirm } = useUI();
  const f = entry.fields || {};
  const set = (k, v) => updateEntry(entry.id, { fields: { ...f, [k]: v } });
  async function del() { if (await confirm(`Delete “${entry.name || 'Untitled'}”? This can’t be undone.`, 'Delete')) deleteEntry(entry.id); }
  return (
    <div className="big">
      <input className="name" value={entry.name} placeholder="Name" onChange={(e) => updateEntry(entry.id, { name: e.target.value })} />
      <div className="fld"><label>bio</label><textarea rows={2} value={f.bio || ''} onChange={(e) => set('bio', e.target.value)} placeholder="Who they are." /></div>
      <div className="fld"><label>arc</label><textarea rows={2} value={f.arc || ''} onChange={(e) => set('arc', e.target.value)} placeholder="How they change." /></div>
      <div className="fld"><label>relationships</label><textarea rows={2} value={f.relationships || ''} onChange={(e) => set('relationships', e.target.value)} placeholder="Who they're tied to." /></div>
      <ScenePresence project={project} entryId={entry.id} />
      <p style={{ marginTop: 8 }}><button className="link danger" type="button" onClick={del}>Delete</button></p>
    </div>
  );
}
function PlaceCard({ project, entry }) {
  const { updateEntry, deleteEntry } = useData();
  const { confirm } = useUI();
  const f = entry.fields || {};
  const set = (k, v) => updateEntry(entry.id, { fields: { ...f, [k]: v } });
  async function del() { if (await confirm(`Delete “${entry.name || 'Untitled'}”? This can’t be undone.`, 'Delete')) deleteEntry(entry.id); }
  return (
    <div className="big">
      <input className="name" value={entry.name} placeholder="Name" onChange={(e) => updateEntry(entry.id, { name: e.target.value })} />
      <div className="fld"><label>description</label><textarea rows={2} value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="What it looks, sounds, feels like." /></div>
      <div className="fld"><label>lore</label><textarea rows={2} value={f.lore || ''} onChange={(e) => set('lore', e.target.value)} placeholder="History, rules, world-building." /></div>
      <ScenePresence project={project} entryId={entry.id} />
      <p style={{ marginTop: 8 }}><button className="link danger" type="button" onClick={del}>Delete</button></p>
    </div>
  );
}

function Timeline({ project }) {
  const { data, addEntry, updateEntry, deleteEntry } = useData();
  const { confirm } = useUI();
  const items = sortBy(data.entries.filter((e) => e.project_id === project.id && e.kind === 'plot'), 'created_at');
  const scenes = sortBy(data.scenes.filter((s) => s.project_id === project.id), 'position');
  const links = data.scene_links;
  async function del(id, name) { if (await confirm(`Delete “${name || 'Untitled event'}”? This can’t be undone.`, 'Delete')) deleteEntry(id); }
  return (
    <div className="roll">
      {items.map((it) => {
        const linkedScenes = links.filter((l) => l.entry_id === it.id).map((l) => scenes.findIndex((s) => s.id === l.scene_id) + 1).filter((n) => n > 0).sort((a, b) => a - b);
        return (
          <div key={it.id} style={{ borderBottom: '1px dotted var(--pencil)', paddingBottom: 6, marginBottom: 6 }}>
            <div className="ev" style={{ border: 0, padding: '8px 0 2px' }}>
              <input className="when" value={it.fields?.when_label || ''} placeholder="when" onChange={(e) => updateEntry(it.id, { fields: { ...it.fields, when_label: e.target.value } })} />
              <textarea className="summary" rows={2} value={it.name} placeholder="What happens" onChange={(e) => updateEntry(it.id, { name: e.target.value })} />
              <span className="ref">
                {linkedScenes.length ? '→ ' + linkedScenes.join(', ') : ''}
                <button className="link danger" type="button" style={{ display: 'block', fontSize: 11 }} onClick={() => del(it.id, it.name)}>delete</button>
              </span>
            </div>
            <ScenePresence project={project} entryId={it.id} />
          </div>
        );
      })}
      {!items.length && <p className="small" style={{ padding: '8px 0' }}>No events yet.</p>}
      <p style={{ marginTop: 10 }}>
        <button className="link" type="button" onClick={() => addEntry(project.id, 'plot', { when_label: '' })}>+ Add event</button>
      </p>
    </div>
  );
}

export default function Bible({ project }) {
  const { data, addEntry } = useData();
  const [tab, setTab] = useState('people');
  const people = sortBy(data.entries.filter((e) => e.project_id === project.id && e.kind === 'character'), 'created_at');
  const places = sortBy(data.entries.filter((e) => e.project_id === project.id && e.kind === 'place'), 'created_at');

  return (
    <div>
      <div className="mode" role="group" aria-label="Bible sections">
        <button type="button" aria-pressed={tab === 'people'} onClick={() => setTab('people')}>People</button>
        <button type="button" aria-pressed={tab === 'places'} onClick={() => setTab('places')}>Places</button>
        <button type="button" aria-pressed={tab === 'time'} onClick={() => setTab('time')}>Timeline</button>
      </div>
      {tab === 'people' && (
        <>
          {people.map((e) => <CharacterCard key={e.id} project={project} entry={e} />)}
          <p><button className="btn" type="button" onClick={() => addEntry(project.id, 'character')}>+ Add character</button></p>
        </>
      )}
      {tab === 'places' && (
        <>
          {places.map((e) => <PlaceCard key={e.id} project={project} entry={e} />)}
          <p><button className="btn" type="button" onClick={() => addEntry(project.id, 'place')}>+ Add place</button></p>
        </>
      )}
      {tab === 'time' && <Timeline project={project} />}
    </div>
  );
}
