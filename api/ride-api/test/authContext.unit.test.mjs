import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAuthContextFromHeaders,
  requireAuth,
  requireRole
} from '../dist/plugins/authContext.js';

function fakeReq({ auth = null } = {}) {
  return { auth };
}

test('parseAuthContextFromHeaders returns null when missing subject', () => {
  const ctx = parseAuthContextFromHeaders({ 'x-auth-role': 'passenger' });
  assert.equal(ctx, null);
});

test('parseAuthContextFromHeaders returns null for anonymous role', () => {
  const ctx = parseAuthContextFromHeaders({ 'x-auth-sub': '00000000-0000-0000-0000-000000000001' });
  assert.equal(ctx, null);
});

test('parseAuthContextFromHeaders parses subject, role, and scopes', () => {
  const ctx = parseAuthContextFromHeaders({
    'x-auth-sub': '00000000-0000-0000-0000-000000000001',
    'x-auth-role': 'driver',
    'x-auth-scopes': 'rides:read, rides:accept ,'
  });

  assert.deepEqual(ctx, {
    subjectId: '00000000-0000-0000-0000-000000000001',
    role: 'driver',
    scopes: ['rides:read', 'rides:accept']
  });
});

test('requireAuth throws when unauthenticated', () => {
  assert.throws(
    () => requireAuth(fakeReq()),
    (err) => {
      assert.equal(err.statusCode, 401);
      assert.equal(err.code, 'UNAUTHORIZED');
      return true;
    }
  );
});

test('requireRole throws when wrong role', () => {
  assert.throws(
    () => requireRole(fakeReq({ auth: { subjectId: 's', role: 'passenger', scopes: [] } }), 'driver'),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, 'FORBIDDEN');
      return true;
    }
  );
});

test('requireRole returns auth when role matches', () => {
  const auth = { subjectId: 's', role: 'driver', scopes: ['x'] };
  const ctx = requireRole(fakeReq({ auth }), 'driver');
  assert.equal(ctx, auth);
});
