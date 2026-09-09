#!/usr/bin/env node
// caldera-mcp — a dependency-free MCP (stdio) server exposing MITRE CALDERA's
// REST API as tools for the Exeaon cyber agent (Real mode: adversary emulation
// + enumeration). CALDERA itself is operator-run in an isolated lab; this
// wrapper only talks to its REST API — it ships NO implants, so it is bundle-safe.
//
// Config (env): CALDERA_URL (default http://localhost:8888), CALDERA_API_KEY
// (default ADMIN123 — CALDERA's default red key; override for real deployments).
//
// Protocol: newline-delimited JSON-RPC 2.0 over stdio (MCP 2024-11-05). No deps;
// uses Node's built-in fetch (Node 18+).

import readline from "node:readline";

const BASE = (process.env.CALDERA_URL || "http://localhost:8888").replace(/\/+$/, "");
const KEY = process.env.CALDERA_API_KEY || "ADMIN123";
const PROTOCOL_VERSION = "2024-11-05";

// ---- CALDERA REST helpers -------------------------------------------------
async function cal(method, path, body) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { KEY, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(
      `CALDERA unreachable at ${BASE} (${e.message}). Is the CALDERA server running (python server.py --insecure) in your isolated lab, and is CALDERA_URL/CALDERA_API_KEY set?`,
    );
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`CALDERA ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: "text", text: `ERROR: ${msg}` }], isError: true });

// ---- Tool definitions -----------------------------------------------------
const TOOLS = {
  caldera_config: {
    description: "Check the CALDERA server connection and return its main config (verifies the lab is reachable before any operation).",
    inputSchema: { type: "object", properties: {} },
    run: async () => ok(await cal("GET", "/api/v2/config/main")),
  },
  list_agents: {
    description: "List deployed CALDERA agents (implants/beacons) — host, platform, privilege, paw, last-seen. Enumerates what is under control.",
    inputSchema: { type: "object", properties: {} },
    run: async () => ok(await cal("GET", "/api/v2/agents")),
  },
  list_abilities: {
    description: "List CALDERA abilities (TTPs). Optionally filter by ATT&CK tactic (e.g. discovery, credential-access, lateral-movement) to plan enumeration steps.",
    inputSchema: { type: "object", properties: { tactic: { type: "string", description: "ATT&CK tactic to filter by (optional)" } } },
    run: async (a) => {
      const all = await cal("GET", "/api/v2/abilities");
      const list = Array.isArray(all) ? all : [];
      const filtered = a.tactic ? list.filter((x) => (x.tactic || "").toLowerCase() === a.tactic.toLowerCase()) : list;
      return ok(filtered.map((x) => ({ ability_id: x.ability_id, name: x.name, tactic: x.tactic, technique_id: x.technique_id, description: x.description })));
    },
  },
  list_adversaries: {
    description: "List CALDERA adversary profiles (ordered chains of abilities) available to run as operations.",
    inputSchema: { type: "object", properties: {} },
    run: async () => {
      const all = await cal("GET", "/api/v2/adversaries");
      const list = Array.isArray(all) ? all : [];
      return ok(list.map((x) => ({ adversary_id: x.adversary_id, name: x.name, description: x.description, atomic_ordering: x.atomic_ordering })));
    },
  },
  list_operations: {
    description: "List CALDERA operations (running/finished emulation campaigns) with state.",
    inputSchema: { type: "object", properties: {} },
    run: async () => {
      const all = await cal("GET", "/api/v2/operations");
      const list = Array.isArray(all) ? all : [];
      return ok(list.map((x) => ({ id: x.id, name: x.name, state: x.state, adversary: x.adversary?.name, start: x.start })));
    },
  },
  get_operation: {
    description: "Get one CALDERA operation's full detail including its executed links/commands and results.",
    inputSchema: { type: "object", properties: { operation_id: { type: "string" } }, required: ["operation_id"] },
    run: async (a) => ok(await cal("GET", `/api/v2/operations/${encodeURIComponent(a.operation_id)}`)),
  },
  operation_facts: {
    description: "Get the FACTS an operation enumerated (hosts, users, creds, shares, etc.) — the core enumeration output of an emulation.",
    inputSchema: { type: "object", properties: { operation_id: { type: "string" } }, required: ["operation_id"] },
    run: async (a) => ok(await cal("GET", `/api/v2/operations/${encodeURIComponent(a.operation_id)}/facts`)),
  },
  create_operation: {
    description: "Create + start a CALDERA operation (adversary emulation) against a group of agents. INTRUSIVE — the Exeaon Validation gate confirms before this runs. Authorized isolated lab only.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        adversary_id: { type: "string", description: "from list_adversaries" },
        group: { type: "string", description: "agent group to target (default: red)", default: "red" },
      },
      required: ["name", "adversary_id"],
    },
    run: async (a) =>
      ok(await cal("POST", "/api/v2/operations", { name: a.name, adversary: { adversary_id: a.adversary_id }, group: a.group || "red", state: "running" })),
  },
};

// ---- JSON-RPC / MCP stdio loop -------------------------------------------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send({ jsonrpc: "2.0", id, result: { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: "caldera-mcp", version: "1.0.0" } } });
  }
  if (method === "notifications/initialized") return; // notification, no reply
  if (method === "tools/list") {
    return send({
      jsonrpc: "2.0",
      id,
      result: { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) },
    });
  }
  if (method === "tools/call") {
    const t = TOOLS[params?.name];
    if (!t) return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${params?.name}` } });
    try {
      const result = await t.run(params.arguments || {});
      return send({ jsonrpc: "2.0", id, result });
    } catch (e) {
      return send({ jsonrpc: "2.0", id, result: fail(e.message) });
    }
  }
  if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try {
    msg = JSON.parse(s);
  } catch {
    return;
  }
  handle(msg).catch((e) => {
    if (msg && msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e && e.message) } });
  });
});
