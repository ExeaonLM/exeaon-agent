#!/usr/bin/env python3
"""Exeaon Engineering Labs — Research integrity + war-room MCP server.

A dependency-free MCP stdio server (newline-delimited JSON-RPC 2.0, MCP
2024-11-05) that gives the Research field its integrity tools AND feeds the live
research war-room viewer with structured state (sources, claims, originality).

Honest scope (no snake-oil):
  * check_originality  — OFFLINE verbatim/near-duplicate overlap of a draft
    against the sources the agent actually gathered (n-gram overlap + longest
    common spans). Real plagiarism needs a corpus/the web; for that the agent
    uses its browser tool to search suspicious phrases. This catches copied
    spans from your own cited sources.
  * humanize_review    — heuristic readability/AI-tell feedback (sentence-length
    variance, repeated phrases, hedge density) for the model to self-revise. Not
    a rewriter, not an AI-detector bypass — honest signal only.
  * record_source / log_claim / integrity_report — structured research state
    that also drives the war-room viewer (sources list, claim/evidence/
    falsification scorecard).

Everything is stdlib-only and offline.
"""

import json
import os
import re
import sys
import traceback

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "exeaon-research"
SERVER_VERSION = "0.1.0"

_STATE = {"sources": [], "claims": [], "originality": None, "reproductions": []}

_WORD_RE = re.compile(r"\w+")
_SENT_RE = re.compile(r"[.!?]+")
_HEDGES = {
    "may", "might", "could", "possibly", "perhaps", "arguably", "seems",
    "suggests", "likely", "generally", "often", "somewhat", "relatively",
}


def _words(text):
    return _WORD_RE.findall(text.lower())


def _ngrams(tokens, n):
    return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


# Hard caps so the (single-threaded, stdio) server can never be blocked or OOM'd
# by a huge draft/source — a full manuscript + 200k-char sources previously hung
# the loop for the whole finishing phase. Overlap is computed by n-gram SET
# intersection (near-linear), not the old O(n^2) substring span search.
_MAX_ANALYZE_CHARS = 60000
_MAX_SOURCES = 20


class ResearchError(Exception):
    pass


def tool_status(_args):
    return {
        "ok": True,
        "sources": len(_STATE["sources"]),
        "claims": len(_STATE["claims"]),
        "hasOriginality": _STATE["originality"] is not None,
    }


def tool_record_source(args):
    url = (args.get("url") or "").strip()
    if not url:
        raise ResearchError("record_source requires `url`.")
    entry = {
        "url": url,
        "title": (args.get("title") or "").strip(),
        "note": (args.get("note") or "").strip(),
    }
    _STATE["sources"].append(entry)
    return {"ok": True, "sources": len(_STATE["sources"]), "source": entry}


def tool_log_claim(args):
    claim = (args.get("claim") or "").strip()
    if not claim:
        raise ResearchError("log_claim requires `claim`.")
    entry = {
        "claim": claim,
        "evidence": (args.get("evidence") or "").strip(),
        "falsification": (args.get("falsification") or "").strip(),
    }
    _STATE["claims"].append(entry)
    return {"ok": True, "claims": len(_STATE["claims"]), "claim": entry}


