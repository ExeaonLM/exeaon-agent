# Exeaon Agent

**Exeaon Agent** is the sovereign AI coding agent of the Exeaon platform — an
agent workspace that runs on the **Exeaon compression runtime**, so 27B- and
72B-class models fit on ordinary hardware with no cloud dependency.

## Origin and attribution

Exeaon Agent is a rebranded fork of [OpenHands](https://github.com/All-Hands-AI/OpenHands),
used under the MIT License. The original `LICENSE` and copyright notice are
retained in this repository, as the MIT License requires. This is the same
"stand on the best permissive base, make it ours" approach the platform takes
everywhere: OpenHands provides the agent workspace, and the proprietary core —
the Exeaon runtime, the compressed model artifacts, and the model registry —
sits underneath it.

We keep OpenHands as an `upstream` remote and continue to merge its improvements
rather than freezing at a snapshot.

## What is ours vs upstream

| Layer | Source |
|---|---|
| Agent workspace UI, agent server, tool loop | OpenHands (MIT), rebranded |
| Model serving (OpenAI-compatible endpoint) | Exeaon runtime (`epure serve`) |
| Model execution, compression, cache | Exeaon runtime (proprietary core) |
| Published model registry (`epure pull`) | ours |

## Model connection

Exeaon Agent points at the Exeaon runtime through the standard OpenAI-compatible
triple (OpenHands routes model calls through LiteLLM):

- Custom model: `openai/exeaon`
- Base URL: a local `epure serve` on `:8000`, or the hosted endpoint
- API key: any non-empty string

Proven end to end: a LiteLLM agent loop drove a compressed model through a tool
call to the correct answer. If LiteLLM drives it, Exeaon Agent drives it.

## Staying current with upstream

```bash
git remote add upstream https://github.com/All-Hands-AI/OpenHands.git
git fetch upstream
git merge upstream/main    # or: gh repo sync
```
