import { useEffect, useState } from 'react';
import { useData } from '../lib/DataContext.jsx';
import { computeStats, daysAgo, fmt, fmtDur, ymd } from '../lib/util.js';

function GoalField({ label, value, onCommit }) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number" inputMode="numeric" min="1" value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => { const v = parseInt(raw, 10); if (v > 0) onCommit(v); else setRaw(String(value)); }}
      />
    </label>
  );
}

export default function ProgressTab({ project }) {
  const { data, updateProject } = useData();
  const st = computeStats(project, data);
  const unit = project.goal_type === 'words' ? 'words' : 'minutes';
  const periodLabel = project.period === 'weekly' ? 'this week' : 'today';
  const periodPct = st.periodGoal ? Math.min(100, Math.round((st.periodDone / st.periodGoal) * 100)) : 0;
  const bookPct = st.bookGoal ? Math.min(100, Math.round((st.bookDone / st.bookGoal) * 100)) : 0;

  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));
  const today = ymd();
  const dayVal = (d) => {
    const p = st.perDay[d];
    if (!p) return 0;
    return project.goal_type === 'words' ? Math.max(0, p.words) : Math.round(p.seconds / 60);
  };
  const goalDay = project.period === 'weekly' ? Math.round(project.period_goal / 7) : project.period_goal;

  return (
    <div className="contents">
      <h2>Today's goal</h2>
      <p className="lead"><span>{project.period === 'weekly' ? 'This week' : 'Today'}</span><i /><b>{fmt(st.periodDone)} of {fmt(st.periodGoal)} {unit}</b></p>
      <div className="bar"><i style={{ width: periodPct + '%' }} /></div>

      <h2>Manuscript</h2>
      <p className="lead"><span>Total</span><i /><b>{fmt(st.bookDone)} of {fmt(st.bookGoal)} {unit}, {bookPct}%</b></p>
      <div className="bar"><i style={{ width: bookPct + '%' }} /></div>
      {project.goal_type === 'words' && <p className="small" style={{ marginTop: 6 }}>about {fmt(st.pages)} manuscript pages, 250 words each</p>}

      <div className="block" style={{ marginTop: 22 }}>
        <p className="lead"><span>Writing time this week</span><i /><b>{fmtDur(st.secWeek)}</b></p>
        <p className="lead"><span>Sessions this week</span><i /><b>{st.sessionsWeek}</b></p>
        <p className="lead"><span>Average words per session</span><i /><b>{fmt(st.avg)}</b></p>
      </div>

      <h2>Last 14 days</h2>
      <div className="dots" role="img" aria-label="Last 14 days of writing, filled means goal met">
        {days.map((d) => {
          const v = dayVal(d);
          const cls = v >= goalDay && goalDay > 0 ? 'hit' : v > 0 ? 'some' : '';
          return <i key={d} className={cls} title={`${d}: ${fmt(v)} ${unit}`} />;
        })}
      </div>
      <p className="small">filled: goal met · ringed: wrote some · dashed: rest day</p>

      <h2>Goals</h2>
      <div className="seg" role="group" aria-label="Count by" style={{ marginBottom: 12 }}>
        <button type="button" aria-pressed={project.goal_type === 'words'} onClick={() => updateProject(project.id, { goal_type: 'words' })}>Words</button>
        <button type="button" aria-pressed={project.goal_type === 'time'} onClick={() => updateProject(project.id, { goal_type: 'time' })}>Time</button>
      </div>
      <div className="seg" role="group" aria-label="Goal period" style={{ marginBottom: 12 }}>
        <button type="button" aria-pressed={project.period !== 'weekly'} onClick={() => updateProject(project.id, { period: 'daily' })}>Daily</button>
        <button type="button" aria-pressed={project.period === 'weekly'} onClick={() => updateProject(project.id, { period: 'weekly' })}>Weekly</button>
      </div>
      <GoalField label={`${project.period === 'weekly' ? 'Weekly' : 'Daily'} goal, in ${unit}`}
        value={project.period_goal} onCommit={(v) => updateProject(project.id, { period_goal: v })} />
      <GoalField label={`Manuscript goal, in ${unit}`}
        value={project.book_goal} onCommit={(v) => updateProject(project.id, { book_goal: v })} />
    </div>
  );
}
