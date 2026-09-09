#!/usr/bin/env python3
"""Build the LOCAL research reproduction-benchmark task set (multi-source).

Populates `resources/mcp/research-mcp/benchmarks.local.json` (GITIGNORED — never
committed, so the reference answers can't leak) from real, public reproduction /
quantitative-reasoning benchmarks. Each task is a "Report/compute <target>"
question with a checkable answer (numeric with a tolerance, or exact-match for a
categorical / multiple-choice answer).

Sources (each an adapter below; a failing source is non-fatal — the others still
build, so `bump it` = add one more adapter):
  * CORE-Bench  (arXiv:2409.11363, github.com/siegelz/core-bench) — 90 capsules,
    "Report the <metric>" questions keyed by a real capsule DOI. numeric + exact.
  * QRData       (github.com/xxxiaol/QRData) — 411 quantitative-reasoning tasks
    over real CSVs; short numeric or multiple-choice answers. numeric + exact.

Together these yield ~500+ tasks (well past the 300-400 bar). The committed
`benchmarks.json` keeps only a small PUBLIC sample; this local file is the full
bar. The research MCP merges both and HIDES `reference` from the agent
(list_benchmark strips it; benchmark_submit scores against it without revealing
it) so the benchmark stays honest.

Usage (CORE-Bench test split needs `gpg` on PATH — ships with Git for Windows):
    python scripts/build-benchmark.py                 # all sources
    python scripts/build-benchmark.py --no-test       # skip CORE-Bench test split
    python scripts/build-benchmark.py --only qrdata   # one source
"""

import argparse
import ast
import json
import os
import re
import statistics
import subprocess
import tempfile
import urllib.request

CORE_RAW = "https://raw.githubusercontent.com/siegelz/core-bench/main/benchmark/dataset"
QRDATA_RAW = "https://raw.githubusercontent.com/xxxiaol/QRData/main/benchmark"
TEST_PASSPHRASE = "reproducibility"  # public, per CORE-Bench docs
OUT_DEFAULT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "src-tauri", "resources", "mcp", "research-mcp", "benchmarks.local.json",
)
_UA = {"User-Agent": "exeaon-bench"}


def _slug(s, n=48):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:n] or "task"


def _get_json(url):
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def _decimals(answer_str):
    m = re.search(r"\.(\d+)", str(answer_str))
    return len(m.group(1)) if m else 0