def tool_check_originality(args):
    draft = (args.get("draft") or "")[:_MAX_ANALYZE_CHARS]
    sources = args.get("sources")
    if not isinstance(sources, list):
        # Fall back to the source notes recorded so far (they may be short).
        sources = [s.get("note", "") for s in _STATE["sources"] if s.get("note")]
    if not draft.strip():
        raise ResearchError("check_originality requires `draft` text.")

    draft_tokens = _words(draft)
    if not draft_tokens:
        raise ResearchError("draft has no words to check.")
    N = 8
    draft_ngrams = _ngrams(draft_tokens, N) if len(draft_tokens) >= N else set()

    # n-gram SET overlap: near-linear, and a shared 8-gram IS an 8-word verbatim
    # copied span — so the intersection gives both the score and the flags.
    worst = 0.0
    flagged = []
    for src in sources[:_MAX_SOURCES]:
        src_text = (src if isinstance(src, str) else str(src))[:_MAX_ANALYZE_CHARS]
        src_ngrams = _ngrams(_words(src_text), N)
        if draft_ngrams and src_ngrams:
            common = draft_ngrams & src_ngrams
            overlap = len(common) / max(1, len(draft_ngrams))
            flagged.extend(sorted(common)[:5])
        else:
            overlap = 0.0
        worst = max(worst, overlap)

    originality = round(1.0 - worst, 3)
    result = {
        "originality": originality,  # 1.0 = fully original vs the given sources
        "maxOverlap": round(worst, 3),
        "flaggedSpans": flagged[:5],
        "sourcesChecked": len(sources),
        "note": "Offline overlap vs the given sources only. Use the browser to "
        "web-check suspicious phrases for true plagiarism.",
    }
    _STATE["originality"] = originality
    return result


def tool_humanize_review(args):
    text = (args.get("text") or "")[:_MAX_ANALYZE_CHARS]
    if not text.strip():
        raise ResearchError("humanize_review requires `text`.")
    sentences = [s.strip() for s in _SENT_RE.split(text) if s.strip()]
    lengths = [len(_words(s)) for s in sentences] or [0]
    avg = sum(lengths) / len(lengths)
    variance = sum((x - avg) ** 2 for x in lengths) / len(lengths)
    tokens = _words(text)
    trigrams = {}
    for i in range(len(tokens) - 2):
        g = " ".join(tokens[i : i + 3])
        trigrams[g] = trigrams.get(g, 0) + 1
    repeated = sorted(
        [(g, c) for g, c in trigrams.items() if c >= 3],
        key=lambda x: -x[1],
    )[:5]
    hedges = sum(1 for w in tokens if w in _HEDGES)
    hedge_density = round(hedges / max(1, len(tokens)), 4)

    suggestions = []
    if variance < 6 and len(sentences) > 3:
        suggestions.append(
            "Sentence lengths are uniform (robotic cadence) — vary them."
        )
    if repeated:
        suggestions.append(
            "Repeated phrases detected — rephrase for variety: "
            + ", ".join(f'"{g}"' for g, _ in repeated[:3])
        )
    if hedge_density > 0.02:
        suggestions.append(
            "High hedging density — make claims precise or commit to them."
        )
    if not suggestions:
        suggestions.append("No strong AI-tells detected on these heuristics.")

    return {
        "sentences": len(sentences),
        "avgSentenceWords": round(avg, 1),
        "sentenceLengthVariance": round(variance, 1),
        "repeatedPhrases": [{"phrase": g, "count": c} for g, c in repeated],
        "hedgeDensity": hedge_density,
        "suggestions": suggestions,
        "note": "Heuristic readability signal for self-revision — not an "
        "AI-detector or a rewriter.",
    }


def tool_score_reproduction(args):
    """Score a reproduced quantity against the paper's reported value — the core
    'did we actually reproduce it?' check (Faraday/Replica-style). Records a
    pass/fail by relative error so every run carries a reproduction scorecard."""
    name = (args.get("name") or "").strip() or "result"
    try:
        claimed = float(args.get("claimed"))
        reference = float(args.get("reference"))
    except (TypeError, ValueError):
        raise ResearchError(
            "score_reproduction needs numeric `claimed` (your reproduced value) "
            "and `reference` (the paper's reported value)."
        )
    try:
        tol = float(args.get("tolerance", 0.05))
    except (TypeError, ValueError):
        tol = 0.05
    tol = max(0.0, min(tol, 1.0))
    denom = abs(reference) if abs(reference) > 1e-12 else 1e-12
    rel_error = abs(claimed - reference) / denom
    match = rel_error <= tol
    entry = {
        "name": name,
        "claimed": claimed,
        "reference": reference,
        "tolerance": tol,
        "relError": round(rel_error, 6),
        "match": match,
        "note": (args.get("note") or "").strip(),
    }
    _STATE["reproductions"].append(entry)
    return {"ok": True, "reproduction": entry,
            "reproductions": len(_STATE["reproductions"])}


