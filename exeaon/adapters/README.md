# Framework adapters

Every framework we bolt on talks to the **same** thing: our runtime's
OpenAI-compatible endpoint (`epure serve`, or the hosted URL). That is what
makes bolting them on safe and cheap — none of them reach into OpenHands' core,
and none of them reach into each other. They are peers behind one endpoint.

The endpoint contract, from `exeaon/brand.ts`:

```
base URL : http://localhost:8000/v1   (or the hosted endpoint)
model    : openai/exeaon
api key  : any non-empty string
```

This file is the map. Each adapter is config against that contract, and lives
in the overlay so upstream merges never touch it.

## OpenHands (the front end / control centre)

Not an adapter — it *is* the surface. Its LLM settings point at the endpoint
above through the ACP provider seam (`src/constants/acp-providers.ts`, Tier 2 in
MERGE_STRATEGY.md). Proven: a LiteLLM loop drove a compressed model to the
correct answer, and OpenHands routes through LiteLLM, so the same config works.

## Goose (Block) — local terminal / coding worker

Goose is a local CLI agent (Apache-2.0). It reads an OpenAI-compatible provider
from its own config:

```yaml
# ~/.config/goose/config.yaml
GOOSE_PROVIDER: openai
OPENAI_HOST: http://localhost:8000/v1
OPENAI_API_KEY: sk-exeaon-local
GOOSE_MODEL: exeaon
```

Role: the terminal/coding worker that runs shell-level tasks the canvas
delegates. No code change to Goose or to us — config only.

## NeMo Agent Toolkit + AI-Q (tracing, evaluation, research)

Apache-2.0, framework-agnostic; it wraps LangChain/CrewAI/LangGraph and profiles
them. It runs *over* the others, not beside them. Point its model config at the
endpoint and it traces token cost, latency, and bottlenecks across whatever loop
is running. AI-Q is its research/document-intelligence blueprint — used for
RAG over a codebase, again against the same endpoint. Role: observability and
evaluation, wired to the same model everything else uses so the traces are
apples-to-apples.

## LangGraph (the control layer)

MIT. Stateful routing between backends — it decides which worker (Goose, a
CrewAI team) handles a step, holds the graph state, and persists it. Its nodes
call the model through the OpenAI-compatible client:

```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(base_url="http://localhost:8000/v1",
                 api_key="sk-exeaon-local", model="exeaon")
```

Role: the brain that sequences the other tools. This is also where the security
boundary lives — side-effectful actions (compile, publish, flash hardware) are
LangGraph tools with a human-approval gate, never things a worker does directly.

## CrewAI (specialist teams)

MIT. Role-based multi-agent teams for bounded specialist work. Same client
shape:

```python
from crewai import LLM
llm = LLM(model="openai/exeaon", base_url="http://localhost:8000/v1",
          api_key="sk-exeaon-local")
```

Role: optional. Spin up a "reviewer + implementer + tester" crew for a task that
benefits from division of labour. Behind LangGraph, behind the canvas.

## The shape

```
              Exeaon Agent (OpenHands canvas)
                          │
                    LangGraph  ── control, state, security gate
              ┌───────────┼───────────┐
           CrewAI       AI-Q        Goose
          teams       research     terminal
                          │
                 NeMo Toolkit  ── tracing / eval over all of it
                          │
              one OpenAI-compatible endpoint
                          │
                  Exeaon runtime  ── compressed model, resident
```

One endpoint, many peers, no entanglement. Add a framework by adding a config
file here — never by editing upstream.
