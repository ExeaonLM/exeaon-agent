#!/usr/bin/env python3
"""Exeaon Scholar MCP — multi-source scholarly retrieval for the Research field.

Free, no-API-key sources over plain HTTP/JSON (+ arXiv's Atom XML), stdlib only
so it bundles into the runtime with zero extra deps:

  * arXiv            (export.arxiv.org/api)      — CS/physics/math preprints
  * Semantic Scholar (api.semanticscholar.org)   — cross-domain + abstracts
  * OpenAlex         (api.openalex.org)           — broadest scholarly index
  * PubMed           (eutils.ncbi.nlm.nih.gov)    — biomedical
  * Crossref         (api.crossref.org)           — DOI metadata

Every tool returns a compact, uniform record list (title, authors, year, venue,
url, pdf, id, abstract) so the research swarm can gather + cite REAL sources
instead of hand-scraping. Network errors and rate limits are returned as data —
they never crash the server (the stdio loop is crash-proof, mirroring
research-mcp/server.py).
"""

import json
import sys
import traceback
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "exeaon-scholar"
SERVER_VERSION = "0.1.0"

_UA = "ExeaonResearch/0.1 (research agent; +https://exeaon.dev)"
_TIMEOUT = 20
_MAX_RESULTS = 25


class ScholarError(Exception):
    pass


def _clamp(n, default=8):
    try:
        n = int(n)
    except (TypeError, ValueError):
        return default
    return max(1, min(n, _MAX_RESULTS))


def _get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": _UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return resp.read().decode("utf-8", "replace")


def _get_json(url, headers=None):
    return json.loads(_get(url, headers))


def _trim(text, n=1200):
    text = (text or "").strip().replace("\n", " ")
    return text[:n]


# --- arXiv (Atom XML) -------------------------------------------------------
_ATOM = "{http://www.w3.org/2005/Atom}"


def tool_search_arxiv(args):
    query = (args.get("query") or "").strip()
    if not query:
        raise ScholarError("search_arxiv requires `query`.")
    n = _clamp(args.get("max_results"))
    url = "http://export.arxiv.org/api/query?" + urllib.parse.urlencode(
        {"search_query": f"all:{query}", "start": 0, "max_results": n,
         "sortBy": "relevance"}
    )
    try:
        root = ET.fromstring(_get(url))
    except Exception as exc:
        return {"source": "arxiv", "error": f"arxiv fetch failed: {exc}", "results": []}
    out = []
    for e in root.findall(f"{_ATOM}entry"):
        aid = (e.findtext(f"{_ATOM}id") or "").strip()
        pdf = ""
        for link in e.findall(f"{_ATOM}link"):
            if link.get("title") == "pdf" or link.get("type") == "application/pdf":
                pdf = link.get("href", "")
        out.append({
            "title": _trim(e.findtext(f"{_ATOM}title"), 400),
            "authors": [a.findtext(f"{_ATOM}name") for a in e.findall(f"{_ATOM}author")][:12],
            "year": (e.findtext(f"{_ATOM}published") or "")[:4],
            "venue": "arXiv",
            "id": aid.rsplit("/", 1)[-1],
            "url": aid,
            "pdf": pdf,
            "abstract": _trim(e.findtext(f"{_ATOM}summary")),
        })
    return {"source": "arxiv", "count": len(out), "results": out}


# --- Semantic Scholar -------------------------------------------------------
def tool_search_semantic_scholar(args):
    query = (args.get("query") or "").strip()
    if not query:
        raise ScholarError("search_semantic_scholar requires `query`.")
    n = _clamp(args.get("max_results"))
    fields = "title,abstract,year,venue,authors,externalIds,openAccessPdf,url,citationCount"
    url = "https://api.semanticscholar.org/graph/v1/paper/search?" + urllib.parse.urlencode(
        {"query": query, "limit": n, "fields": fields}
    )
    try:
        data = _get_json(url)
    except Exception as exc:
        return {"source": "semantic_scholar", "error": f"fetch failed: {exc}", "results": []}
    out = []
    for p in data.get("data", []) or []:
        ext = p.get("externalIds") or {}
        oa = p.get("openAccessPdf") or {}
        out.append({
            "title": _trim(p.get("title"), 400),
            "authors": [a.get("name") for a in (p.get("authors") or [])][:12],
            "year": p.get("year"),
            "venue": p.get("venue") or "",
            "id": p.get("paperId"),
            "doi": ext.get("DOI"),
            "url": p.get("url"),
            "pdf": oa.get("url") or "",
            "citations": p.get("citationCount"),
            "abstract": _trim(p.get("abstract")),
        })
    return {"source": "semantic_scholar", "count": len(out), "results": out}


