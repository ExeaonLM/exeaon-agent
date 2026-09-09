#!/usr/bin/env python3
"""Exeaon Engineering Labs — Robotics (MuJoCo) simulation MCP server.

A dependency-free-*protocol* MCP stdio server (newline-delimited JSON-RPC 2.0,
MCP 2024-11-05) that drives a MuJoCo physics simulation. MuJoCo + numpy are
lazy-imported on first use so the server starts (and reports a clear install
hint) even when they are absent — mirrors cyborg-sim/server.py.

The point of difference from a plain physics wrapper: every `step`/`get_state`
returns the per-geom world transforms (`geom_xpos` + `geom_xmat`) alongside the
raw state, so the desktop app's live 3D viewer can render and animate the actual
model geometry (boxes/spheres/capsules/…) with no MuJoCo-WASM build — the agent
drives the sim, the observations carry the scene, the viewer reflects it.

Install (the agent should do this per the no-shortcut contract if absent):
    pip install mujoco numpy
"""

import json
import sys
import traceback

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "exeaon-mujoco-sim"
SERVER_VERSION = "0.1.0"

# --- Embedded demo models (MJCF) -------------------------------------------
# Small, primitive-only scenes so the viewer can render every geom without
# needing mesh assets. The agent can also pass its own MJCF via load_model(xml).
DEMO_MODELS = {
    "cartpole": """
<mujoco model="cartpole">
  <option timestep="0.01" gravity="0 0 -9.81"/>
  <worldbody>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.3 0.3 0.35 1"/>
    <body name="cart" pos="0 0 0.1">
      <joint name="slider" type="slide" axis="1 0 0" range="-2 2"/>
      <geom name="cart" type="box" size="0.2 0.15 0.1" rgba="0.2 0.6 0.9 1"/>
      <body name="pole" pos="0 0 0.1">
        <joint name="hinge" type="hinge" axis="0 1 0"/>
        <geom name="pole" type="capsule" fromto="0 0 0 0 0 0.8" size="0.04" rgba="0.95 0.8 0.15 1"/>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor joint="slider" gear="10" ctrlrange="-1 1"/>
  </actuator>
</mujoco>
""",
    "double_pendulum": """
<mujoco model="double_pendulum">
  <option timestep="0.01" gravity="0 0 -9.81"/>
  <worldbody>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.3 0.3 0.35 1"/>
    <body name="upper" pos="0 0 1.2">
      <joint name="j1" type="hinge" axis="0 1 0"/>
      <geom name="upper" type="capsule" fromto="0 0 0 0 0 -0.5" size="0.04" rgba="0.2 0.6 0.9 1"/>
      <body name="lower" pos="0 0 -0.5">
        <joint name="j2" type="hinge" axis="0 1 0"/>
        <geom name="lower" type="capsule" fromto="0 0 0 0 0 -0.5" size="0.04" rgba="0.95 0.8 0.15 1"/>
      </body>
    </body>
  </worldbody>
</mujoco>
""",
    "bouncing_ball": """
<mujoco model="bouncing_ball">
  <option timestep="0.005" gravity="0 0 -9.81"/>
  <worldbody>
    <geom name="floor" type="plane" size="3 3 0.1" rgba="0.3 0.3 0.35 1"/>
    <body name="ball" pos="0 0 1.5">
      <freejoint/>
      <geom name="ball" type="sphere" size="0.15" rgba="0.9 0.3 0.3 1" solref="0.01 0.6"/>
    </body>
  </worldbody>
</mujoco>
""",
    "reacher": """
<mujoco model="reacher">
  <option timestep="0.01" gravity="0 0 0"/>
  <worldbody>
    <geom name="floor" type="plane" size="2 2 0.1" rgba="0.3 0.3 0.35 1"/>
    <body name="link1" pos="0 0 0.1">
      <joint name="shoulder" type="hinge" axis="0 0 1"/>
      <geom name="link1" type="capsule" fromto="0 0 0 0.4 0 0" size="0.04" rgba="0.2 0.6 0.9 1"/>
      <body name="link2" pos="0.4 0 0">
        <joint name="elbow" type="hinge" axis="0 0 1"/>
        <geom name="link2" type="capsule" fromto="0 0 0 0.4 0 0" size="0.035" rgba="0.95 0.8 0.15 1"/>
        <body name="fingertip" pos="0.4 0 0">
          <geom name="tip" type="sphere" size="0.05" rgba="0.3 0.9 0.4 1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor joint="shoulder" gear="1" ctrlrange="-1 1"/>
    <motor joint="elbow" gear="1" ctrlrange="-1 1"/>
  </actuator>
</mujoco>
""",
}

