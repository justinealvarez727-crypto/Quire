// The editor stores each scene as HTML now (rich text), not plain text.
// These helpers convert between that HTML and plain text — for word counts,
// the grammar checker, and .txt export — and map plain-text character
// offsets back onto real DOM ranges so the grammar checker can select or
// replace exact spans without disturbing formatting elsewhere.

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const HTML_RE = /<[a-z][\s\S]*>/i;
export const isHtml = (raw) => HTML_RE.test(raw || '');

// One-time upgrade path for scenes written before rich text existed.
export function plainToHtml(raw) {
  const paras = String(raw || '').split(/\n{2,}/);
  const body = paras.map((p) => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('');
  return body || '<p><br></p>';
}

export function toHtml(raw) {
  if (!raw) return '<p><br></p>';
  return isHtml(raw) ? raw : plainToHtml(raw);
}

function blocksOf(root) {
  const kids = Array.from(root.children);
  return kids.length ? kids : [root];
}

/**
 * Walks the same block/text-node structure two ways at once so the two stay
 * in lockstep: a plain-text string (paragraphs joined by blank lines, for
 * word counts / grammar / export) and a list of {node, start, end} entries
 * (for mapping a plain-text offset back to a real DOM position). Neither is
 * trimmed, so offsets from a grammar check against `plain` line up exactly
 * with `nodes`.
 */
function walk(root) {
  const blocks = blocksOf(root);
  let pos = 0;
  const nodes = [];
  const parts = [];
  blocks.forEach((block, i) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const len = n.data.length;
      if (len) { nodes.push({ node: n, start: pos, end: pos + len }); pos += len; }
    }
    parts.push(block.textContent);
    if (i < blocks.length - 1) { parts.push('\n\n'); pos += 2; }
  });
  return { nodes, plain: parts.join('') };
}

/** HTML string -> plain text (for word counts, grammar checking, export). */
export function htmlToPlain(html) {
  const div = document.createElement('div');
  div.innerHTML = toHtml(html);
  return walk(div).plain;
}

/** Maps a [start, end) offset in the plain-text form back to a live DOM Range. */
export function rangeFromOffsets(root, start, end) {
  const { nodes } = walk(root);
  if (!nodes.length) return null;
  const find = (pos) => {
    for (const e of nodes) if (pos >= e.start && pos <= e.end) return { node: e.node, offset: pos - e.start };
    const last = nodes[nodes.length - 1];
    return { node: last.node, offset: last.node.data.length };
  };
  const s = find(start), e = find(Math.max(start, end));
  const range = document.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  return range;
}

/** Replaces a plain-text offset span in-place in the live DOM, preserving surrounding formatting. */
export function applyReplacement(root, start, end, replacement) {
  const range = rangeFromOffsets(root, start, end);
  if (!range) return false;
  range.deleteContents();
  if (replacement) range.insertNode(document.createTextNode(replacement));
  root.normalize();
  return true;
}