# --- OpenAlex ---------------------------------------------------------------
def tool_search_openalex(args):
    query = (args.get("query") or "").strip()
    if not query:
        raise ScholarError("search_openalex requires `query`.")
    n = _clamp(args.get("max_results"))
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(
        {"search": query, "per-page": n}
    )
    try:
        data = _get_json(url)
    except Exception as exc:
        return {"source": "openalex", "error": f"fetch failed: {exc}", "results": []}
    out = []
    for w in data.get("results", []) or []:
        loc = (w.get("primary_location") or {})
        src = (loc.get("source") or {})
        authors = [
            (a.get("author") or {}).get("display_name")
            for a in (w.get("authorships") or [])
        ][:12]
        out.append({
            "title": _trim(w.get("title"), 400),
            "authors": authors,
            "year": w.get("publication_year"),
            "venue": src.get("display_name") or "",
            "id": w.get("id"),
            "doi": w.get("doi"),
            "url": loc.get("landing_page_url") or w.get("id"),
            "pdf": loc.get("pdf_url") or "",
            "citations": w.get("cited_by_count"),
            "abstract": "",  # OpenAlex returns an inverted index; skip to stay light
        })
    return {"source": "openalex", "count": len(out), "results": out}


# --- PubMed (E-utilities) ---------------------------------------------------
def tool_search_pubmed(args):
    query = (args.get("query") or "").strip()
    if not query:
        raise ScholarError("search_pubmed requires `query`.")
    n = _clamp(args.get("max_results"))
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    try:
        ids = _get_json(
            base + "/esearch.fcgi?" + urllib.parse.urlencode(
                {"db": "pubmed", "term": query, "retmax": n, "retmode": "json"}
            )
        ).get("esearchresult", {}).get("idlist", []) or []
        if not ids:
            return {"source": "pubmed", "count": 0, "results": []}
        summ = _get_json(
            base + "/esummary.fcgi?" + urllib.parse.urlencode(
                {"db": "pubmed", "id": ",".join(ids), "retmode": "json"}
            )
        ).get("result", {})
    except Exception as exc:
        return {"source": "pubmed", "error": f"fetch failed: {exc}", "results": []}
    out = []
    for pid in ids:
        p = summ.get(pid) or {}
        if not p:
            continue
        out.append({
            "title": _trim(p.get("title"), 400),
            "authors": [a.get("name") for a in (p.get("authors") or [])][:12],
            "year": (p.get("pubdate") or "")[:4],
            "venue": p.get("fulljournalname") or p.get("source") or "",
            "id": pid,
            "doi": next((x.get("value") for x in (p.get("articleids") or [])
                         if x.get("idtype") == "doi"), None),
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
            "pdf": "",
            "abstract": "",
        })
    return {"source": "pubmed", "count": len(out), "results": out}


