import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, YamlSubsetError } from '../src/yaml.js';
import { read } from '../src/index.js';

test('yaml: maps, sequences, nesting, scalar typing allowlist', () => {
  const value = parseYaml(`
# deployment config
name: checkout
replicas: 4
ratio: 0.25
debug: false
region: null
url: https://example.com/path
tags:
  - payments
  - "front end"
service:
  port: 8080
  hosts:
    - name: a
      weight: 1
    - name: b
      weight: 2
`);
  assert.deepEqual(value, {
    name: 'checkout',
    replicas: 4,
    ratio: 0.25,
    debug: false,
    region: null,
    url: 'https://example.com/path',
    tags: ['payments', 'front end'],
    service: { port: 8080, hosts: [{ name: 'a', weight: 1 }, { name: 'b', weight: 2 }] },
  });
});

test('yaml: quotes, escapes, comments, block literals', () => {
  const value = parseYaml(`
title: "hello: \\"world\\""
note: 'it''s fine'  # trailing comment
script: |
  line one
  line two
folded: >-
  a b
  c
`);
  assert.equal(value.title, 'hello: "world"');
  assert.equal(value.note, "it's fine");
  assert.equal(value.script, 'line one\nline two\n');
  assert.equal(value.folded, 'a b c');
});

test('yaml: single-line flow collections parse (real OpenAPI needs them)', () => {
  const value = parseYaml(`
empty: {}
tags: [payments, "front end", 3]
resp: {code: 200, body: {ok: true}, arr: [1, 2]}
`);
  assert.deepEqual(value.empty, {});
  assert.deepEqual(value.tags, ['payments', 'front end', 3]);
  assert.deepEqual(value.resp, { code: 200, body: { ok: true }, arr: [1, 2] });
});

test('yaml: strict-reject names the construct', () => {
  const cases = [
    ['base: &anchor 1', /anchors/],
    ['ref: *anchor', /aliases/],
    ['t: !!str x', /tags/],
    ['%YAML 1.2', /directives/],
    ['a: 1\n---\nb: 2', /multi-document/],
    ['list: [1, 2', /flow collections spanning lines/],
    ['\tkey: 1', /tab indentation/],
    ['weird: a: b', /ambiguous plain scalar/],
    ['a: 1\na: 2', /duplicate key/],
  ];
  for (const [input, re] of cases) {
    assert.throws(() => parseYaml(input), (err) => err instanceof YamlSubsetError && re.test(err.message), input);
  }
});

test('yaml detection: structured YAML detects as data; JSON still wins; prose does not', () => {
  assert.equal(read('name: x\nitems:\n  - 1\n  - 2').codec, 'yaml');
  assert.equal(read('{"name": "x"}').codec, 'json'); // JSON is valid YAML — JSON must win
  assert.throws(() => read('just some prose'), /Could not detect/);
});

test('yaml: playwright-snapshot-style plain scalars survive', () => {
  const value = parseYaml(`
- banner:
  - heading "Installation" [level=2]
  - link "Get started"
- contentinfo:
  - text "© 2026"
`);
  assert.equal(value.length, 2);
  assert.deepEqual(value[0], { banner: ['heading "Installation" [level=2]', 'link "Get started"'] });
});
