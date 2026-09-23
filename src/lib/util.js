export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

export const wc = (t) => {
  const m = String(t || '').match(/\S+/g);
  return m ? m.length : 0;
};
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
export const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return ymd(d);
};
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString();
export const fmtDur = (sec) => {
  const m = Math.round((sec || 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
};
export const sortBy = (a, k) => [...a].sort((x, y) => (x[k] ?? 0) - (y[k] ?? 0));

export const STATUSES = ['draft', 'revised', 'final'];
export const nextStatus = (s) => STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];

export const BEATS = {
  three: ['Act one: setup', 'Act two: confrontation', 'Act three: resolution'],
  stc: [
    'Opening image', 'Setup', 'Catalyst', 'Break into two', 'Fun and games',
    'Midpoint', 'All is lost', 'Break into three', 'Finale', 'Final image'
  ]
};

/** Scenes in manuscript order: chapters by position, scenes by position within each. */
export function orderedScenes(data, projectId) {
  const chs = sortBy(data.chapters.filter((c) => c.project_id === projectId), 'position');
  const out = [];
  chs.forEach((c) => out.push(...sortBy(data.scenes.filter((s) => s.chapter_id === c.id), 'position')));
  return out;
}

/** Everything the dashboard and Progress tab show for one novel. */
export function computeStats(project, data) {
  const scenes = data.scenes.filter((s) => s.project_id === project.id);
  const words = scenes.reduce((a, s) => a + (s.word_count || 0), 0);
  const sess = data.sessions.filter((s) => s.project_id === project.id);
  const today = ymd();
  const wk = weekStart();
  const sum = (arr, k) => arr.reduce((a, s) => a + (s[k] || 0), 0);
  const inDay = sess.filter((s) => s.day === today);
  const inWeek = sess.filter((s) => s.day >= wk);
  const wordsDay = Math.max(0, sum(inDay, 'words'));
  const wordsWeek = Math.max(0, sum(inWeek, 'words'));
  const secDay = sum(inDay, 'seconds');
  const secWeek = sum(inWeek, 'seconds');
  const secAll = sum(sess, 'seconds');
  const unit = project.goal_type === 'time' ? 'time' : 'words';
  const daily = project.period !== 'weekly';
  const periodDone = unit === 'words' ? (daily ? wordsDay : wordsWeek) : Math.round((daily ? secDay : secWeek) / 60);
  const bookDone = unit === 'words' ? words : Math.round(secAll / 60);
  const wordy = sess.filter((s) => s.words > 0);
  const avg = wordy.length ? Math.round(sum(wordy, 'words') / wordy.length) : 0;
  const perDay = {};
  sess.forEach((s) => {
    const d = (perDay[s.day] = perDay[s.day] || { words: 0, seconds: 0 });
    d.words += s.words || 0;
    d.seconds += s.seconds || 0;
  });
  return {
    words, pages: Math.round(words / 250), wordsDay, wordsWeek, secDay, secWeek, secAll,
    unit, daily, periodDone, periodGoal: project.period_goal, bookDone, bookGoal: project.book_goal,
    avg, sessionsWeek: inWeek.length, sessionsAll: sess.length, perDay
  };
}

export const unitLabel = (unit, n) => (unit === 'words' ? 'words' : 'min');

/** Downscale a picked image to keep uploads small. */
export async function resizeImage(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not read image'))), 'image/jpeg', 0.85));
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