def tool_integrity_report(_args):
    claims = _STATE["claims"]
    with_evidence = sum(1 for c in claims if c["evidence"])
    with_falsification = sum(1 for c in claims if c["falsification"])
    reps = _STATE["reproductions"]
    reps_matched = sum(1 for r in reps if r["match"])

    # Composite research-integrity grade (0-100): the mean of the quality
    # dimensions that actually have data — so a run is GRADED, not just logged.
    # Only-measured dimensions count (no data ≠ a zero). Honest, offline signal.
    subscores = {}
    if claims:
        subscores["evidence"] = round(with_evidence / len(claims), 3)
        subscores["falsification"] = round(with_falsification / len(claims), 3)
    if reps:
        subscores["reproduction"] = round(reps_matched / len(reps), 3)
    if _STATE["originality"] is not None:
        subscores["originality"] = round(float(_STATE["originality"]), 3)
    grade = round(100 * sum(subscores.values()) / len(subscores), 1) if subscores else None

    return {
        "sources": _STATE["sources"],
        "claims": claims,
        "reproductions": reps,
        "counts": {
            "sources": len(_STATE["sources"]),
            "claims": len(claims),
            "claimsWithEvidence": with_evidence,
            "claimsWithFalsification": with_falsification,
            "reproductions": len(reps),
            "reproductionsMatched": reps_matched,
        },
        "originality": _STATE["originality"],
        "grade": grade,
        "subscores": subscores,
    }


def _read_pdf(path):
    try:
        import pypdf  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on env
        raise ResearchError(
            "Reading PDF needs pypdf. Install it into the runtime: "
            f"`pip install pypdf`. (import error: {exc})"
        )
    reader = pypdf.PdfReader(path)
    pages = [(pg.extract_text() or "") for pg in reader.pages]
    return "\n\n".join(pages), {"pages": len(reader.pages)}


def _read_docx(path):
    # DOCX is a zip of XML — extract the paragraph text runs with stdlib only.
    import zipfile
    import xml.etree.ElementTree as ET

    W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    paras = []
    for p in root.iter(f"{W}p"):
        runs = [t.text for t in p.iter(f"{W}t") if t.text]
        paras.append("".join(runs))
    return "\n".join(paras), {"paragraphs": len(paras)}


def tool_read_document(args):
    path = (args.get("path") or "").strip()
    if not path:
        raise ResearchError("read_document requires a file `path`.")
    if not os.path.isfile(path):
        raise ResearchError(f"No such file: {path}")
    max_chars = int(args.get("max_chars", 20000))
    max_chars = max(500, min(max_chars, 200000))
    ext = os.path.splitext(path)[1].lower()

    meta = {}
    if ext == ".pdf":
        text, meta = _read_pdf(path)
        kind = "pdf"
    elif ext == ".docx":
        text, meta = _read_docx(path)
        kind = "docx"
    elif ext in (".tex", ".txt", ".md", ".markdown", ".rst", ".csv", ".json"):
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        kind = "latex" if ext == ".tex" else "text"
    else:
        raise ResearchError(
            f"Unsupported extension '{ext}'. Supported: .pdf, .docx, .tex, "
            ".txt, .md, .csv, .json (LaTeX/text are read directly)."
        )

    truncated = len(text) > max_chars
    return {
        "kind": kind,
        "path": path,
        "chars": len(text),
        "truncated": truncated,
        "text": text[:max_chars],
        **meta,
    }


def tool_reset(_args):
    _STATE["sources"] = []
    _STATE["claims"] = []
    _STATE["originality"] = None
    _STATE["reproductions"] = []
    return {"ok": True}


