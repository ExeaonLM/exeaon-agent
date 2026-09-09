#!/usr/bin/env python3
"""cyborg-sim — a stdlib-only MCP (stdio) server exposing the CybORG CAGE-4
autonomous-cyber-defence simulation to the Exeaon cyber agent (Simulation mode).

CybORG is a pure-Python gym simulation (no real implants, AV-clean) — safe to run
locally. It must be pip-installed first:
    pip install -e <app>/vendor/sim/cage-challenge-4
This wrapper lazy-imports CybORG and returns a clear install hint if it's absent.

Protocol: newline-delimited JSON-RPC 2.0 over stdio (MCP 2024-11-05). No third-
party deps beyond CybORG itself (imported on demand).
"""
import json
import sys
import traceback

PROTOCOL_VERSION = "2024-11-05"

# Single in-process simulation instance (sim mode is single-session).
STATE = {"cyborg": None, "sg": None, "steps": 0, "max_steps": 500}


def _ok(data):
    text = data if isinstance(data, str) else json.dumps(data, indent=2, default=str)
    return {"content": [{"type": "text", "text": text}]}


def _fail(msg):
    return {"content": [{"type": "text", "text": "ERROR: " + msg}], "isError": True}


def _import_cyborg():
    try:
        from CybORG import CybORG, CYBORG_VERSION  # noqa: F401
        from CybORG.Agents import (  # noqa: F401
            SleepAgent,
            EnterpriseGreenAgent,
            FiniteStateRedAgent,
        )
        from CybORG.Simulator.Scenarios import EnterpriseScenarioGenerator  # noqa: F401

        return None  # success
    except Exception as e:  # noqa: BLE001
        return (
            "CybORG is not installed in this Python. Install it (safe, pure-Python) with:\n"
            "  pip install -e <app>/vendor/sim/cage-challenge-4\n"
            f"(import error: {e})"
        )


# ---- Tools ----------------------------------------------------------------
def t_status(_args):
    err = _import_cyborg()
    if err:
        return _ok({"installed": False, "hint": err})
    from CybORG import CYBORG_VERSION

    return _ok(
        {
            "installed": True,
            "version": CYBORG_VERSION,
            "scenario": "CAGE Challenge 4 — Enterprise MARL autonomous cyber defence",
            "running": STATE["cyborg"] is not None,
            "steps_taken": STATE["steps"],
        }
    )


def t_scenario_info(_args):
    return _ok(
        "CAGE Challenge 4 (CC4): a segmented military enterprise network — deployed zones, "
        "restricted/operational zones, HQ, and an undefended contractor subnet. 5 blue defenders "
        "(one per zone). Red starts in the contractor net and pivots; green agents = users generating "
        "work + occasional false alerts/phishing. Blue goal: maintain operational capability while "
        "removing red. Simulation only — no real hosts, no real implants."
    )


def t_start(args):
    err = _import_cyborg()
    if err:
        return _fail(err)
    try:
        from CybORG import CybORG
        from CybORG.Agents import EnterpriseGreenAgent, FiniteStateRedAgent, SleepAgent
        from CybORG.Simulator.Scenarios import EnterpriseScenarioGenerator

        steps = int(args.get("steps", 100))
        seed = args.get("seed")
        sg = EnterpriseScenarioGenerator(
            blue_agent_class=SleepAgent,
            green_agent_class=EnterpriseGreenAgent,
            red_agent_class=FiniteStateRedAgent,
            steps=steps,
        )
        cyborg = CybORG(sg, "sim", seed=seed)
        cyborg.reset()
        STATE["cyborg"] = cyborg
        STATE["sg"] = sg
        STATE["steps"] = 0
        STATE["max_steps"] = steps
        agents = list(getattr(cyborg, "agents", []) or cyborg.active_agents)
        return _ok(
            {
                "started": True,
                "max_steps": steps,
                "agents": agents,
                "note": "Sim reset. Use cyborg_step to advance and observe red/green activity; cyborg_observe for an agent's view.",
            }
        )
    except Exception as e:  # noqa: BLE001
        return _fail("failed to start CybORG: " + str(e) + "\n" + traceback.format_exc()[-600:])