# --- Lazy MuJoCo state ------------------------------------------------------
_STATE = {"mujoco": None, "np": None, "model": None, "data": None, "name": None}


class SimError(Exception):
    pass


def _load_mujoco():
    if _STATE["mujoco"] is None:
        try:
            import mujoco  # type: ignore
            import numpy as np  # type: ignore
        except Exception as exc:  # pragma: no cover - depends on env
            raise SimError(
                "MuJoCo is not installed. Install it before running the "
                "robotics simulation: `pip install mujoco numpy`. "
                f"(import error: {exc})"
            )
        _STATE["mujoco"], _STATE["np"] = mujoco, np
    return _STATE["mujoco"], _STATE["np"]


def _require_model():
    if _STATE["model"] is None or _STATE["data"] is None:
        raise SimError("No model loaded. Call load_model(name=...) first.")
    return _STATE["model"], _STATE["data"]


# MuJoCo geom type ints → viewer-friendly primitive names.
_GEOM_TYPES = {
    0: "plane",
    2: "sphere",
    3: "capsule",
    4: "ellipsoid",
    5: "cylinder",
    6: "box",
    7: "mesh",
}


def _model_schema(mujoco, np, model):
    """Static per-geom descriptors the viewer needs once, on load."""
    geoms = []
    for i in range(model.ngeom):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, i) or f"geom{i}"
        geoms.append(
            {
                "name": name,
                "type": _GEOM_TYPES.get(int(model.geom_type[i]), "box"),
                "size": [float(v) for v in model.geom_size[i]],
                "rgba": [float(v) for v in model.geom_rgba[i]],
            }
        )
    return {
        "name": _STATE["name"],
        "nq": int(model.nq),
        "nv": int(model.nv),
        "nu": int(model.nu),
        "nbody": int(model.nbody),
        "ngeom": int(model.ngeom),
        "timestep": float(model.opt.timestep),
        "geoms": geoms,
    }


def _scene_state(mujoco, np, model, data):
    """Per-step dynamic state: raw + world transforms for rendering."""
    return {
        "time": float(data.time),
        "qpos": [float(v) for v in data.qpos],
        "qvel": [float(v) for v in data.qvel],
        # Row-major 3x3 rotation per geom + world position — the viewer places
        # each primitive from these, so the render is the actual sim.
        "geom_xpos": [[float(v) for v in row] for row in data.geom_xpos],
        "geom_xmat": [[float(v) for v in row] for row in data.geom_xmat],
    }


# --- Tool implementations ---------------------------------------------------
def tool_status(_args):
    try:
        mujoco, _np = _load_mujoco()
        version = getattr(mujoco, "__version__", "unknown")
        loaded = _STATE["name"]
        return {
            "installed": True,
            "mujoco_version": version,
            "loaded_model": loaded,
            "available_models": sorted(DEMO_MODELS.keys()),
        }
    except SimError as exc:
        return {
            "installed": False,
            "hint": str(exc),
            "available_models": sorted(DEMO_MODELS.keys()),
        }


def tool_list_models(_args):
    return {"models": sorted(DEMO_MODELS.keys())}


def tool_load_model(args):
    mujoco, np = _load_mujoco()
    xml = args.get("xml")
    name = args.get("name")
    if xml:
        model = mujoco.MjModel.from_xml_string(xml)
        _STATE["name"] = name or "custom"
    else:
        if not name or name not in DEMO_MODELS:
            raise SimError(
                f"Unknown model '{name}'. Available: {sorted(DEMO_MODELS)} "
                "(or pass your own MJCF via `xml`)."
            )
        model = mujoco.MjModel.from_xml_string(DEMO_MODELS[name])
        _STATE["name"] = name
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    _STATE["model"], _STATE["data"] = model, data
    schema = _model_schema(mujoco, np, model)
    schema["state"] = _scene_state(mujoco, np, model, data)
    return schema


