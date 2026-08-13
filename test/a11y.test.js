import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, render } from '../src/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const snap = readFileSync(join(FIXTURES, 'snapshot-v1.yaml'), 'utf8');

test('a11y: detected from YAML shape, parses to role blocks with depth', () => {
  const result = read(snap);
  assert.equal(result.codec, 'a11y');
  assert.equal(result.kind, 'document');
  const button = result.blocks.find((b) => b.meta.role === 'button');
  assert.equal(button.text, 'button "Pay now"');
  assert.equal(button.meta.depth, 1);
  const banner = result.blocks.find((b) => b.meta.role === 'banner');
  assert.equal(banner.meta.children, 2);
  assert.ok(result.blocks.every((b) => b.id && b.hash));
});

test('a11y: plain config YAML still detects as data, not a11y', () => {
  assert.equal(read('name: x\nlist:\n  - a\n  - b').codec, 'yaml');
});

test('a11y: renders as the indented snapshot view', () => {
  const out = render(snap);
  assert.match(out, /^- banner\n {2}- heading "Acme Store" \[level=1\]/);
  assert.match(out, /\n {4}- link "Products"\n/);
});
