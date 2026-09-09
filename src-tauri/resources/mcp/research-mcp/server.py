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
  * proofread / grammar_check / academic_style / detect_ai_text /
    paraphrase_targets — the writing/QC suite. All stdlib heuristics that return
    SIGNAL (flags, positions, scores + Flesch/FK readability), never a secret
    rewrite: the model fixes grammar, paraphrases, and humanizes using the
    signal. detect_ai_text is explicitly NON-authoritative (no detector is).
  * score_reproduction / record_formalization — the evidence scorecards.
    score_reproduction checks a NUMBER you reproduced against the paper's; and
    record_formalization maps a machine-checked theorem (Lean/Coq/Isabelle you
    independently `lake build`-checked) to the paper's claim, grading whether the
    formal statement actually ENTAILS it (verified) or is weaker / a gap vs the
    target (e.g. Clay) formulation. Both feed the composite integrity grade.
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
SERVER_VERSION = "0.3.0"

_STATE = {"sources": [], "claims": [], "originality": None,
          "reproductions": [], "judgment": None, "benchmark": {},
          "formalizations": []}

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


# ---------------------------------------------------------------------------
# Writing / QC suite — honest, stdlib-only heuristics.
#
# None of these secretly rewrite for you. Each returns actionable SIGNAL
# (flags, positions, scores) and the MODEL does the actual grammar fix,
# paraphrase, or humanizing pass using that signal. No AI-text detector is
# authoritative and every tool says so — this is self-revision help, not a
# detector-bypass or a plagiarism launderer.
# ---------------------------------------------------------------------------

_VOWEL = set("aeiou")
# Words that turn up disproportionately in machine-generated prose.
_AI_TELLS = {
    "delve", "delves", "delving", "tapestry", "underscore", "underscores",
    "underscoring", "moreover", "furthermore", "additionally", "notably",
    "crucial", "pivotal", "realm", "realms", "landscape", "leverage",
    "leveraging", "seamless", "seamlessly", "holistic", "multifaceted",
    "nuanced", "intricate", "intricacies", "showcase", "showcases",
    "testament", "paramount", "boasts", "elevate", "elevates", "unlock",
    "unlocking", "myriad", "plethora", "vibrant", "bustling", "meticulous",
    "meticulously", "comprehensive", "furthermore", "consequently",
}
_INFORMAL = {
    "kind of", "sort of", "a lot", "lots of", "stuff", "really", "very",
    "pretty much", "basically", "actually", "totally", "nowadays", "kids",
    "guy", "guys", "huge", "tons of", "okay",
}
_WEAK_VERBS = {"very", "really", "just", "quite", "somewhat", "rather", "so"}
_CONTRACTION_RE = re.compile(r"\b\w+'(t|s|re|ve|ll|d|m)\b", re.I)
_PASSIVE_RE = re.compile(
    r"\b(?:is|are|was|were|be|been|being|am)\s+(?:\w+ed|"
    r"written|done|made|given|taken|shown|known|seen|found|held|built|"
    r"set|put|sent|kept|drawn|proven|derived|defined)\b",
    re.I,
)
_AAN_A_RE = re.compile(r"\ba\s+([aeiou]\w+)", re.I)      # "a apple"
_AAN_AN_RE = re.compile(r"\ban\s+([bcdfghjklmnpqrstvwxyz]\w+)", re.I)  # "an book"
# a/an exceptions driven by SOUND not spelling — skip these silent/hard onsets.
_AAN_SKIP = {"hour", "honest", "honor", "heir", "university", "unique", "user",
             "one", "unit", "european", "useful", "unicorn", "utility"}
_COMMON_ABBR = {"eg", "ie", "cf", "vs", "etc", "al", "fig", "eq", "no", "vol",
                "pp", "mr", "mrs", "dr", "prof", "us", "phd", "st", " approx"}