# --------------------------------------------------------------------------- #
# Adapter 1 — CORE-Bench
# --------------------------------------------------------------------------- #
def _core_load_split(tmp, name, encrypted):
    path = os.path.join(tmp, name)
    if encrypted:
        urllib.request.urlretrieve(f"{CORE_RAW}/{name}.gpg", path + ".gpg")
        r = subprocess.run(
            ["gpg", "--batch", "--yes", "--passphrase", TEST_PASSPHRASE,
             "-o", path, "-d", path + ".gpg"],
            capture_output=True, text=True,
        )
        if r.returncode != 0 or not os.path.isfile(path):
            print(f"  ! could not decrypt {name} (gpg missing/failed) — skipping test split.")
            return []
    else:
        urllib.request.urlretrieve(f"{CORE_RAW}/{name}", path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _core_tasks(entries, split):
    tasks = []
    for e in entries:
        doi = e.get("capsule_doi", "")
        title = (e.get("capsule_title") or "").strip()
        cid = e.get("capsule_id", "")
        grouped = {}
        for item in e.get("results") or []:
            if isinstance(item, dict):
                for q, a in item.items():
                    grouped.setdefault(q, []).append(a)
        for i, (q, vals) in enumerate(grouped.items()):
            nums = [float(v) for v in vals if isinstance(v, (int, float))]
            base = {
                "id": f"corebench-{split}-{_slug(cid or title)}-{i}",
                "paper": title or cid,
                "target": q,
                "hint": (e.get("task_prompt") or "").strip()[:400],
                "provenance": f"CORE-Bench {split} split, capsule {cid}, {doi} (arXiv:2409.11363).",
                "split": split,
                "field": e.get("field", ""),
            }
            if nums:  # numeric task
                ref = statistics.fmean(nums)
                spread = (max(nums) - min(nums)) / (abs(ref) if abs(ref) > 1e-12 else 1e-12)
                base.update(type="numeric", reference=round(ref, 8),
                            tolerance=round(max(0.05, spread * 1.5), 4))
            else:  # categorical / string answer → exact match
                base.update(type="exact", reference=str(vals[0]).strip())
            tasks.append(base)
    return tasks


def source_corebench(no_test=False):
    with tempfile.TemporaryDirectory() as tmp:
        print("  CORE-Bench: train split...")
        train = _core_load_split(tmp, "core_train.json", encrypted=False)
        test = []
        if not no_test:
            print("  CORE-Bench: test split (decrypting)...")
            test = _core_load_split(tmp, "core_test.json", encrypted=True)
    return _core_tasks(train, "train") + _core_tasks(test, "test")


# --------------------------------------------------------------------------- #
# Adapter 2 — QRData (quantitative reasoning over real data files)
# --------------------------------------------------------------------------- #
def source_qrdata(**_):
    print("  QRData: QRData.json...")
    rows = _get_json(f"{QRDATA_RAW}/QRData.json")
    tasks = []
    for i, e in enumerate(rows):
        ans = str(e.get("answer", "")).strip()
        if not ans:
            continue
        try:
            files = ast.literal_eval(e.get("data_files") or "[]")
        except Exception:
            files = []
        data_url = f"{QRDATA_RAW}/data/{files[0]}" if files else ""
        desc = (e.get("data_description") or "").strip()
        base = {
            "id": f"qrdata-{i}",
            "paper": (desc[:80] or "QRData"),
            "target": (e.get("question") or "").strip(),
            "hint": (desc[:300] + (f"  Data: {data_url}" if data_url else "")).strip(),
            "provenance": "QRData (github.com/xxxiaol/QRData), arXiv:2402.17644.",
            "split": "qrdata",
            "field": "quantitative-reasoning",
            "dataUrl": data_url,
        }
        try:
            ref = float(ans.replace(",", ""))
            d = _decimals(ans)
            base.update(type="numeric", reference=ref, tolerance=0.05,
                        abs_tol=round(0.5 * 10 ** (-d), max(0, d) + 1) if d else 0.001)
        except ValueError:
            base.update(type="exact", reference=ans)
        tasks.append(base)
    return tasks


SOURCES = {"corebench": source_corebench, "qrdata": source_qrdata}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--no-test", action="store_true",
                    help="skip the CORE-Bench encrypted held-out test split")
    ap.add_argument("--only", choices=list(SOURCES),
                    help="build only one source (default: all)")
    args = ap.parse_args()

    chosen = [args.only] if args.only else list(SOURCES)
    tasks = []
    for name in chosen:
        try:
            print(f"Source: {name}")
            got = SOURCES[name](no_test=args.no_test) if name == "corebench" else SOURCES[name]()
            print(f"  -> {len(got)} tasks")
            tasks.extend(got)
        except Exception as exc:  # a bad source must never sink the others
            print(f"  ! source {name} failed ({exc}) — skipping.")

    n_num = sum(1 for t in tasks if t.get("type") == "numeric")
    out = {
        "name": "Exeaon reproduction benchmark (local, multi-source)",
        "version": "0.2.0",
        "source": "CORE-Bench (arXiv:2409.11363) + QRData (arXiv:2402.17644)",
        "note": "GENERATED — do not commit (contains reference answers). The MCP hides `reference`.",
        "tasks": tasks,
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(f"Wrote {len(tasks)} tasks ({n_num} numeric + {len(tasks) - n_num} exact-match) -> {args.out}")
    print("This file is gitignored; the agent sees the questions but not the answers.")


if __name__ == "__main__":
    main()
