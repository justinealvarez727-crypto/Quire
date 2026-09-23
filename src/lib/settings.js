// One font drives the whole app.
export const FONTS = [
  ['Typewriter', 'Courier Prime', '"Courier Prime","Courier New",monospace'],
  ['Typewriter', 'IBM Plex Mono', '"IBM Plex Mono","Courier New",monospace'],
  ['Typewriter', 'Cutive Mono', '"Cutive Mono","Courier New",monospace'],
  ['Book serif', 'Literata', '"Literata",Georgia,serif'],
  ['Book serif', 'Newsreader', '"Newsreader",Georgia,serif'],
  ['Book serif', 'Lora', '"Lora",Georgia,serif'],
  ['Book serif', 'Crimson Pro', '"Crimson Pro",Georgia,serif'],
  ['Book serif', 'EB Garamond', '"EB Garamond",Georgia,serif'],
  ['Book serif', 'Libre Baskerville', '"Libre Baskerville",Georgia,serif'],
  ['Book serif', 'Source Serif 4', '"Source Serif 4",Georgia,serif'],
  ['Book serif', 'Merriweather', '"Merriweather",Georgia,serif'],
  ['Book serif', 'Spectral', '"Spectral",Georgia,serif'],
  ['Book serif', 'Bitter', '"Bitter",Georgia,serif'],
  ['Easy reading', 'Atkinson Hyperlegible', '"Atkinson Hyperlegible",system-ui,sans-serif'],
  ['Easy reading', 'Lexend', '"Lexend",system-ui,sans-serif'],
  ['Easy reading', 'Inter', '"Inter",system-ui,sans-serif'],
  ['On your device', 'Georgia', 'Georgia,"Times New Roman",serif'],
  ['On your device', 'System sans', 'system-ui,-apple-system,"Segoe UI",sans-serif']
];

export const THEMES = [
  ['typescript', 'Typescript'],
  ['legal', 'Legal pad'],
  ['night', 'Night desk']
];

export const DEFAULTS = { font: 'Courier Prime', size: 16, lh: 1.9, width: '34rem', theme: '' };
const KEY = 'quire:settings';

export const fontCss = (name) => (FONTS.find((f) => f[1] === name) || FONTS[0])[2];

export function loadLocalSettings() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* ignore */ }
  const s = { ...DEFAULTS, ...o };
  if (!FONTS.some((f) => f[1] === s.font)) s.font = DEFAULTS.font;
  return s;
}
export function saveLocalSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function applySettings(s) {
  const r = document.documentElement;
  const fam = fontCss(s.font);
  r.style.setProperty('--wf', fam);
  r.style.setProperty('--type', fam);
  r.style.setProperty('--hand', fam);
  r.style.setProperty('--wsz', s.size + 'px');
  r.style.setProperty('--wlh', String(s.lh));
  r.style.setProperty('--tw', s.width);
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', s.theme || (dark ? 'night' : 'typescript'));
}