def _excerpt(text, pos, span=28):
    lo = max(0, pos - span // 2)
    return text[lo : lo + span].replace("\n", " ").strip()


def _syllables(word):
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    count, prev = 0, False
    for ch in word:
        is_v = ch in _VOWEL or ch == "y"
        if is_v and not prev:
            count += 1
        prev = is_v
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def _sentences(text):
    return [s.strip() for s in _SENT_RE.split(text) if s.strip()]


def tool_proofread(args):
    """High-precision mechanical proofreading: spacing, repeated words,
    punctuation spacing, sentence casing, and bracket/quote balance. Tuned to
    avoid false positives on abbreviations/decimals so the flags are trustworthy."""
    text = (args.get("text") or "")[:_MAX_ANALYZE_CHARS]
    if not text.strip():
        raise ResearchError("proofread requires `text`.")
    issues = []

    def add(kind, pos, excerpt):
        issues.append({"type": kind, "at": pos, "excerpt": excerpt})

    for m in re.finditer(r"[^\S\n]{2,}", text):
        add("double-space", m.start(), _excerpt(text, m.start()))
    for m in re.finditer(r"\b(\w+)\s+\1\b", text, re.I):
        add("repeated-word", m.start(), m.group(0))
    for m in re.finditer(r"\s+([,.;:!?])", text):
        add("space-before-punct", m.start(), _excerpt(text, m.start()))
    for m in re.finditer(r"[ \t]+$", text, re.M):
        add("trailing-space", m.start(), "<eol>")
    # Missing space / lowercase after sentence end — guarded against
    # abbreviations (e.g., i.e., U.S.) and decimals (3.14).
    for m in re.finditer(r"([a-z]{2,})([.!?])([A-Za-z])", text):
        if m.group(1).lower() in _COMMON_ABBR:
            continue
        add("missing-space-after-punct", m.start(), m.group(0))
    for m in re.finditer(r"[.!?]\s+([a-z])", text):
        before = re.findall(r"([a-z]+)\W*$", text[: m.start() + 1].lower())
        if before and before[-1] in _COMMON_ABBR:
            continue
        add("lowercase-sentence-start", m.start(1), _excerpt(text, m.start(1)))

    balance = []
    for op, cl, label in [("(", ")", "paren"), ("[", "]", "bracket"),
                          ("{", "}", "brace")]:
        if text.count(op) != text.count(cl):
            balance.append({"type": f"unbalanced-{label}",
                            "open": text.count(op), "close": text.count(cl)})
    if text.count('"') % 2:
        balance.append({"type": "unbalanced-double-quote", "count": text.count('"')})

    capped = {}
    trimmed = []
    for it in issues:
        n = capped.get(it["type"], 0)
        if n < 12:
            trimmed.append(it)
        capped[it["type"]] = n + 1
    return {
        "totalIssues": len(issues) + len(balance),
        "byType": {**{k: v for k, v in capped.items()},
                   **{b["type"]: 1 for b in balance}},
        "issues": trimmed,
        "balance": balance,
        "note": "Mechanical checks only (spacing/casing/brackets). Abbreviations "
        "and decimals are excluded. Fix the flags, then re-run.",
    }


def tool_grammar_check(args):
    """Heuristic grammar/style review: passive voice, a/an agreement, run-on
    sentences, expletive ('there is/are') openings, weak-intensifier and
    nominalization density. Not a full parser — honest signal for revision."""
    text = (args.get("text") or "")[:_MAX_ANALYZE_CHARS]
    if not text.strip():
        raise ResearchError("grammar_check requires `text`.")
    sents = _sentences(text)
    tokens = _words(text)
    ntok = max(1, len(tokens))

    passive = [_excerpt(text, m.start(), 40) for m in _PASSIVE_RE.finditer(text)]
    aan = []
    for m in _AAN_A_RE.finditer(text):
        if m.group(1).lower() not in _AAN_SKIP:
            aan.append({"wrote": "a " + m.group(1), "at": m.start()})
    for m in _AAN_AN_RE.finditer(text):
        if m.group(1).lower() not in _AAN_SKIP:
            aan.append({"wrote": "an " + m.group(1), "at": m.start()})
    runons = [{"words": len(_words(s)), "excerpt": s[:60]}
              for s in sents if len(_words(s)) > 40]
    expletives = len(re.findall(r"\bthere\s+(is|are|was|were)\b", text, re.I))
    weak = sum(1 for w in tokens if w in _WEAK_VERBS)
    nominal = sum(1 for w in tokens
                  if re.search(r"(tion|ment|ance|ence|ness|ity)$", w) and len(w) > 6)

    suggestions = []
    if len(passive) / max(1, len(sents)) > 0.25:
        suggestions.append("High passive-voice rate — prefer active where the "
                            "agent matters.")
    if aan:
        suggestions.append("a/an agreement slips detected — check article sounds.")
    if runons:
        suggestions.append(f"{len(runons)} very long sentence(s) (>40 words) — split them.")
    if weak / ntok > 0.015:
        suggestions.append("Many weak intensifiers (very/really/just) — cut or "
                           "replace with a precise word.")
    if nominal / ntok > 0.08:
        suggestions.append("Heavy nominalization — turn '-tion/-ment' nouns back "
                           "into verbs for punchier prose.")
    if not suggestions:
        suggestions.append("No strong grammar/style flags on these heuristics.")

    return {
        "sentences": len(sents),
        "passiveVoice": {"count": len(passive), "examples": passive[:6]},
        "articleAgreement": aan[:8],
        "runOnSentences": runons[:6],
        "expletiveOpenings": expletives,
        "weakIntensifierDensity": round(weak / ntok, 4),
        "nominalizationDensity": round(nominal / ntok, 4),
        "suggestions": suggestions,
        "note": "Heuristic, not a syntactic parser — treat as revision hints.",
    }


def tool_academic_style(args):
    """Academic-writing checker: contractions, informal words, first-person
    density, hedging, and Flesch reading ease + Flesch–Kincaid grade level.
    Flags register problems for scholarly prose."""
    text = (args.get("text") or "")[:_MAX_ANALYZE_CHARS]
    if not text.strip():
        raise ResearchError("academic_style requires `text`.")
    sents = _sentences(text)
    tokens = _words(text)
    ntok = max(1, len(tokens))
    nsent = max(1, len(sents))
    syll = sum(_syllables(w) for w in tokens)

    contractions = [m.group(0) for m in _CONTRACTION_RE.finditer(text)]
    low = text.lower()
    informal = [p for p in _INFORMAL if p in low]
    first_person = sum(1 for w in tokens if w in {"i", "we", "our", "us", "my", "me"})
    hedges = sum(1 for w in tokens if w in _HEDGES)

    words_per_sent = ntok / nsent
    syll_per_word = syll / ntok
    flesch = round(206.835 - 1.015 * words_per_sent - 84.6 * syll_per_word, 1)
    fk_grade = round(0.39 * words_per_sent + 11.8 * syll_per_word - 15.59, 1)

    suggestions = []
    if contractions:
        suggestions.append(f"{len(contractions)} contraction(s) — expand them "
                           "(don't → do not) for formal register.")
    if informal:
        suggestions.append("Informal wording: " + ", ".join(sorted(informal)[:6]))
    if first_person / ntok > 0.03:
        suggestions.append("High first-person density — check the target venue's "
                           "convention (many prefer impersonal or 'we' sparingly).")
    if hedges / ntok > 0.02:
        suggestions.append("Heavy hedging — commit to claims the evidence supports.")
    if fk_grade < 11:
        suggestions.append("Reading grade is low for scholarly prose — density is "
                           "fine if precision improves, not just longer sentences.")
    if not suggestions:
        suggestions.append("Register reads appropriately academic on these heuristics.")

    return {
        "fleschReadingEase": flesch,
        "fleschKincaidGrade": fk_grade,
        "avgWordsPerSentence": round(words_per_sent, 1),
        "contractions": contractions[:8],
        "informalTerms": sorted(informal)[:10],
        "firstPersonDensity": round(first_person / ntok, 4),
        "hedgeDensity": round(hedges / ntok, 4),
        "suggestions": suggestions,
        "note": "Register + readability heuristics. Flesch/FK are English-tuned "
        "and math/LaTeX inflate them — read alongside the prose.",
    }


def tool_detect_ai_text(args):
    """AI-text-likelihood heuristic: burstiness (sentence-length variation),
    AI-tell vocabulary, lexical diversity, and repeated sentence openers.
    HONEST — no detector is reliable; a low score is not proof of anything and a
    high score is not an accusation. Use it only to self-revise toward your own
    voice."""
    text = (args.get("text") or "")[:_MAX_ANALYZE_CHARS]
    if not text.strip():
        raise ResearchError("detect_ai_text requires `text`.")
    sents = _sentences(text)
    tokens = _words(text)
    ntok = max(1, len(tokens))
    lengths = [len(_words(s)) for s in sents] or [0]
    mean = sum(lengths) / len(lengths)
    var = sum((x - mean) ** 2 for x in lengths) / len(lengths)
    std = var ** 0.5
    burstiness = round(std / mean, 3) if mean else 0.0  # low => uniform => AI-like

    ai_hits = [w for w in tokens if w in _AI_TELLS]
    ai_density = len(ai_hits) / ntok
    ttr = len(set(tokens)) / ntok  # type-token ratio; low => repetitive
    openers = {}
    for s in sents:
        w = _words(s)
        if w:
            openers[w[0]] = openers.get(w[0], 0) + 1
    repeated_openers = sorted([(k, v) for k, v in openers.items() if v >= 3],
                              key=lambda x: -x[1])[:5]

    # Combine into a 0-1 likelihood. Each signal contributes a bounded push.
    score = 0.0
    score += 0.30 * max(0.0, min(1.0, (0.55 - burstiness) / 0.55))
    score += 0.30 * max(0.0, min(1.0, ai_density / 0.02))
    score += 0.20 * max(0.0, min(1.0, (0.45 - ttr) / 0.45))
    score += 0.20 * max(0.0, min(1.0, len(repeated_openers) / 4))
    likelihood = round(min(1.0, score), 3)

    return {
        "aiLikelihood": likelihood,  # 0=human-like, 1=machine-like ON THESE SIGNALS
        "burstiness": burstiness,
        "aiTellWords": sorted(set(ai_hits))[:12],
        "aiTellDensity": round(ai_density, 4),
        "lexicalDiversity": round(ttr, 3),
        "repeatedOpeners": [{"word": k, "count": v} for k, v in repeated_openers],
        "note": "NOT authoritative. No AI-text detector is reliable; false "
        "positives are common on edited academic prose. Signal for self-revision "
        "only — never evidence to accuse a human.",
    }


def tool_paraphrase_targets(args):
    """Find the sentences most in need of paraphrasing: those with the highest
    verbatim overlap against the gathered `sources` (copy risk) or the highest
    internal repetition. Returns ranked targets; the MODEL then rewrites them in
    its own words. Ties into check_originality."""
    draft = (args.get("draft") or "")[:_MAX_ANALYZE_CHARS]
    if not draft.strip():
        raise ResearchError("paraphrase_targets requires `draft` text.")
    sources = args.get("sources")
    if not isinstance(sources, list):
        sources = [s.get("note", "") for s in _STATE["sources"] if s.get("note")]
    src_ngrams = set()
    for src in sources[:_MAX_SOURCES]:
        src_text = (src if isinstance(src, str) else str(src))[:_MAX_ANALYZE_CHARS]
        src_ngrams |= _ngrams(_words(src_text), 6)

    sents = _sentences(draft)
    ranked = []
    for s in sents:
        w = _words(s)
        if len(w) < 6:
            continue
        s_ngrams = _ngrams(w, 6)
        overlap = (len(s_ngrams & src_ngrams) / max(1, len(s_ngrams))
                   if src_ngrams else 0.0)
        # internal repetition: fraction of duplicate 6-grams within the sentence
        seq = [" ".join(w[i:i + 6]) for i in range(len(w) - 5)]
        rep = 1.0 - (len(set(seq)) / max(1, len(seq))) if seq else 0.0
        risk = round(max(overlap, rep * 0.5), 3)
        if risk > 0.0:
            ranked.append({"risk": risk, "copyOverlap": round(overlap, 3),
                           "sentence": s[:180]})
    ranked.sort(key=lambda x: -x["risk"])
    return {
        "targets": ranked[:8],
        "sourcesChecked": len(sources),
        "note": "Rewrite the high-risk sentences in your own words, then re-run "
        "check_originality. Overlap is vs your OWN cited sources — cite + "
        "paraphrase, never copy.",
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


def _clamp01(v, default=None):
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return default


def tool_record_judgment(args):
    """Record the independent research-judge's verdict on the manuscript — the
    LLM-as-judge groundedness/faithfulness scores. Feeds the integrity grade +
    war-room. Args: `groundedness` 0-1 (required), `faithfulness` 0-1,
    `unsupportedClaims` (list of strings), `note`."""
    g = _clamp01(args.get("groundedness"))
    if g is None:
        raise ResearchError(
            "record_judgment needs numeric `groundedness` (0-1) — the fraction "
            "of claims the judge found actually backed by cited evidence."
        )
    f = _clamp01(args.get("faithfulness"))
    unsup = args.get("unsupportedClaims")
    if not isinstance(unsup, list):
        unsup = []
    entry = {
        "groundedness": round(g, 3),
        "faithfulness": round(f, 3) if f is not None else None,
        "unsupportedClaims": [str(x) for x in unsup][:20],
        "note": (args.get("note") or "").strip(),
    }
    _STATE["judgment"] = entry
    return {"ok": True, "judgment": entry}


_FORMAL_STATUS = {"verified", "weaker", "gap"}
# graded credit: a proof that checks AND matches the claim is full; one that
# checks but proves LESS than the paper's headline (extra hypotheses, restricted
# domain, weaker constants) is honest partial; a divergence / sorry / axiom is 0.
_FORMAL_CREDIT = {"verified": 1.0, "weaker": 0.5, "gap": 0.0}


def tool_record_formalization(args):
    """Map ONE formal theorem (from a Lean/Coq/Isabelle formalization you
    independently built + checked) back to the paper's mathematical claim, and
    record whether the machine-checked statement actually entails that claim.

    Args: `theorem` (the formal name, e.g. 'NavierStokes.finite_time_blowup',
    required), `claim` (the paper's prose claim it should correspond to,
    required), `status` one of verified|weaker|gap (required):
      verified — compiles AND the formal statement entails the paper's claim.
      weaker   — compiles, but proves LESS (extra hypothesis, restricted domain,
                 different constant) than the headline claim — the Phase-3 gap.
      gap      — does not correspond / uses `sorry`|`axiom`|`admit`, or the
                 formal statement diverges from the target (e.g. Clay) formulation.
    Optional: `compiles` (bool), `usesSorry` (bool), `note`. Feeds a
    formalization scorecard into integrity_report — parallel to reproductions."""
    theorem = (args.get("theorem") or "").strip()
    claim = (args.get("claim") or "").strip()
    if not theorem or not claim:
        raise ResearchError(
            "record_formalization needs both `theorem` (formal name) and `claim` "
            "(the paper's statement it maps to)."
        )
    status = (args.get("status") or "").strip().lower()
    if status not in _FORMAL_STATUS:
        raise ResearchError(
            "record_formalization `status` must be one of: verified | weaker | "
            "gap (verified=checks+entails the claim, weaker=checks but proves "
            "less, gap=diverges/uses sorry|axiom)."
        )
    entry = {
        "theorem": theorem[:300],
        "claim": claim[:600],
        "status": status,
        "compiles": bool(args.get("compiles", status != "gap")),
        "usesSorry": bool(args.get("usesSorry", False)),
        "note": (args.get("note") or "").strip()[:600],
    }
    _STATE["formalizations"].append(entry)
    return {"ok": True, "formalization": entry,
            "formalizations": len(_STATE["formalizations"])}


def tool_integrity_report(_args):
    claims = _STATE["claims"]
    with_evidence = sum(1 for c in claims if c["evidence"])
    with_falsification = sum(1 for c in claims if c["falsification"])
    reps = _STATE["reproductions"]
    reps_matched = sum(1 for r in reps if r["match"])
    formals = _STATE["formalizations"]
    formals_verified = sum(1 for x in formals if x["status"] == "verified")

    # Composite research-integrity grade (0-100): the mean of the quality
    # dimensions that actually have data — so a run is GRADED, not just logged.
    # Only-measured dimensions count (no data ≠ a zero). Honest, offline signal.
    subscores = {}
    if claims:
        subscores["evidence"] = round(with_evidence / len(claims), 3)
        subscores["falsification"] = round(with_falsification / len(claims), 3)
    if reps:
        subscores["reproduction"] = round(reps_matched / len(reps), 3)
    if formals:
        subscores["formalization"] = round(
            sum(_FORMAL_CREDIT[x["status"]] for x in formals) / len(formals), 3)
    if _STATE["originality"] is not None:
        subscores["originality"] = round(float(_STATE["originality"]), 3)
    judgment = _STATE["judgment"]
    if judgment is not None:
        subscores["groundedness"] = judgment["groundedness"]
        if judgment.get("faithfulness") is not None:
            subscores["faithfulness"] = judgment["faithfulness"]
    grade = round(100 * sum(subscores.values()) / len(subscores), 1) if subscores else None

    return {
        "sources": _STATE["sources"],
        "claims": claims,
        "reproductions": reps,
        "formalizations": formals,
        "judgment": judgment,
        "counts": {
            "sources": len(_STATE["sources"]),
            "claims": len(claims),
            "claimsWithEvidence": with_evidence,
            "claimsWithFalsification": with_falsification,
            "reproductions": len(reps),
            "reproductionsMatched": reps_matched,
            "formalizations": len(formals),
            "formalizationsVerified": formals_verified,
        },
        "originality": _STATE["originality"],
        "grade": grade,
        "subscores": subscores,
    }


def _load_benchmarks():
    """Merge the committed public sample (benchmarks.json) with the LOCAL,
    gitignored full set (benchmarks.local.json, e.g. CORE-Bench via
    scripts/build-benchmark.py). The local file holds the real reference answers
    and is never committed; callers must not leak `reference` to the agent."""
    here = os.path.dirname(os.path.abspath(__file__))
    merged = {"name": "", "version": "", "note": "", "tasks": []}
    for fn in ("benchmarks.json", "benchmarks.local.json"):
        try:
            with open(os.path.join(here, fn), encoding="utf-8") as f:
                data = json.load(f)
            if not merged["name"]:
                merged["name"] = data.get("name", "")
                merged["version"] = data.get("version", "")
                merged["note"] = data.get("note", "")
            merged["tasks"].extend(data.get("tasks", []) or [])
        except Exception:
            continue
    return merged


def _benchmark_tasks():
    return [t for t in _load_benchmarks().get("tasks", [])
            if not str(t.get("id", "")).upper().startswith("EXAMPLE")]


def _norm_exact(s):
    # lowercase, drop surrounding option markers/quotes, collapse to alnum words
    s = str(s).strip().lower().strip("()[]{}\"'. ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _exact_match(claimed, reference):
    c, r = _norm_exact(claimed), _norm_exact(reference)
    if not c or not r:
        return False
    if c == r:
        return True
    # single-letter multiple-choice: compare the leading option letter
    if len(r) == 1 or len(c) == 1:
        return c[:1] == r[:1]
    return False


def tool_list_benchmark(_args):
    """The fixed reproduction-benchmark task set to attempt. Reproduce each
    `target` end-to-end, then submit YOUR value with
    benchmark_submit(task_id=<id>, claimed=<your value>). The reference answer is
    HIDDEN on purpose — you are graded on reproducing it, not on reading it."""
    tasks = _benchmark_tasks()
    # Strip the reference (and split) — the agent must not see the answer.
    public = [{
        "id": t.get("id"),
        "paper": t.get("paper"),
        "target": t.get("target"),
        "type": t.get("type", "numeric"),
        "tolerance": t.get("tolerance") if t.get("type", "numeric") == "numeric" else None,
        "hint": t.get("hint"),
        "dataUrl": t.get("dataUrl", ""),
        "field": t.get("field", ""),
    } for t in tasks]
    return {"count": len(public), "tasks": public,
            "note": "Reference answers are hidden. Reproduce each end-to-end, then "
            "submit via benchmark_submit(task_id, claimed) — a NUMBER for numeric "
            "tasks, a STRING for exact-match (type='exact') tasks."}


def tool_benchmark_submit(args):
    """Submit a reproduced value for a benchmark task. `claimed` is a NUMBER for
    numeric tasks or a STRING for exact-match tasks. Looks up the HIDDEN
    reference for `task_id`, scores it (numeric: relative tolerance + optional
    abs_tol; exact: normalized match), and records it — WITHOUT revealing the
    reference (returns only pass/fail so the benchmark can't be gamed)."""
    task_id = (args.get("task_id") or "").strip()
    if not task_id:
        raise ResearchError("benchmark_submit requires `task_id` (from list_benchmark).")
    task = next((t for t in _benchmark_tasks() if str(t.get("id", "")) == task_id), None)
    if task is None:
        raise ResearchError(f"No benchmark task with id '{task_id}'. Call list_benchmark.")
    if "claimed" not in args or args.get("claimed") is None:
        raise ResearchError("benchmark_submit requires `claimed` (your reproduced value).")

    if task.get("type", "numeric") == "exact":
        match = _exact_match(str(args.get("claimed")), str(task.get("reference")))
    else:
        try:
            claimed = float(str(args.get("claimed")).replace(",", ""))
        except (TypeError, ValueError):
            raise ResearchError("This is a numeric task — `claimed` must be a number.")
        ref = float(task.get("reference"))
        tol = float(task.get("tolerance", 0.05))
        abs_tol = float(task.get("abs_tol", 0) or 0)
        denom = abs(ref) if abs(ref) > 1e-12 else 1e-12
        match = (abs(claimed - ref) / denom) <= tol or abs(claimed - ref) <= abs_tol
    # Record for benchmark_report WITHOUT storing the reference in a way the
    # agent reads back (score_reproduction entries carry reference, so keep
    # benchmark submissions in their own list).
    _STATE.setdefault("benchmark", {})[task_id] = bool(match)
    return {"ok": True, "task_id": task_id, "match": bool(match)}


def tool_benchmark_report(_args):
    """Aggregate benchmark submissions into a single score — the run's standing
    on the fixed benchmark. Never reveals reference answers."""
    tasks = _benchmark_tasks()
    submitted = _STATE.get("benchmark", {})
    results = []
    matched = attempted = 0
    for t in tasks:
        tid = str(t.get("id", ""))
        done = tid in submitted
        if done:
            attempted += 1
            if submitted[tid]:
                matched += 1
        results.append({
            "id": tid,
            "target": t.get("target"),
            "attempted": done,
            "match": submitted.get(tid),
        })
    total = len(tasks)
    return {
        "benchmark": _load_benchmarks().get("name", ""),
        "total": total,
        "attempted": attempted,
        "matched": matched,
        "score": round(matched / attempted, 3) if attempted else None,
        "coverage": round(attempted / total, 3) if total else None,
        "results": results[:200],
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
    _STATE["judgment"] = None
    _STATE["benchmark"] = {}
    _STATE["formalizations"] = []
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
        "name": "proofread",
        "description": "Mechanical proofreading of `text`: double spaces, repeated words, punctuation spacing, sentence casing, trailing space, and bracket/quote balance. High-precision (abbreviations/decimals excluded) — trust the flags.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        "_fn": tool_proofread,
    },
    {
        "name": "grammar_check",
        "description": "Heuristic grammar/style review of `text`: passive voice, a/an agreement, run-on sentences, expletive openings, weak-intensifier + nominalization density, with revision suggestions. Not a full parser.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        "_fn": tool_grammar_check,
    },
    {
        "name": "academic_style",
        "description": "Academic-writing / register check of `text`: contractions, informal wording, first-person + hedge density, and Flesch reading ease + Flesch–Kincaid grade. Flags register problems for scholarly prose.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        "_fn": tool_academic_style,
    },
    {
        "name": "detect_ai_text",
        "description": "AI-text-likelihood heuristic for `text` (burstiness, AI-tell vocabulary, lexical diversity, repeated openers) → aiLikelihood 0-1. HONEST: no detector is reliable; for self-revision toward your own voice only, never to accuse a human.",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"],
        },
        "_fn": tool_detect_ai_text,
    },
    {
        "name": "paraphrase_targets",
        "description": "Rank the sentences in `draft` that most need paraphrasing by verbatim overlap vs `sources` (copy risk) + internal repetition. Returns targets; you rewrite them in your own words, then re-run check_originality.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "draft": {"type": "string"},
                "sources": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["draft"],
        },
        "_fn": tool_paraphrase_targets,
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
        "name": "record_judgment",
        "description": "Record the independent research-judge subagent's verdict on the manuscript (LLM-as-judge). Args: `groundedness` 0-1 (required — fraction of claims backed by cited evidence), `faithfulness` 0-1 (prose matches the evidence), `unsupportedClaims` (list of strings), `note`. Feeds the integrity grade + war-room.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "groundedness": {"type": "number"},
                "faithfulness": {"type": "number"},
                "unsupportedClaims": {"type": "array", "items": {"type": "string"}},
                "note": {"type": "string"},
            },
            "required": ["groundedness"],
        },
        "_fn": tool_record_judgment,
    },
    {
        "name": "record_formalization",
        "description": "Map ONE machine-checked theorem (from a Lean/Coq/Isabelle formalization you independently built + `lake build`-checked) to the paper's claim. Args: `theorem` (formal name, required), `claim` (the paper's statement it maps to, required), `status` verified|weaker|gap (required — verified=checks+entails the claim, weaker=checks but proves less [the Phase-3 gap], gap=diverges/uses sorry|axiom), `compiles`, `usesSorry`, `note`. Feeds a formalization scorecard into integrity_report.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "theorem": {"type": "string"},
                "claim": {"type": "string"},
                "status": {"type": "string", "enum": ["verified", "weaker", "gap"]},
                "compiles": {"type": "boolean"},
                "usesSorry": {"type": "boolean"},
                "note": {"type": "string"},
            },
            "required": ["theorem", "claim", "status"],
        },
        "_fn": tool_record_formalization,
    },
    {
        "name": "list_benchmark",
        "description": "Return the fixed reproduction-benchmark tasks to attempt (paper, target, `type` numeric|exact, tolerance, hint, `dataUrl` for tasks that ship a data file). ~600 tasks from CORE-Bench + QRData. The reference answer is HIDDEN — reproduce each target end-to-end (fetch the dataUrl, run it), then submit with benchmark_submit(task_id, claimed).",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_list_benchmark,
    },
    {
        "name": "benchmark_submit",
        "description": "Submit YOUR reproduced value for a benchmark task. Args: `task_id` (from list_benchmark, required), `claimed` (required — a NUMBER for numeric tasks, a STRING for exact-match tasks). Scores it against the hidden reference (numeric: relative tolerance; exact: normalized match) and returns only pass/fail so the benchmark can't be gamed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "string"},
                "claimed": {"type": ["number", "string"]},
            },
            "required": ["task_id", "claimed"],
        },
        "_fn": tool_benchmark_submit,
    },
    {
        "name": "benchmark_report",
        "description": "Aggregate your benchmark submissions → matched/attempted + score + coverage (attempted/total). Run after submitting the benchmark's targets. Never reveals reference answers.",
        "inputSchema": {"type": "object", "properties": {}},
        "_fn": tool_benchmark_report,
    },
    {
        "name": "integrity_report",
        "description": "Summarize the research session: sources, claims (with evidence + falsification), reproduction scorecard, the judge's groundedness/faithfulness verdict, originality, and the composite grade — the integrity scorecard.",
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
