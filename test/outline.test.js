import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineText, getPointer } from '../src/index.js';

const data = {
  config: { region: 'us-east-1', retries: 3 },
  users: Array.from({ length: 1204 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    role: i % 7 === 0 ? 'admin' : 'member',
    ...(i % 3 === 0 ? { last_login: '2026-08-01' } : {}),
  })),
};

test('outline: shape not values — types, lengths, key presence, domains', () => {
  const text = outlineText(data);
  assert.match(text, /object \{config, users\}/);
  assert.match(text, /\/users {2}array\[1204\] of object \{id, name, role, last_login\?\}/);
  assert.match(text, /shape inferred from first 200/);
  assert.match(text, /distinct values: .*"member" \(\d+%\), "admin" \(\d+%\)/);
  assert.match(text, /sample: \{"id":0/);
  // The full value dump must NOT be present.
  assert.ok(!text.includes('User 1203'));
  assert.ok(text.length < JSON.stringify(data).length / 50, `outline is ${text.length} chars`);
});

test('getPointer: RFC 6901 semantics incl. escaping and errors', () => {
  assert.equal(getPointer(data, '/config/region'), 'us-east-1');
  assert.equal(getPointer(data, '/users/3/id'), 3);
  assert.deepEqual(getPointer({ 'a/b': { '~x': 1 } }, '/a~1b/~0x'), 1);
  assert.equal(getPointer(data, ''), data);
  assert.throws(() => getPointer(data, 'users'), /must start with/);
  assert.throws(() => getPointer(data, '/nope'), /not found/);
  assert.throws(() => getPointer(data, '/users/99999'), /out of range/);
});
