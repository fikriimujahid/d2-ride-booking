import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideAccept,
  decideArrive,
  decideCancel,
  decideComplete,
  decideStart
} from '../dist/modules/ride/lifecycle.js';

test('decideAccept: requested -> apply', () => {
  assert.deepEqual(decideAccept('requested', null, 'D1'), { kind: 'apply' });
});

test('decideAccept: offered to same driver -> apply', () => {
  assert.deepEqual(decideAccept('offered', 'D1', 'D1'), { kind: 'apply' });
});

test('decideAccept: offered to other driver -> conflict', () => {
  const res = decideAccept('offered', 'D1', 'D2');
  assert.equal(res.kind, 'conflict');
});

test('decideAccept: accepted by same driver -> idempotent', () => {
  assert.deepEqual(decideAccept('accepted', 'D1', 'D1'), { kind: 'idempotent' });
});

test('decideAccept: accepted by other driver -> conflict', () => {
  const res = decideAccept('accepted', 'D1', 'D2');
  assert.equal(res.kind, 'conflict');
});

test('decideCancel: cancelled -> idempotent', () => {
  assert.deepEqual(decideCancel('cancelled'), { kind: 'idempotent' });
});

test('decideCancel: in_progress -> conflict', () => {
  const res = decideCancel('in_progress');
  assert.equal(res.kind, 'conflict');
});

test('decideArrive: wrong driver -> conflict', () => {
  const res = decideArrive('accepted', 'D1', 'D2');
  assert.equal(res.kind, 'conflict');
});

test('decideArrive: accepted by driver -> apply', () => {
  assert.deepEqual(decideArrive('accepted', 'D1', 'D1'), { kind: 'apply' });
});

test('decideStart: arrived -> apply, in_progress -> idempotent', () => {
  assert.deepEqual(decideStart('arrived', 'D1', 'D1'), { kind: 'apply' });
  assert.deepEqual(decideStart('in_progress', 'D1', 'D1'), { kind: 'idempotent' });
});

test('decideComplete: in_progress -> apply, completed -> idempotent', () => {
  assert.deepEqual(decideComplete('in_progress', 'D1', 'D1'), { kind: 'apply' });
  assert.deepEqual(decideComplete('completed', 'D1', 'D1'), { kind: 'idempotent' });
});
