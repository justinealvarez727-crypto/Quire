import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

function flush(ms = 900) { return new Promise((r) => setTimeout(r, ms)); }

beforeEach(() => { localStorage.clear(); });

describe('Quire (local storage mode, no Supabase configured)', () => {
  it('shows an empty dashboard and creates a novel', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    await user.click(screen.getByText('+ New novel'));
    expect(await screen.findByText('‹ Novels')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Untitled novel')).toBeInTheDocument();
  });

  it('writing updates word count, autosaves, and cycles scene status', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    const editor = await screen.findByRole('textbox', { name: 'Scene text' });
    editor.innerHTML = '<p>The river had risen past the third step.</p>';
    fireEvent.input(editor);
    await flush(900);
    expect(screen.getByText(/8 words here/)).toBeInTheDocument();
    expect(screen.getByText(/Saved/)).toBeInTheDocument();

    const statusBtn = screen.getByRole('button', { name: /Status: draft/i });
    await user.click(statusBtn);
    expect(screen.getByRole('button', { name: /Status: revised/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Status: revised/i }));
    expect(screen.getByRole('button', { name: /Status: final/i })).toBeInTheDocument();
  });

  it('outline: adds a chapter, shows a card, cycles its status, and switches to Three-act', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getAllByText('Outline')[0]);
    expect(screen.getAllByText(/Untitled scene/).length).toBeGreaterThan(0);

    await user.click(screen.getByText('+ Add chapter'));
    await flush(100);
    expect(document.querySelectorAll('.tape').length).toBe(2);
    expect(document.querySelectorAll('.card').length).toBe(2);

    const mk = document.querySelector('[data-mk]');
    fireEvent.click(mk);
    expect(mk.getAttribute('aria-label')).toMatch(/revised/);

    await user.click(screen.getByRole('button', { name: 'Three-act' }));
    await flush(50);
    expect(document.querySelectorAll('.tape').length).toBe(4); // 3 beats + "Unplaced" (scenes default unassigned)
    expect(screen.getByText('Act one: setup')).toBeInTheDocument();
    expect(screen.getByText('Unplaced')).toBeInTheDocument();
  });

  it('story bible: adds a character, links a scene, adds a place and a timeline event', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getAllByText('Bible')[0]);

    await user.click(screen.getByText('+ Add character'));
    const nameInput = await screen.findByPlaceholderText('Name');
    await user.type(nameInput, 'Mara');
    expect(screen.getByDisplayValue('Mara')).toBeInTheDocument();

    const presenceBtns = document.querySelectorAll('.pres button');
    expect(presenceBtns.length).toBeGreaterThan(0);
    fireEvent.click(presenceBtns[0]);
    expect(presenceBtns[0].className).toContain('on');

    await user.click(screen.getByRole('button', { name: 'Places' }));
    await user.click(screen.getByText('+ Add place'));
    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Timeline' }));
    await user.click(screen.getByText('+ Add event'));
    expect(document.querySelectorAll('.ev').length).toBe(1);
  });

  it('mind map: adds nodes, drags one, links two, and renames the link', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getAllByText('Map')[0]);

    await user.click(screen.getByRole('button', { name: 'Idea' }));
    await user.click(screen.getByRole('button', { name: 'Person' }));
    await flush(50);
    let nodes = document.querySelectorAll('[data-node]');
    expect(nodes.length).toBe(2);

    const svg = document.querySelector('.mapSvg');
    fireEvent.pointerDown(nodes[0], { clientX: 150, clientY: 150, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 210, clientY: 210, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 210, clientY: 210, pointerId: 1 });
    await flush(50);

    nodes = document.querySelectorAll('[data-node]');
    fireEvent.pointerDown(nodes[1], { clientX: 250, clientY: 250, pointerId: 2 });
    fireEvent.pointerUp(nodes[1], { clientX: 250, clientY: 250, pointerId: 2 });
    await flush(50);
    const linkBtn = screen.getByRole('button', { name: /Link to/ });
    await user.click(linkBtn);
    nodes = document.querySelectorAll('[data-node]');
    fireEvent.pointerDown(nodes[0], { clientX: 150, clientY: 150, pointerId: 3 });
    fireEvent.pointerUp(nodes[0], { clientX: 150, clientY: 150, pointerId: 3 });
    await flush(50);
    expect(document.querySelectorAll('[data-edge]').length).toBeGreaterThan(0);

    const labelInput = screen.getByPlaceholderText('What connects them?');
    await user.type(labelInput, 'sibling');
    await flush(50);
    expect(document.querySelector('.elabel').textContent).toBe('sibling');
  });

  it('a scene written before rich text existed still loads, and indent/paragraph-style toolbar buttons work', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    const editor = await screen.findByRole('textbox', { name: 'Scene text' });

    // Simulate a legacy plain-text scene (as every scene was stored before this feature).
    editor.innerHTML = '<p>Old plain paragraph one.</p>';
    fireEvent.input(editor);
    await flush(50);

    // Place the caret inside the paragraph, the way clicking into it would.
    const block = editor.querySelector('p');
    const range = document.createRange();
    range.selectNodeContents(block);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    await user.click(screen.getByRole('button', { name: 'Indent' }));
    expect(block.style.textIndent).toBe('2.2em');

    await user.click(screen.getByRole('button', { name: 'Centered paragraph' }));
    expect(block.classList.contains('center')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Normal paragraph' }));
    expect(block.classList.contains('center')).toBe(false);
  });

  it('progress: shows goal line, toggles to time, and edits the goal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getAllByText('Progress')[0]);
    expect(screen.getByText(/of 500 words/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Time' }));
    await flush(50);
    expect(screen.getByText(/of 500 minutes/)).toBeInTheDocument();

    const dailyGoalInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(dailyGoalInput);
    await user.type(dailyGoalInput, '750');
    await flush(50);
    expect(dailyGoalInput.value).toBe('750');
  });

  it('settings: picking a font updates the app-wide CSS variable', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getByText('Aa'));
    const loraLabel = await screen.findByText('Lora');
    await user.click(loraLabel.closest('button'));
    await flush(50);
    expect(document.documentElement.style.getPropertyValue('--wf')).toContain('Lora');
    expect(document.documentElement.style.getPropertyValue('--hand')).toContain('Lora');

    await user.click(screen.getByRole('button', { name: 'Legal pad' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('legal');
  });

  it('dashboard shows progress for multiple novels', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getByText('‹ Novels'));
    await user.click(await screen.findByText('+ New novel'));
    await user.click(screen.getByText('‹ Novels'));
    const cards = document.querySelectorAll('.projCard:not(.newProj)');
    expect(cards.length).toBe(2);
  });

  it('grammar: checks the scene text and applies a suggested fix', async () => {
    const user = userEvent.setup();
    const mockMatch = {
      offset: 4, length: 2, message: 'Did you mean "is"?',
      rule: { category: { name: 'Grammar' } },
      replacements: [{ value: 'is' }],
      context: { text: 'She be here.', offset: 4, length: 2 }
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [mockMatch] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [] }) });
    global.fetch = fetchMock;

    render(<App />);
    await user.click(await screen.findByText('+ New novel'));
    const editor = await screen.findByRole('textbox', { name: 'Scene text' });
    editor.innerHTML = '<p>She be here.</p>';
    fireEvent.input(editor);
    await user.click(screen.getByRole('button', { name: 'Grammar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 3000 });
    expect(await screen.findByText('Did you mean "is"?', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('1 issue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'is' }));
    await flush(200);
    expect(editor.textContent).toBe('She is here.');
    expect(screen.queryByText('Did you mean "is"?')).not.toBeInTheDocument();

    delete global.fetch;
  });
});
