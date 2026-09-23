import { supabase } from './supabase.js';

/* One small data interface with two backends:
   - Supabase (Postgres + Storage) when keys are configured
   - browser storage otherwise ("this device" mode) */

const LK = 'quire:';
const IMG_BUCKET = 'research';

/* ---------------- local backend ---------------- */
const readT = (t) => {
  try { return JSON.parse(localStorage.getItem(LK + 't:' + t) || '[]'); } catch (e) { return []; }
};
const writeT = (t, rows) => localStorage.setItem(LK + 't:' + t, JSON.stringify(rows));
const pick = (row, select) => {
  if (!select || select === '*') return row;
  const o = {};
  select.split(',').forEach((c) => { c = c.trim(); if (c in row) o[c] = row[c]; });
  return o;
};
const CHILDREN = {
  projects: [['chapters', 'project_id'], ['scenes', 'project_id'], ['sessions', 'project_id'], ['entries', 'project_id'],
    ['map_nodes', 'project_id'], ['map_edges', 'project_id'], ['research_items', 'project_id']],
  chapters: [['scenes', 'chapter_id']],
  scenes: [['scene_links', 'scene_id']],
  entries: [['scene_links', 'entry_id']],
  map_nodes: [['map_edges', 'a'], ['map_edges', 'b']]
};
function removeLocal(t, id) {
  (CHILDREN[t] || []).forEach(([ct, col]) => {
    readT(ct).filter((r) => r[col] === id).forEach((r) => removeLocal(ct, r.id));
  });
  writeT(t, readT(t).filter((r) => r.id !== id));
}

function localStore() {
  return {
    local: true,
    async list(table, { eq = {}, gte = {}, select } = {}) {
      return readT(table)
        .filter((r) => Object.entries(eq).every(([k, v]) => r[k] === v))
        .filter((r) => Object.entries(gte).every(([k, v]) => String(r[k] ?? '') >= v))
        .map((r) => pick(r, select));
    },
    async get(table, id, select) {
      const r = readT(table).find((x) => x.id === id);
      return r ? pick(r, select) : null;
    },
    async insert(table, row) { writeT(table, [...readT(table), row]); },
    async update(table, id, changes) {
      writeT(table, readT(table).map((r) => (r.id === id ? { ...r, ...changes } : r)));
    },
    async upsert(table, row, conflict = 'id') {
      const rows = readT(table);
      const i = rows.findIndex((r) => r[conflict] === row[conflict]);
      if (i >= 0) rows[i] = { ...rows[i], ...row }; else rows.push(row);
      writeT(table, rows);
    },
    async remove(table, id) { removeLocal(table, id); },
    async putImage(path, blob) {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(blob);
      });
      localStorage.setItem(LK + 'img:' + path, dataUrl);
    },
    async imageUrl(path) { return localStorage.getItem(LK + 'img:' + path) || ''; },
    async delImage(path) { localStorage.removeItem(LK + 'img:' + path); }
  };
}

/* ---------------- supabase backend ---------------- */
function remoteStore() {
  const check = ({ data, error }) => { if (error) throw error; return data; };
  return {
    local: false,
    async list(table, { eq = {}, gte = {}, select = '*' } = {}) {
      const out = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        let q = supabase.from(table).select(select).order('id').range(from, from + size - 1);
        Object.entries(eq).forEach(([k, v]) => { q = q.eq(k, v); });
        Object.entries(gte).forEach(([k, v]) => { q = q.gte(k, v); });
        const rows = check(await q);
        out.push(...rows);
        if (rows.length < size) break;
      }
      return out;
    },
    async get(table, id, select = '*') {
      return check(await supabase.from(table).select(select).eq('id', id).maybeSingle());
    },
    async insert(table, row) { check(await supabase.from(table).insert(row)); },
    async update(table, id, changes) { check(await supabase.from(table).update(changes).eq('id', id)); },
    async upsert(table, row, conflict = 'id') {
      check(await supabase.from(table).upsert(row, { onConflict: conflict }));
    },
    async remove(table, id) { check(await supabase.from(table).delete().eq('id', id)); },
    async putImage(path, blob) {
      const { error } = await supabase.storage.from(IMG_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
    },
    async imageUrl(path) {
      const { data, error } = await supabase.storage.from(IMG_BUCKET).createSignedUrl(path, 60 * 60 * 6);
      if (error) throw error;
      return data.signedUrl;
    },
    async delImage(path) { await supabase.storage.from(IMG_BUCKET).remove([path]); }
  };
}

export function createStore() {
  return supabase ? remoteStore() : localStore();
}
