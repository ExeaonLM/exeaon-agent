#!/usr/bin/env python3
"""Exeaon Engineering Labs — Computing / RTL simulation MCP server.

A dependency-free-*protocol* MCP stdio server (newline-delimited JSON-RPC 2.0,
MCP 2024-11-05) that compiles and simulates Verilog and returns parsed VCD
waveforms — so the desktop app's waveform viewer renders real signal traces.

Engine: Icarus Verilog (`iverilog` + `vvp`), a self-contained simulator that
emits VCD directly (no C++ toolchain, unlike Verilator) — so it bundles cleanly
on Windows. The simulator binary is found on PATH or in the app's bundled bin
dir (RTL_BIN_DIR / CYBER_BIN_DIR / <mcpRoot>/bin). When absent the server
reports a clear install hint, mirroring mujoco-sim / cyborg-sim.

Install (agent does this on demand if not bundled):
    winget install --id=IcarusVerilog.IcarusVerilog   # or scoop install iverilog
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "exeaon-rtl-sim"
SERVER_VERSION = "0.1.0"

# --- Built-in example designs (design + self-checking VCD testbench) --------
EXAMPLES = {
    "counter": {
        "top": "tb",
        "design": """
module counter(input clk, input rst, output reg [3:0] q);
  always @(posedge clk or posedge rst)
    if (rst) q <= 0; else q <= q + 1;
endmodule
""",
        "testbench": """
module tb;
  reg clk = 0, rst = 1; wire [3:0] q;
  counter dut(.clk(clk), .rst(rst), .q(q));
  always #5 clk = ~clk;
  initial begin
    $dumpfile("dump.vcd"); $dumpvars(0, tb);
    #12 rst = 0;
    #160 $finish;
  end
endmodule
""",
    },
    "adder": {
        "top": "tb",
        "design": """
module adder(input [3:0] a, input [3:0] b, output [4:0] sum);
  assign sum = a + b;
endmodule
""",
        "testbench": """
module tb;
  reg [3:0] a, b; wire [4:0] sum;
  adder dut(.a(a), .b(b), .sum(sum));
  initial begin
    $dumpfile("dump.vcd"); $dumpvars(0, tb);
    a=0; b=0; #10;
    a=3; b=4; #10;
    a=9; b=7; #10;
    a=15; b=15; #10;
    $finish;
  end
endmodule
""",
    },
    "dff": {
        "top": "tb",
        "design": """
module dff(input clk, input d, output reg q);
  always @(posedge clk) q <= d;
endmodule
""",
        "testbench": """
module tb;
  reg clk = 0, d = 0; wire q;
  dff dut(.clk(clk), .d(d), .q(q));
  always #5 clk = ~clk;
  initial begin
    $dumpfile("dump.vcd"); $dumpvars(0, tb);
    #7 d=1; #10 d=0; #10 d=1; #20 d=0; #20 $finish;
  end