def t_step(args):
    cyborg = STATE["cyborg"]
    if cyborg is None:
        return _fail("No simulation running. Call cyborg_start first.")
    try:
        count = int(args.get("count", 1))
        results = []
        for _ in range(max(1, min(count, 50))):
            # Blue defaults to Sleep (advance the sim to observe red/green);
            # richer per-agent action control is added once verified live.
            out = cyborg.step()
            STATE["steps"] += 1
            rewards = getattr(out, "reward", None) if not isinstance(out, tuple) else None
            results.append({"step": STATE["steps"]})
        # Summarize red presence / rewards from the environment where available.
        summary = {"steps_taken": STATE["steps"], "advanced": len(results)}
        try:
            summary["reward"] = cyborg.get_rewards()
        except Exception:  # noqa: BLE001
            pass
        return _ok(summary)
    except Exception as e:  # noqa: BLE001
        return _fail("step failed: " + str(e))


def t_observe(args):
    cyborg = STATE["cyborg"]
    if cyborg is None:
        return _fail("No simulation running. Call cyborg_start first.")
    agent = args.get("agent", "blue_agent_0")
    try:
        obs = cyborg.get_observation(agent)
        return _ok({"agent": agent, "observation": obs})
    except Exception as e:  # noqa: BLE001
        return _fail("observe failed for %s: %s" % (agent, e))


def t_reset(_args):
    cyborg = STATE["cyborg"]
    if cyborg is None:
        return _fail("No simulation running. Call cyborg_start first.")
    try:
        cyborg.reset()
        STATE["steps"] = 0
        return _ok({"reset": True})
    except Exception as e:  # noqa: BLE001
        return _fail("reset failed: " + str(e))


TOOLS = {
    "cyborg_status": (t_status, "Check whether CybORG is installed + the sim state.", {"type": "object", "properties": {}}),
    "cyborg_scenario_info": (t_scenario_info, "Describe the CAGE Challenge 4 scenario (network, agents, objective).", {"type": "object", "properties": {}}),
    "cyborg_start": (t_start, "Start a CybORG CC4 simulation (safe, no real hosts). Returns the agents and max steps.", {"type": "object", "properties": {"steps": {"type": "integer", "default": 100}, "seed": {"type": "integer"}}}),
    "cyborg_step": (t_step, "Advance the simulation by N steps (blue defaults to Sleep) and return rewards.", {"type": "object", "properties": {"count": {"type": "integer", "default": 1}}}),
    "cyborg_observe": (t_observe, "Get an agent's current observation (default blue_agent_0).", {"type": "object", "properties": {"agent": {"type": "string"}}}),
    "cyborg_reset": (t_reset, "Reset the running simulation to its initial state.", {"type": "object", "properties": {}}),
}


# ---- JSON-RPC / MCP stdio loop -------------------------------------------
def send(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def handle(msg):
    mid = msg.get("id")
    method = msg.get("method")
    params = msg.get("params") or {}
    if method == "initialize":
        return send({"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": PROTOCOL_VERSION, "capabilities": {"tools": {}}, "serverInfo": {"name": "cyborg-sim", "version": "1.0.0"}}})
    if method == "notifications/initialized":
        return
    if method == "tools/list":
        tools = [{"name": n, "description": d, "inputSchema": s} for n, (_f, d, s) in TOOLS.items()]
        return send({"jsonrpc": "2.0", "id": mid, "result": {"tools": tools}})
    if method == "tools/call":
        name = params.get("name")
        entry = TOOLS.get(name)
        if not entry:
            return send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Unknown tool: %s" % name}})
        fn = entry[0]
        try:
            return send({"jsonrpc": "2.0", "id": mid, "result": fn(params.get("arguments") or {})})
        except Exception as e:  # noqa: BLE001
            return send({"jsonrpc": "2.0", "id": mid, "result": _fail(str(e))})
    if mid is not None:
        send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Method not found: %s" % method}})


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:  # noqa: BLE001
            continue
        try:
            handle(msg)
        except Exception as e:  # noqa: BLE001
            if isinstance(msg, dict) and msg.get("id") is not None:
                send({"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32603, "message": str(e)}})


if __name__ == "__main__":
    main()