# --- Crossref (DOI metadata) ------------------------------------------------
def tool_get_by_doi(args):
    doi = (args.get("doi") or "").strip()
    if not doi:
        raise ScholarError("get_by_doi requires `doi`.")
    doi = doi.replace("https://doi.org/", "").strip()
    try:
        m = _get_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}").get("message", {})
    except Exception as exc:
        return {"source": "crossref", "error": f"fetch failed: {exc}", "result": None}
    authors = [
        " ".join(x for x in [a.get("given"), a.get("family")] if x)
        for a in (m.get("author") or [])
    ][:12]
    pdf = next((l.get("URL") for l in (m.get("link") or [])
                if "pdf" in (l.get("content-type") or "")), "")
    return {"source": "crossref", "result": {
        "title": _trim(("; ".join(m.get("title") or [])), 400),
        "authors": authors,
        "year": ((m.get("issued") or {}).get("date-parts") or [[None]])[0][0],
        "venue": "; ".join(m.get("container-title") or []),
        "doi": m.get("DOI"),
        "url": m.get("URL"),
        "pdf": pdf,
        "citations": m.get("is-referenced-by-count"),
        "abstract": _trim(m.get("abstract")),
    }}


# --- Unpaywall (open-access PDF resolution) ---------------------------------
# Unpaywall wants a contact email in the query; use a brand address, never the
# user's personal email.
_OA_EMAIL = "research@exeaon.dev"


def tool_resolve_oa_pdf(args):
    doi = (args.get("doi") or "").strip().replace("https://doi.org/", "")
    if not doi:
        raise ScholarError("resolve_oa_pdf requires `doi`.")
    try:
        d = _get_json(
            f"https://api.unpaywall.org/v2/{urllib.parse.quote(doi)}?"
            + urllib.parse.urlencode({"email": _OA_EMAIL})
        )
    except Exception as exc:
        return {"source": "unpaywall", "error": f"fetch failed: {exc}", "doi": doi}
    best = d.get("best_oa_location") or {}
    return {
        "source": "unpaywall",
        "doi": doi,
        "is_oa": bool(d.get("is_oa")),
        "title": _trim(d.get("title"), 400),
        "pdf": best.get("url_for_pdf") or "",
        "landing": best.get("url") or "",
        "license": best.get("license") or "",
        "version": best.get("version") or "",
    }


# --- Citation network -------------------------------------------------------
def tool_get_citations(args):
    """Papers that CITE the given DOI (via OpenAlex)."""
    doi = (args.get("doi") or "").strip().replace("https://doi.org/", "")
    if not doi:
        raise ScholarError("get_citations requires `doi`.")
    n = _clamp(args.get("max_results"))
    try:
        work = _get_json(f"https://api.openalex.org/works/doi:{urllib.parse.quote(doi)}")
        wid = (work.get("id") or "").rsplit("/", 1)[-1]
        if not wid:
            return {"source": "openalex", "error": "work not found", "results": []}
        data = _get_json(
            "https://api.openalex.org/works?" + urllib.parse.urlencode(
                {"filter": f"cites:{wid}", "per-page": n}
            )
        )
    except Exception as exc:
        return {"source": "openalex", "error": f"fetch failed: {exc}", "results": []}
    out = [{
        "title": _trim(w.get("title"), 400),
        "year": w.get("publication_year"),
        "doi": w.get("doi"),
        "url": w.get("id"),
        "citations": w.get("cited_by_count"),
    } for w in (data.get("results") or [])]
    return {"source": "openalex", "citing_count": len(out), "results": out}


def tool_get_references(args):
    """Works the given DOI CITES (its bibliography, via Crossref)."""
    doi = (args.get("doi") or "").strip().replace("https://doi.org/", "")
    if not doi:
        raise ScholarError("get_references requires `doi`.")
    n = _clamp(args.get("max_results", 25))
    try:
        m = _get_json(f"https://api.crossref.org/works/{urllib.parse.quote(doi)}").get("message", {})
    except Exception as exc:
        return {"source": "crossref", "error": f"fetch failed: {exc}", "results": []}
    out = []
    for r in (m.get("reference") or [])[:n]:
        out.append({
            "title": _trim(r.get("article-title") or r.get("unstructured"), 300),
            "doi": r.get("DOI"),
            "year": r.get("year"),
            "venue": r.get("journal-title") or "",
        })
    return {"source": "crossref", "reference_count": len(out), "results": out}


def tool_status(_args):
    return {"ok": True, "sources": ["arxiv", "semantic_scholar", "openalex",
                                    "pubmed", "crossref", "unpaywall"]}


