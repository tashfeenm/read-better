import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, render, diff } from '../src/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const v1 = JSON.parse(readFileSync(join(FIXTURES, 'release-notes-v1.json'), 'utf8'));
const v2 = JSON.parse(readFileSync(join(FIXTURES, 'release-notes-v2.json'), 'utf8'));

test('parse: block types, inline marks, mentions, links', () => {
  const blocks = parse(v1);
  const types = blocks.map((b) => b.type);
  assert.deepEqual(types, ['heading', 'paragraph', 'panel', 'heading', 'code', 'heading', 'tasks', 'heading', 'paragraph', 'table']);
  assert.equal(blocks[1].text, 'Owner: @Dana Osei. Target: **Q3**.');
  assert.match(blocks[8].text, /\[runbook\]\(https:\/\/example\.atlassian\.net\/wiki\/runbook\)/);
  assert.equal(blocks[6].items.length, 3);
  assert.equal(blocks[6].items[0].state, 'done');
});

test('parse: ids are stable across identical content, distinct across edits', () => {
  const a = parse(v1);
  const b = parse(v2);
  const heading = (blocks, text) => blocks.find((blk) => blk.type === 'heading' && blk.text === text);
  assert.equal(heading(a, 'Deployment').id, heading(b, 'Deployment').id); // unchanged → same id
  const codeA = a.find((blk) => blk.type === 'code');
  const codeB = b.find((blk) => blk.type === 'code');
  assert.notEqual(codeA.id, codeB.id); // edited → different id
});

test('render: compact markdown, and much smaller than the ADF source', () => {
  const md = render(v1);
  assert.match(md, /^# Checkout Redesign — Rollout Plan/);
  assert.match(md, /```bash\nhelm upgrade/);
  assert.match(md, /- \[x\] Feature flag created/);
  assert.match(md, /\| Stage \| Traffic \|/);
  assert.match(md, /> \*\*WARNING:\*\*/);
  const adfSize = JSON.stringify(v1).length;
  assert.ok(md.length < adfSize / 3, `markdown (${md.length}) should be <1/3 of ADF (${adfSize})`);
});

test('diff: edits pair up as changed; adds/removes/moves are detected', () => {
  const ops = diff(v1, v2);
  const summaries = ops.map((op) => op.summary);

  assert.ok(summaries.some((s) => /warning panel removed/.test(s)), summaries.join(' | '));
  assert.ok(summaries.some((s) => /code block \(bash\) edited/.test(s)), summaries.join(' | '));
  assert.ok(summaries.some((s) => /task list: 2\/3 done \(was 1\)/.test(s)), summaries.join(' | '));
  assert.ok(summaries.some((s) => /table: 2 → 3 rows/.test(s)), summaries.join(' | '));
  assert.ok(summaries.some((s) => /section "Comms" added/.test(s)), summaries.join(' | '));

  // The unchanged heading/paragraph blocks must NOT appear in the diff.
  assert.ok(!summaries.some((s) => /Rollback.*(added|removed)/.test(s)), summaries.join(' | '));
});

test('diff: identical docs produce no ops', () => {
  assert.deepEqual(diff(v1, v1), []);
});

test('parse: rejects non-ADF input', () => {
  assert.throws(() => parse({ hello: 'world' }), /Not an ADF document/);
});
