// Uses LanguageTool (https://languagetool.org) for grammar/style checking.
// Defaults to their free public API. Set VITE_LANGUAGETOOL_URL in .env.local
// to point at a self-hosted LanguageTool server instead (see README) if you'd
// rather your text never leave your own infrastructure.

const ENDPOINT = import.meta.env.VITE_LANGUAGETOOL_URL || 'https://api.languagetool.org/v2/check';
export const MAX_CHARS = 19000; // stays under LanguageTool's public-API request size limit

export async function checkGrammar(text, { signal, language = 'auto' } = {}) {
  if (!text || !text.trim()) return [];
  const body = new URLSearchParams({ text, language, enabledOnly: 'false' });
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Too many checks at once — wait a moment and try again.');
    throw new Error('Grammar check failed (' + res.status + ').');
  }
  const data = await res.json();
  return (data.matches || []).map((m, i) => ({
    id: `${i}-${m.offset}-${m.length}`,
    offset: m.offset,
    length: m.length,
    message: m.shortMessage || m.message || 'Possible issue',
    category: m.rule?.category?.name || 'Style',
    replacements: (m.replacements || []).slice(0, 3).map((r) => r.value),
    context: m.context || null // { text, offset, length } — a short window around the match
  }));
}