TOOLS = [
    {"name": "scholar_status",
     "description": "Health check + the scholarly sources this server can search. Call first.",
     "inputSchema": {"type": "object", "properties": {}},
     "_fn": tool_status},
    {"name": "search_arxiv",
     "description": "Search arXiv (CS/physics/math/quant preprints). Returns title, authors, year, arXiv id, abstract URL, PDF URL, abstract. Args: `query` (required), `max_results` (default 8, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["query"]},
     "_fn": tool_search_arxiv},
    {"name": "search_semantic_scholar",
     "description": "Search Semantic Scholar across all fields — best for abstracts + citation counts + DOIs. Args: `query` (required), `max_results` (default 8, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["query"]},
     "_fn": tool_search_semantic_scholar},
    {"name": "search_openalex",
     "description": "Search OpenAlex — the broadest open scholarly index (works, venues, citations, DOIs). Args: `query` (required), `max_results` (default 8, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["query"]},
     "_fn": tool_search_openalex},
    {"name": "search_pubmed",
     "description": "Search PubMed (biomedical literature). Returns PMID, journal, DOI, link. Args: `query` (required), `max_results` (default 8, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["query"]},
     "_fn": tool_search_pubmed},
    {"name": "get_by_doi",
     "description": "Resolve a DOI to full metadata via Crossref (title, authors, year, venue, PDF link when open, citation count, abstract when present). Arg: `doi` (required).",
     "inputSchema": {"type": "object", "properties": {"doi": {"type": "string"}},
                     "required": ["doi"]},
     "_fn": tool_get_by_doi},
    {"name": "resolve_oa_pdf",
     "description": "Find the best OPEN-ACCESS PDF for a DOI via Unpaywall — use this to actually GET a paper to read (then read_document the PDF). Returns is_oa, pdf URL, landing URL, license. Arg: `doi` (required).",
     "inputSchema": {"type": "object", "properties": {"doi": {"type": "string"}},
                     "required": ["doi"]},
     "_fn": tool_resolve_oa_pdf},
    {"name": "get_citations",
     "description": "Papers that CITE a given DOI (forward citation network, via OpenAlex) — find follow-up/contradicting work. Args: `doi` (required), `max_results` (default 8, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "doi": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["doi"]},
     "_fn": tool_get_citations},
    {"name": "get_references",
     "description": "The bibliography a given DOI CITES (backward references, via Crossref). Args: `doi` (required), `max_results` (default 25, max 25).",
     "inputSchema": {"type": "object", "properties": {
         "doi": {"type": "string"}, "max_results": {"type": "integer"}},
         "required": ["doi"]},
     "_fn": tool_get_references},
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
        return _result(rid, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        })
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        return _result(rid, {"tools": [
            {k: v for k, v in t.items() if not k.startswith("_")} for t in TOOLS
        ]})
    if method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _TOOL_BY_NAME.get(name)
        if not tool:
            return _error(rid, -32601, f"Unknown tool: {name}")
        try:
            payload = tool["_fn"](args)
            return _result(rid, {"content": [{"type": "text", "text": json.dumps(payload)}]})
        except ScholarError as exc:
            return _result(rid, {"content": [{"type": "text", "text": str(exc)}], "isError": True})
        except Exception as exc:  # pragma: no cover
            return _result(rid, {"content": [{"type": "text",
                "text": f"Scholar tool error: {exc}\n{traceback.format_exc()}"}],
                "isError": True})
    if rid is not None:
        return _error(rid, -32601, f"Method not found: {method}")
    return None


def main():
    # Crash-proof stdio loop (mirrors the hardened research MCP): no single
    # request, handler error, or closed pipe can take the server down.
    while True:
        try:
            line = sys.stdin.readline()
        except Exception:
            break
        if line == "":
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
        except Exception as exc:
            rid = request.get("id")
            response = _error(rid, -32603, f"internal error: {exc}") if rid is not None else None
        if response is None:
            continue
        try:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except (BrokenPipeError, ValueError):
            break
        except Exception:
            continue


if __name__ == "__main__":
    main()