def tool_reset(_args):
    mujoco, np = _load_mujoco()
    model, data = _require_model()
    mujoco.mj_resetData(model, data)
    mujoco.mj_forward(model, data)
    return _scene_state(mujoco, np, model, data)


def tool_set_control(args):
    mujoco, np = _load_mujoco()
    model, data = _require_model()
    ctrl = args.get("ctrl")
    if not isinstance(ctrl, list):
        raise SimError("set_control requires `ctrl`: a list of actuator values.")
    if len(ctrl) != model.nu:
        raise SimError(f"Expected {model.nu} control value(s), got {len(ctrl)}.")
    data.ctrl[:] = np.array(ctrl, dtype=float)
    return {"ok": True, "nu": int(model.nu)}


def tool_step(args):
    mujoco, np = _load_mujoco()
    model, data = _require_model()
    n = int(args.get("n", 1))
    n = max(1, min(n, 10000))
    ctrl = args.get("ctrl")
    if isinstance(ctrl, list) and len(ctrl) == model.nu:
        data.ctrl[:] = np.array(ctrl, dtype=float)
    for _ in range(n):
        mujoco.mj_step(model, data)
    state = _scene_state(mujoco, np, model, data)
    state["steps"] = n
    return state


def tool_get_state(_args):
    mujoco, np = _load_mujoco()
    model, data = _require_model()
    return _scene_state(mujoco, np, model, data)


TOOLS = [
    {
        "name": "mujoco_status",
        "description": "Report whether MuJoCo is installed, its version, the loaded model, and the built-in demo models. Call this first.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_status,
    },
    {
        "name": "list_models",
        "description": "List the built-in demo MJCF models available to load.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_list_models,
    },
    {
        "name": "load_model",
        "description": "Load a model into the simulation. Pass `name` for a built-in demo (cartpole, double_pendulum, bouncing_ball, reacher) or `xml` for custom MJCF. Returns the geom schema (types/sizes/colors) + initial state for the 3D viewer.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "xml": {"type": "string"},
            },
        },
        "_fn": tool_load_model,
    },
    {
        "name": "reset",
        "description": "Reset the loaded simulation to its initial state.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_reset,
    },
    {
        "name": "set_control",
        "description": "Set actuator control inputs. `ctrl`: list of nu values (see load_model schema).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ctrl": {"type": "array", "items": {"type": "number"}},
            },
            "required": ["ctrl"],
        },
        "_fn": tool_set_control,
    },
    {
        "name": "step",
        "description": "Advance the physics `n` steps (default 1). Optionally set `ctrl` first. Returns time, qpos, qvel, and per-geom world transforms (geom_xpos/geom_xmat) that drive the live 3D viewer.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "n": {"type": "integer"},
                "ctrl": {"type": "array", "items": {"type": "number"}},
            },
        },
        "_fn": tool_step,
    },
    {
        "name": "get_state",
        "description": "Return the current sim state (time, qpos, qvel) + per-geom world transforms without stepping.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_get_state,
    },
]

_TOOL_BY_NAME = {t["name"]: t for t in TOOLS}


# --- JSON-RPC / MCP plumbing ------------------------------------------------
def _result(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id, code, message):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def handle(request):
    method = request.get("method")
    request_id = request.get("id")
    params = request.get("params") or {}

    if method == "initialize":
        return _result(
            request_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        )
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return _result(
            request_id,
            {
                "tools": [
                    {k: v for k, v in t.items() if not k.startswith("_")}
                    for t in TOOLS
                ]
            },
        )
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _TOOL_BY_NAME.get(name)
        if not tool:
            return _error(request_id, -32601, f"Unknown tool: {name}")
        try:
            payload = tool["_fn"](args)
            text = json.dumps(payload)
            return _result(request_id, {"content": [{"type": "text", "text": text}]})
        except SimError as exc:
            return _result(
                request_id,
                {
                    "content": [{"type": "text", "text": str(exc)}],
                    "isError": True,
                },
            )
        except Exception as exc:  # pragma: no cover
            return _result(
                request_id,
                {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Simulation error: {exc}\n{traceback.format_exc()}",
                        }
                    ],
                    "isError": True,
                },
            )
    if request_id is not None:
        return _error(request_id, -32601, f"Method not found: {method}")
    return None


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        response = handle(request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
