import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, render } from '../src/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const figma = readFileSync(join(FIXTURES, 'figma-file-v1.json'), 'utf8');
const openapi = readFileSync(join(FIXTURES, 'openapi-v1.json'), 'utf8');

test('figma: detected, native ids, TEXT characters in content', () => {
  const result = read(figma);
  assert.equal(result.codec, 'figma');
  const title = result.blocks.find((b) => b.id === '1:3');
  assert.equal(title.text, 'Checkout');
  const button = result.blocks.find((b) => b.id === '1:4');
  assert.equal(button.meta.figmaType, 'INSTANCE');
  assert.equal(button.meta.componentId, '9:1');
  // RECTANGLE child is counted but not enumerated
  assert.ok(!result.blocks.some((b) => b.id === '1:6'));
  const frame = result.blocks.find((b) => b.id === '1:2');
  assert.equal(frame.meta.children, 3);
});

test('figma: render is an indented outline, far smaller than source', () => {
  const out = render(figma);
  assert.match(out, /FRAME "Checkout \/ Desktop" \(3 children\)/);
  assert.match(out, /^ {6}TEXT "Pay now"/m);
  assert.ok(out.length < figma.length / 3);
});

test('openapi: endpoints as native-id blocks with param/response meta', () => {
  const result = read(openapi);
  assert.equal(result.codec, 'openapi');
  const ids = result.blocks.map((b) => b.id);
  assert.deepEqual(ids, ['#info', 'GET /users', 'POST /users', 'GET /orders/{id}']);
  const list = result.blocks.find((b) => b.id === 'GET /users');
  assert.deepEqual(list.meta.params, ['limit(query)']);
  assert.deepEqual(list.meta.responses, ['200', '401']);
  assert.deepEqual(list.meta.auth, ['bearerAuth']);
});

test('openapi: YAML specs detect as openapi documents, not generic yaml data', () => {
  const spec = `
openapi: 3.1.0
info:
  title: Tiny API
  version: 1.0.0
paths:
  /ping:
    get:
      summary: Ping
      responses:
        "200": {}
`;
  const result = read(spec);
  assert.equal(result.codec, 'openapi');
  assert.equal(result.kind, 'document');
  assert.ok(result.blocks.some((b) => b.id === 'GET /ping'));
});

test('openapi: render lists the API surface compactly', () => {
  const out = render(openapi);
  assert.match(out, /# Acme Checkout API 1\.4\.0/);
  assert.match(out, /POST \/users {2}— Create user/);
  assert.match(out, /GET \/orders\/\{id\}.*→ 200\/404/);
});
