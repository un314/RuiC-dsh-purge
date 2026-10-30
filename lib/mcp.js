// Host-agnostic MCP entry: exposes the same status/plan/apply surface as the
// DSH plugin so any MCP-capable client (DSH, Trae, Cursor, Claude) can use it.
// Pure JSON-RPC over stdio, no SDK and no dependencies.
import { createInterface } from 'node:readline';
import { run } from './service.js';

const TOOLS = [
  {
    name: 'ruic_status',
    description: 'Report the detected DSH installation, layout, version, writability and prompt path.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ruic_plan',
    description: 'Dry-run the patch plan: per-target status, expected hashes and conflicts. Changes nothing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'ruic_apply',
    description: 'Snapshot, then atomically write the patch plan. Refuses on read-only or sealed hosts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const COMMANDS = { ruic_status: 'status', ruic_plan: 'plan', ruic_apply: 'apply' };

function result(id, value) {
  return { jsonrpc: '2.0', id, result: value };
}

function error(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    return result(id, {
      protocolVersion: (params && params.protocolVersion) || '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'ruic-dsh-purge', version: '1.1.0' },
    });
  }
  if (method === 'ping') return result(id, {});
  if (method === 'tools/list') return result(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params && params.name;
    const command = COMMANDS[name];
    if (!command) return error(id, -32602, `Unknown tool: ${name}`);
    try {
      const out = await run(command, {});
      return result(id, {
        content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
        isError: out.ok === false,
      });
    } catch (err) {
      return result(id, {
        content: [{ type: 'text', text: String(err && err.message ? err.message : err) }],
        isError: true,
      });
    }
  }
  return error(id, -32601, `Unsupported method: ${method}`);
}

export function startMcpServer() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async line => {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      process.stdout.write(`${JSON.stringify(error(null, -32700, 'Parse error'))}\n`);
      return;
    }
    if (message.id === undefined || message.id === null) return;
    const response = await handle(message);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('mcp.js')) {
  startMcpServer();
}
