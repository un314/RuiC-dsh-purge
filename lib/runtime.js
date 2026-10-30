// Runtime reinforcement for hosts whose package files are sealed (signed or
// read-only ASAR). Nothing on disk is modified: the workspace-instruction
// message is rewritten in flight, right before it reaches the model.
import { promptPath } from './service.js';

export const FORCE_PREFIX =
  'These workspace instructions are binding for this session: apply every applicable rule, ' +
  're-check them before each project-level decision, and report deviations explicitly. ' +
  'Only system, developer, or explicit user requests may override them.\n\n';

const INSTRUCTIONS_SOURCE = 'agent-instructions';

export function isInstructionsMessage(message) {
  return typeof message === 'object' && message !== null &&
    typeof message.source === 'object' && message.source !== null &&
    message.source.kind === INSTRUCTIONS_SOURCE;
}

function reinforceText(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  if (text.startsWith(FORCE_PREFIX)) return text;
  return FORCE_PREFIX + text;
}

/**
 * Rewrite the in-flight workspace instruction messages. Pure: the input array
 * is returned unchanged when nothing needed rewriting, so callers can compare
 * identity to detect a no-op.
 */
export function reinforce(messages) {
  if (!Array.isArray(messages)) return messages;
  let changed = false;
  const out = messages.map(message => {
    if (!isInstructionsMessage(message)) return message;
    const content = Array.isArray(message.content) ? message.content : [];
    let blockChanged = false;
    const next = content.map(block => {
      if (!block || block.type !== 'text') return block;
      const text = reinforceText(block.text);
      if (text === block.text) return block;
      blockChanged = true;
      return { ...block, text };
    });
    if (!blockChanged) return message;
    changed = true;
    return { ...message, content: next };
  });
  return changed ? out : messages;
}

/**
 * Register the runtime hook. The hook runs after downstream handlers, so it
 * sees the message set that the host is about to send to the model.
 */
export function installRuntimeOverride(ctx, config = {}) {
  const canHook = typeof ctx.on === 'function';
  const state = { enabled: config.runtimeOverride !== false && canHook, rewrites: 0, lastAt: null };
  if (state.enabled) {
    ctx.on('agent/pre-step', async (payload, next) => {
      const decision = await next();
      if (!decision || decision.kind === 'reject' || !Array.isArray(decision.messages)) return decision;
      const messages = reinforce(decision.messages);
      if (messages === decision.messages) return decision;
      state.rewrites += 1;
      state.lastAt = new Date().toISOString();
      return { ...decision, messages };
    });
  }
  return () => ({
    enabled: state.enabled,
    rewrites: state.rewrites,
    lastAt: state.lastAt,
    promptPath: promptPath(config),
    note: state.enabled
      ? 'Runtime reinforcement leaves host files untouched; it applies even when the installation is sealed.'
      : canHook
        ? 'Runtime reinforcement is disabled by runtimeOverride: false.'
        : 'Host does not expose agent/pre-step hooks; runtime reinforcement skipped.',
  });
}
