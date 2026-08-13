import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, renderBlocks } from '../src/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const md = readFileSync(join(FIXTURES, 'notes-v1.md'), 'utf8');

test('markdown: only via filename hint or explicit format — never a fallback', () => {
  assert.throws(() => read('# Just some heading\n\nprose'), /Could not detect/);
  assert.equal(read(md, { filename: 'notes-v1.md' }).codec, 'markdown');
  assert.equal(read('# Hi', { format: 'markdown' }).codec, 'markdown');
});

test('markdown: parses to the same block shapes as ADF', () => {
  const { blocks } = read(md, { filename: 'notes-v1.md' });
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'paragraph', 'quote', 'heading', 'code', 'heading', 'tasks', 'table']
  );
  const code = blocks.find((b) => b.type === 'code');
  assert.equal(code.language, 'bash');
  assert.match(code.text, /helm upgrade/);
  const tasks = blocks.find((b) => b.type === 'tasks');
  assert.deepEqual(tasks.items.map((t) => t.state), ['done', 'todo', 'todo']);
  const table = blocks.find((b) => b.type === 'table');
  assert.deepEqual(table.rows[0], ['Stage', 'Traffic']);
  assert.ok(blocks.every((b) => b.id && b.hash));
});

test('markdown: YAML frontmatter becomes one opaque block, not soup', () => {
  const doc = '---\ntitle: Notes\ntags: [a, b]\n---\n\n# Real Heading\n\nBody.';
  const { blocks } = read(doc, { filename: 'doc.md' });
  assert.equal(blocks[0].type, 'frontmatter');
  assert.match(blocks[0].text, /title: Notes/);
  assert.equal(blocks[1].type, 'heading');
  assert.equal(blocks[1].text, 'Real Heading');
  // No spurious rule/paragraph blocks from the delimiters.
  assert.ok(!blocks.some((b) => b.type === 'rule'));
});

test('markdown: round-trips through the shared renderer', () => {
  const { blocks } = read(md, { filename: 'notes-v1.md' });
  const out = renderBlocks(blocks);
  assert.match(out, /^# Release Notes — Sprint 14/);
  assert.match(out, /- \[x\] Feature flag created/);
  assert.match(out, /\| Canary \| 5% \|/);
});
