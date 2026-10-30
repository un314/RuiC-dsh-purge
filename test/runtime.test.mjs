import test from 'node:test';
import assert from 'node:assert/strict';
import { reinforce, FORCE_PREFIX, installRuntimeOverride } from '../lib/runtime.js';

const instructions = () => ({
  role: 'user',
  source: { kind: 'agent-instructions', path: '/project/AGENTS.md' },
  content: [{ type: 'text', text: 'Workspace rules: run npm test before committing.' }],
});

test('reinforce prefixes workspace instructions', () => {
  const messages = [instructions()];
  const out = reinforce(messages);
  assert.notEqual(out, messages);
  assert.equal(out[0].content[0].text, FORCE_PREFIX + 'Workspace rules: run npm test before committing.');
});

test('reinforce leaves other messages untouched', () => {
  const messages = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }];
  assert.equal(reinforce(messages), messages);
});

test('reinforce is idempotent', () => {
  const once = reinforce([instructions()]);
  assert.equal(reinforce(once), once);
});

test('reinforce ignores non-text blocks', () => {
  const message = { ...instructions(), content: [{ type: 'image', path: '/a.png' }] };
  const messages = [message];
  assert.equal(reinforce(messages), messages);
});

test('hook rewrites the decisions produced by the host', async () => {
  const handlers = [];
  const ctx = { on: (event, handler) => handlers.push({ event, handler }) };
  const state = installRuntimeOverride(ctx, { runtimeOverride: true });
  assert.equal(handlers.length, 1);
  assert.equal(handlers[0].event, 'agent/pre-step');

  const decision = { kind: 'continue', messages: [instructions()] };
  const out = await handlers[0].handler({}, async () => decision);
  assert.notEqual(out.messages, decision.messages);
  assert.equal(out.kind, 'continue');
  assert.equal(state().rewrites, 1);
  assert.equal(state().enabled, true);
});

test('hook can be disabled', async () => {
  const handlers = [];
  const ctx = { on: (event, handler) => handlers.push({ event, handler }) };
  const state = installRuntimeOverride(ctx, { runtimeOverride: false });
  assert.equal(handlers.length, 0);
  assert.equal(state().enabled, false);
});