endmodule
""",
    },
}


class RtlError(Exception):
    pass


def _bin_dirs():
    dirs = []
    for env in ("RTL_BIN_DIR", "EXEAON_MCP_BIN", "CYBER_BIN_DIR"):
        v = os.environ.get(env)
        if v:
            dirs.append(v)
    here = os.path.dirname(os.path.abspath(__file__))
    dirs.append(os.path.join(here, "..", "bin"))
    # Self-contained Icarus Verilog tree staged by scripts/bundle-sim-deps.ps1
    # (<mcpRoot>/iverilog/bin/iverilog.exe finds its ../lib relative to itself).
    dirs.append(os.path.join(here, "..", "iverilog", "bin"))
    return dirs


def _find(tool):
    """Locate a simulator executable on PATH or in the bundled bin dirs."""
    exe = shutil.which(tool)
    if exe:
        return exe
    names = [tool, tool + ".exe"]
    for d in _bin_dirs():
        for n in names:
            cand = os.path.join(d, n)
            if os.path.isfile(cand):
                return cand
    return None


def _iverilog():
    exe = _find("iverilog")
    if not exe:
        raise RtlError(
            "Icarus Verilog (iverilog) is not installed. Install it before "
            "running the RTL simulation: `winget install "
            "--id=IcarusVerilog.IcarusVerilog` (or `scoop install iverilog`), "
            "or drop iverilog/vvp into the app's mcp/bin folder."
        )
    return exe


# --- VCD parsing (stdlib) ---------------------------------------------------
def parse_vcd(text):
    """Parse a VCD dump into {timescale, signals:[{name,width,wave:[[t,val]]}]}."""
    timescale = "1ns"
    id_to_sig = {}  # vcd id char(s) -> {name, width, wave}
    order = []
    cur_time = 0

    lines = text.splitlines()
    i = 0
    in_defs = True
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line:
            continue
        if in_defs:
            if line.startswith("$timescale"):
                # may be inline or on next lines up to $end
                body = line.replace("$timescale", "")
                while "$end" not in body and i < len(lines):
                    body += " " + lines[i].strip()
                    i += 1
                timescale = body.replace("$end", "").strip() or timescale
            elif line.startswith("$var"):
                # $var wire 4 ! q [3:0] $end
                parts = line.split()
                if len(parts) >= 5:
                    width = int(parts[2])
                    vid = parts[3]
                    name = parts[4]
                    if len(parts) >= 6 and parts[5].startswith("["):
                        name += parts[5]
                    sig = {"name": name, "width": width, "wave": []}
                    id_to_sig[vid] = sig
                    order.append(vid)
            elif line.startswith("$enddefinitions"):
                in_defs = False
            continue
        # value-change section
        if line[0] == "#":
            try:
                cur_time = int(line[1:])
            except ValueError:
                pass
        elif line[0] in "01xzXZ":
            vid = line[1:]
            sig = id_to_sig.get(vid)
            if sig is not None:
                sig["wave"].append([cur_time, line[0]])
        elif line[0] in "bB":
            m = re.match(r"[bB]([01xzXZ]+)\s+(\S+)", line)
            if m:
                sig = id_to_sig.get(m.group(2))
                if sig is not None:
                    sig["wave"].append([cur_time, m.group(1)])
        elif line[0] in "rR":
            m = re.match(r"[rR](\S+)\s+(\S+)", line)
            if m:
                sig = id_to_sig.get(m.group(2))
                if sig is not None:
                    sig["wave"].append([cur_time, m.group(1)])

    signals = [id_to_sig[v] for v in order if id_to_sig[v]["wave"]]
    end_time = cur_time
    return {"timescale": timescale, "end_time": end_time, "signals": signals}


_LAST = {"waveform": None, "log": None}


def _run_sim(design, testbench, top):
    iverilog = _iverilog()
    vvp = _find("vvp") or os.path.join(os.path.dirname(iverilog), "vvp")
    with tempfile.TemporaryDirectory() as wd:
        dpath = os.path.join(wd, "design.v")
        tpath = os.path.join(wd, "tb.v")
        out = os.path.join(wd, "sim.out")
        with open(dpath, "w", encoding="utf-8") as f:
            f.write(design)
        with open(tpath, "w", encoding="utf-8") as f:
            f.write(testbench)
        comp = subprocess.run(
            [iverilog, "-o", out, "-s", top, dpath, tpath],
            capture_output=True,
            text=True,
            cwd=wd,
            timeout=60,
        )
        if comp.returncode != 0:
            raise RtlError(
                "Compilation failed:\n" + (comp.stderr or comp.stdout or "").strip()
            )
        run = subprocess.run(
            [vvp, out], capture_output=True, text=True, cwd=wd, timeout=60
        )
        vcd_path = os.path.join(wd, "dump.vcd")
        waveform = None
        if os.path.isfile(vcd_path):
            with open(vcd_path, "r", encoding="utf-8", errors="replace") as f:
                waveform = parse_vcd(f.read())
        log = ((comp.stderr or "") + (run.stdout or "") + (run.stderr or "")).strip()
        if waveform is None:
            raise RtlError(
                "Simulation produced no VCD. The testbench must call "
                '`$dumpfile("dump.vcd"); $dumpvars;`.\nLog:\n' + log
            )
        _LAST["waveform"] = waveform
        _LAST["log"] = log
        return {
            "log": log[:4000],
            "timescale": waveform["timescale"],
            "end_time": waveform["end_time"],
            "signals": waveform["signals"],
        }


# --- Tool implementations ---------------------------------------------------
def tool_status(_args):
    exe = _find("iverilog")
    if exe:
        try:
            ver = subprocess.run(
                [exe, "-V"], capture_output=True, text=True, timeout=10
            ).stdout.splitlines()
            version = ver[0] if ver else "unknown"
        except Exception:
            version = "unknown"
        return {"installed": True, "iverilog": exe, "version": version,
                "examples": sorted(EXAMPLES.keys())}
    return {
        "installed": False,
        "hint": "Icarus Verilog not found. `winget install "
        "--id=IcarusVerilog.IcarusVerilog` or `scoop install iverilog`.",
        "examples": sorted(EXAMPLES.keys()),
    }


def tool_list_examples(_args):
    return {"examples": sorted(EXAMPLES.keys())}


def tool_simulate(args):
    example = args.get("example")
    if example:
        if example not in EXAMPLES:
            raise RtlError(
                f"Unknown example '{example}'. Available: {sorted(EXAMPLES)}."
            )
        ex = EXAMPLES[example]
        return _run_sim(ex["design"], ex["testbench"], ex["top"])
    design = args.get("verilog")
    testbench = args.get("testbench")
    top = args.get("top", "tb")
    if not design or not testbench:
        raise RtlError(
            "simulate requires either `example`, or both `verilog` (design) "
            "and `testbench` (with $dumpfile/$dumpvars). Optional `top` "
            "(default 'tb')."
        )
    return _run_sim(design, testbench, top)


def tool_get_waveform(_args):
    if _LAST["waveform"] is None:
        raise RtlError("No simulation has run yet. Call simulate first.")
    wf = _LAST["waveform"]
    return {
        "timescale": wf["timescale"],
        "end_time": wf["end_time"],
        "signals": wf["signals"],
    }


TOOLS = [
    {
        "name": "rtl_status",
        "description": "Report whether Icarus Verilog (iverilog) is installed, its version, and the built-in examples. Call this first.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_status,
    },
    {
        "name": "list_examples",
        "description": "List the built-in Verilog example designs (counter, adder, dff).",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_list_examples,
    },
    {
        "name": "simulate",
        "description": "Compile + simulate Verilog and return the parsed VCD waveform (drives the waveform viewer). Pass `example` for a built-in, or `verilog` (design) + `testbench` (must $dumpfile/$dumpvars) + optional `top`.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "example": {"type": "string"},
                "verilog": {"type": "string"},
                "testbench": {"type": "string"},
                "top": {"type": "string"},
            },
        },
        "_fn": tool_simulate,
    },
    {
        "name": "get_waveform",
        "description": "Return the most recent simulation's parsed waveform (timescale, end_time, per-signal value-change traces).",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_get_waveform,
    },
]

_TOOL_BY_NAME = {t["name"]: t for t in TOOLS}


# --- JSON-RPC / MCP plumbing ------------------------------------------------
def _result(rid, result):
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _error(rid, code, message):
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def handle(request):
    method = request.get("method")
    rid = request.get("id")
    params = request.get("params") or {}

    if method == "initialize":
        return _result(
            rid,
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
            rid,
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
            return _error(rid, -32601, f"Unknown tool: {name}")
        try:
            payload = tool["_fn"](args)
            return _result(
                rid, {"content": [{"type": "text", "text": json.dumps(payload)}]}
            )
        except RtlError as exc:
            return _result(
                rid, {"content": [{"type": "text", "text": str(exc)}], "isError": True}
            )
        except Exception as exc:  # pragma: no cover
            return _result(
                rid,
                {
                    "content": [
                        {
                            "type": "text",
                            "text": f"RTL sim error: {exc}\n{traceback.format_exc()}",
                        }
                    ],
                    "isError": True,
                },
            )
    if rid is not None:
        return _error(rid, -32601, f"Method not found: {method}")
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
