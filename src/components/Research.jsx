import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { useUI } from './ui.jsx';
import { sortBy } from '../lib/util.js';

function Pin({ item, onDelete }) {
  const { researchImageUrl } = useData();
  const [url, setUrl] = useState('');
  const rot = useRef((Math.random() * 3 - 1.5).toFixed(1));
  useEffect(() => { if (item.kind === 'image' && item.image_path) researchImageUrl(item.image_path).then(setUrl).catch(() => {}); }, [item]);
  return (
    <div className="pin" style={{ '--rot': rot.current + 'deg' }}>
      <button className="x" type="button" aria-label="Delete" onClick={onDelete}>×</button>
      {item.kind === 'image' && url && <img src={url} alt={item.title || 'Reference image'} />}
      {item.title && <div className="t">{item.title}</div>}
      {item.kind === 'link' && item.url && <a href={item.url} target="_blank" rel="noreferrer" className="small" style={{ display: 'block', wordBreak: 'break-all' }}>{item.url}</a>}
      {item.body && <div className="b">{item.body}</div>}
    </div>
  );
}

export default function Research({ project }) {
  const { data, addResearchItem, deleteResearchItem, uploadResearchImage } = useData();
  const { notify, confirm } = useUI();
  const [open, setOpen] = useState(null); // 'note' | 'link' | null
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const fileRef = useRef(null);
  const items = sortBy(data.research_items.filter((r) => r.project_id === project.id), 'position').reverse();

  function reset() { setOpen(null); setTitle(''); setBody(''); setUrl(''); }
  function submit(e) {
    e.preventDefault();
    if (open === 'note') addResearchItem(project.id, { kind: 'note', title, body });
    else if (open === 'link') addResearchItem(project.id, { kind: 'link', title, url });
    reset();
  }
  async function pickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const path = await uploadResearchImage(project.id, file);
      addResearchItem(project.id, { kind: 'image', image_path: path, title: file.name.replace(/\.[^.]+$/, '') });
    } catch (err) { notify('Couldn\u2019t add that image.'); }
  }
  async function del(item) {
    if (await confirm(`Remove this from your board? This can’t be undone.`, 'Remove')) deleteResearchItem(item.id);
  }

  return (
    <div>
      <div className="mode" role="group" aria-label="Add to board">
        <button type="button" onClick={() => setOpen('note')}>+ Note</button>
        <button type="button" onClick={() => setOpen('link')}>+ Link</button>
        <button type="button" onClick={() => fileRef.current?.click()}>+ Image</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
      </div>
      {open && (
        <form className="rform" onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" autoFocus />
          {open === 'note' && <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Note" />}
          {open === 'link' && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" />}
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" type="submit">Add</button>
            <button className="btn" type="button" onClick={reset}>Cancel</button>
          </span>
        </form>
      )}
      <div className="board">
        {items.map((it) => <Pin key={it.id} item={it} onDelete={() => del(it)} />)}
      </div>
      {!items.length && !open && <p className="small" style={{ marginTop: 14 }}>Pin notes, reference links, and images here as you research.</p>}
    </div>
  );
}