TOOLS = [
    {
        "name": "research_status",
        "description": "Report the research session state (sources/claims counts). Call first.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_status,
    },
    {
        "name": "record_source",
        "description": "Log a source you actually consulted: `url` (required), optional `title`, `note` (short quote/summary you may cite). Feeds the war-room sources list.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "title": {"type": "string"},
                "note": {"type": "string"},
            },
            "required": ["url"],
        },
        "_fn": tool_record_source,
    },
    {
        "name": "log_claim",
        "description": "Record a claim with its `evidence` and the `falsification` attempt you made against it. Feeds the integrity scorecard.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "claim": {"type": "string"},
                "evidence": {"type": "string"},
                "falsification": {"type": "string"},
            },
            "required": ["claim"],
        },
        "_fn": tool_log_claim,
    },
    {
        "name": "check_originality",
        "description": "Offline verbatim/near-duplicate overlap of `draft` against `sources` (list of source texts; defaults to recorded source notes). Returns an originality score (1=original) + flagged copied spans. NOT a web plagiarism check — use the browser for that.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "draft": {"type": "string"},
                "sources": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["draft"],
        },
        "_fn": tool_check_originality,
    },
    {
        "name": "humanize_review",
        "description": "Heuristic readability / AI-tell review of `text` (sentence-length variance, repeated phrases, hedge density) with suggestions to self-revise. Honest signal only — not an AI-detector bypass.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        "_fn": tool_humanize_review,
    },
    {
        "name": "score_reproduction",
        "description": "Score a value you REPRODUCED against the paper's reported value — the core 'did we actually reproduce it?' check. Args: `claimed` (your reproduced number, required), `reference` (the paper's reported number, required), `name` (what it is, e.g. 'AWQ 4-bit perplexity'), `tolerance` (relative, default 0.05), `note`. Records a pass/fail into the reproduction scorecard (integrity_report).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "claimed": {"type": "number"},
                "reference": {"type": "number"},
                "name": {"type": "string"},
                "tolerance": {"type": "number"},
                "note": {"type": "string"},
            },
            "required": ["claimed", "reference"],
        },
        "_fn": tool_score_reproduction,
    },
    {
        "name": "integrity_report",
        "description": "Summarize the research session: sources, claims (with evidence + falsification), reproduction scorecard (claimed vs reference, pass/fail), and last originality — the integrity scorecard.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_integrity_report,
    },
    {
        "name": "read_document",
        "description": "Read/extract text from a document so you can actually read it: PDF (.pdf), Word (.docx), LaTeX (.tex), and plain text (.txt/.md/.csv/.json). Pass `path`; optional `max_chars` (default 20000). Returns extracted text + kind + page/paragraph count.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_chars": {"type": "integer"},
            },
            "required": ["path"],
        },
        "_fn": tool_read_document,
    },
    {
        "name": "reset_research",
        "description": "Clear the recorded sources/claims/originality for a fresh investigation.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_reset,
    },
]

_TOOL_BY_NAME = {t["name"]: t for t in TOOLS}


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
        except ResearchError as exc:
            return _result(
                rid,
                {"content": [{"type": "text", "text": str(exc)}], "isError": True},
            )
        except Exception as exc:  # pragma: no cover
            return _result(
                rid,
                {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Research tool error: {exc}\n{traceback.format_exc()}",
                        }
                    ],
                    "isError": True,
                },
            )
    if rid is not None:
        return _error(rid, -32601, f"Method not found: {method}")
    return None


def main():
    # A single bad request, an unexpected error, or a closed pipe must NEVER
    # take the server down — that orphaned the war-room mid-run before. Every
    # step is guarded; the loop only ends on real EOF or a broken stdout.
    while True:
        try:
            line = sys.stdin.readline()
        except Exception:
            break
        if line == "":  # EOF — the agent-server closed stdin
            break
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(request, dict):
            continue
        try:
            response = handle(request)
        except Exception as exc:  # handle() already guards tools; belt-and-braces
            rid = request.get("id")
            response = _error(rid, -32603, f"internal error: {exc}") if rid is not None else None
        if response is None:
            continue
        try:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except (BrokenPipeError, ValueError):
            break  # pipe closed — nothing left to serve
        except Exception:
            continue  # a single un-writable response must not kill the loop


if __name__ == "__main__":
    main()
