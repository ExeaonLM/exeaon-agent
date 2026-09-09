#!/usr/bin/env python3
"""Build a LOCAL research reproduction-benchmark task set from CORE-Bench.

Populates `resources/mcp/research-mcp/benchmarks.local.json` (GITIGNORED — never
committed, so the reference answers can't leak) with ~130 real reproduction
tasks drawn from CORE-Bench (arXiv:2409.11363, github.com/siegelz/core-bench):
90 papers, each a "Report the <metric>" question with a numeric answer, keyed by
a real capsule DOI. Repeated runs of the same question are averaged into one
reference (tolerance widened to cover the run spread).

The committed `benchmarks.json` keeps only a small PUBLIC sample; this local file
is the full bar. The research MCP merges both and HIDES `reference` from the
agent (list_benchmark strips it; benchmark_submit scores against it without
revealing it) so the benchmark stays honest.

Usage (needs `gpg` on PATH — ships with Git for Windows — to decrypt the test
split; use --no-test to skip it):
    python scripts/build-benchmark.py
    python scripts/build-benchmark.py --no-test
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import urllib.request

RAW = "https://raw.githubusercontent.com/siegelz/core-bench/main/benchmark/dataset"
TEST_PASSPHRASE = "reproducibility"  # public, per CORE-Bench docs
OUT_DEFAULT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src-tauri", "resources", "mcp", "research-mcp", "benchmarks.local.json",
)


def _slug(s, n=48):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:n] or "task"


def _download(name, dest):
    urllib.request.urlretrieve(f"{RAW}/{name}", dest)


def _load_split(tmp, name, encrypted):
    path = os.path.join(tmp, name)
    if encrypted:
        gpg_path = os.path.join(tmp, name)
        _download(name + ".gpg", gpg_path + ".gpg")
        r = subprocess.run(
            ["gpg", "--batch", "--yes", "--passphrase", TEST_PASSPHRASE,
             "-o", gpg_path, "-d", gpg_path + ".gpg"],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not os.path.isfile(gpg_path):
            print(f"  ! could not decrypt {name} (gpg missing/failed) — skipping test split.")
            return []
    else:
        _download(name, path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _tasks_from(entries, split):
    tasks = []
    for e in entries:
        doi = e.get("capsule_doi", "")
        title = (e.get("capsule_title") or "").strip()
        cid = e.get("capsule_id", "")
        grouped = {}
        for item in e.get("results") or []:
            if not isinstance(item, dict):
                continue
            for q, a in item.items():
                if isinstance(a, (int, float)):
                    grouped.setdefault(q, []).append(float(a))
        for i, (q, vals) in enumerate(grouped.items()):
            ref = statistics.fmean(vals)
            # tolerance covers the run spread (min 5%).
            spread = (max(vals) - min(vals)) / (abs(ref) if abs(ref) > 1e-12 else 1e-12)
            tol = round(max(0.05, spread * 1.5), 4)
            tasks.append({
                "id": f"corebench-{split}-{_slug(cid or title)}-{i}",
                "paper": title or cid,
                "target": q,
                "reference": round(ref, 8),
                "tolerance": tol,
                "hint": (e.get("task_prompt") or "").strip()[:400],
                "provenance": f"CORE-Bench {split} split, capsule {cid}, {doi} (arXiv:2409.11363).",
                "split": split,
                "field": e.get("field", ""),
            })
    return tasks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--no-test", action="store_true",
                    help="skip the encrypted held-out test split (train only)")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        print("Downloading CORE-Bench train split...")
        train = _load_split(tmp, "core_train.json", encrypted=False)
        test = []
        if not args.no_test:
            print("Downloading + decrypting CORE-Bench test split...")
            test = _load_split(tmp, "core_test.json", encrypted=True)

    tasks = _tasks_from(train, "train") + _tasks_from(test, "test")
    out = {
        "name": "CORE-Bench reproduction tasks (local)",
        "version": "0.1.0",
        "source": "github.com/siegelz/core-bench (arXiv:2409.11363)",
        "note": "GENERATED — do not commit (contains reference answers). The MCP hides `reference` from the agent.",
        "tasks": tasks,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    n_test = sum(1 for t in tasks if t["split"] == "test")
    print(f"Wrote {len(tasks)} tasks ({len(tasks) - n_test} train + {n_test} test) -> {args.out}")
    print("This file is gitignored; the agent sees the questions but not the answers.")


if __name__ == "__main__":
    main()
