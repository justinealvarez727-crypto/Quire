import { describe, it, expect } from 'vitest';
import { toHtml, plainToHtml, htmlToPlain, rangeFromOffsets, applyReplacement } from '../lib/richtext.js';

describe('richtext helpers', () => {
  it('upgrades legacy plain text into paragraphs, escaping HTML-sensitive characters', () => {
    const html = plainToHtml('Tom & Jerry chase each other.\n\nThe end.');
    expect(html).toBe('<p>Tom &amp; Jerry chase each other.</p><p>The end.</p>');
  });

  it('toHtml leaves real HTML alone and only upgrades plain text', () => {
    expect(toHtml('<p>Already <b>rich</b> text.</p>')).toBe('<p>Already <b>rich</b> text.</p>');
    expect(toHtml('')).toBe('<p><br></p>');
    expect(toHtml(null)).toBe('<p><br></p>');
  });

  it('htmlToPlain strips tags and separates paragraphs with a blank line', () => {
    const plain = htmlToPlain('<p>First <b>bold</b> line.</p><p>Second line.</p>');
    expect(plain).toBe('First bold line.\n\nSecond line.');
  });

  it('rangeFromOffsets and applyReplacement locate and replace an exact span without disturbing the rest', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>She <b>be</b> here.</p>';
    document.body.appendChild(div);
    const plain = htmlToPlain(div.innerHTML); // "She be here."
    const offset = plain.indexOf('be');
    const ok = applyReplacement(div, offset, offset + 2, 'is');
    expect(ok).toBe(true);
    expect(div.textContent).toBe('She is here.');
    expect(div.querySelector('b')).toBeTruthy(); // formatting around the edit survives
    document.body.removeChild(div);
  });
});
