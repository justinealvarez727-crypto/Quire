import { useData } from '../lib/DataContext.jsx';
import { computeStats, fmt } from '../lib/util.js';

export default function Dashboard({ onOpen, onSettings }) {
  const { data, addProject } = useData();
  const projects = [...data.projects].sort((a, b) => a.position - b.position);

  async function create() {
    const row = await addProject('Untitled novel');
    onOpen(row.id);
  }

  return (
    <div className="app">
      <div className="dashHead">
        <h1>Quire</h1>
        <button className="link" type="button" onClick={onSettings}>Settings</button>
      </div>
      {!projects.length && (
        <p className="small" style={{ margin: '20px 2px' }}>
          Nothing here yet. Start a new novel to begin.
        </p>
      )}
      <div className="dashGrid">
        {projects.map((p) => {
          const st = computeStats(p, data);
          const pct = st.bookGoal ? Math.min(100, Math.round((st.bookDone / st.bookGoal) * 100)) : 0;
          return (
            <button key={p.id} className="projCard" type="button" onClick={() => onOpen(p.id)}>
              <h3>{p.title || 'Untitled novel'}</h3>
              <span className="small">
                {st.unit === 'words' ? `${fmt(st.words)} words` : `${fmt(Math.round(st.secAll / 60))} min written`}
                {' · '}{pct}% to goal
              </span>
              <div className="bar"><i style={{ width: pct + '%' }} /></div>
            </button>
          );
        })}
        <button className="projCard newProj" type="button" onClick={create}>+ New novel</button>
      </div>
    </div>
  );
}
