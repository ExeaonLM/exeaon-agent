# Exeaon Sovereign Architecture Reference

This reference document preserves all core technical architectural principles, sovereign model pipelines, deployment parameters, and UI/UX design rules for the **Exeaon AI Ecosystem**.

---

## 1. Sovereign Model Registry & HF Repositories

| Model ID | Base Arch | Hugging Face Repo | Primary Role |
|---|---|---|---|
| **Exeaon1-Claw-32B** | Qwen2.5-Coder-32B | `Exeaon/Exeaon1-Claw-32B` | Sovereign Autonomous Coding Agent & Canvas Engine |
| **Exeaon1-Nunya-14B** | Qwen2.5-14B | `Exeaon/Exeaon1-Nunya-14B` | High-throughput Reasoning & Context Compactor |
| **Exeaon1-Kese-32B** | Qwen2.5-32B | `Exeaon/Exeaon1-Kese-32B` | Dense Multilingual & Knowledge Engine |
| **Exeaon1-Dzo-0.6B / 1.7B / 4B** | Qwen2.5 Slim | `Exeaon/Exeaon1-Dzo-*` | Edge, Local CPU, and On-Device Verification |

All published models are compressed via **`epure`** (`model.ebin`) and decoded seamlessly in VRAM via `epure-runtime`.

---

## 2. Modal Cloud Endpoint & Credit Management Rules

### Active Deployment File:
`ECompress/modal_app.py` $\rightarrow$ Deploys app **`exeaon-compress`**

### Active Live Endpoint URL:
`https://elliotakpalu--exeaon-compress-exeaonendpoint-api.modal.run/v1`

### CRITICAL Modal Credit Rules:
1. **NEVER use `min_containers=1`**:
   - `min_containers=1` forces an A100 GPU to run **24 hours / 7 days a week**.
   - At ~$3.50/hr, 1 warm GPU burns **~$84/day ($588/week)**, draining workspace credits and causing account lockout (`workspace is disabled`).
2. **ALWAYS use `scaledown_window=600` (10 minutes)**:
   - When a user sends a prompt, the GPU warms up.
   - For the next 10 minutes, all multi-turn chats respond with **zero cold start / instant latency**.
   - When the user steps away for >10 minutes, Modal automatically scales down to 0, saving 100% of compute credits.
3. **Deployment Command**:
   ```powershell
   $env:PYTHONIOENCODING="utf-8"; python -m modal deploy "ECompress/modal_app.py"
   ```

---

## 3. LiteLLM Driver vs. UI Branding Protocol

### The Core Protocol Distinction:
- **LiteLLM Transport Driver**: The prefix before the slash (e.g. `openai/`) is LiteLLM's internal Python transport format, NOT an allegiance to OpenAI. LiteLLM requires `openai/` so it routes to standard `/v1/chat/completions` JSON endpoints.
  - Setting `model = "openai/exeaon1-claw-32b"` with `base_url` pointing to our Modal URL allows LiteLLM to communicate with our sovereign server.
  - Using an unregistered prefix like `exeaon/` directly in LiteLLM causes `litellm.BadRequestError: LLM Provider NOT provided`.
- **User Interface (UI)**: 100% Pure Exeaon.
  - Chat Model Pill: `Exeaon Coder`
  - Settings & Profile List: `Exeaon Coder`, `Exeaon Nunya 14B`, `Exeaon Kese 32B`
  - Users never see `openai` in the UI.

---

## 4. UI/UX Rules & User Profile Architecture

### A. Claude-Style User Profile Footer (Bottom-Left)
- Trigger Button: `[E] Elliot · Pro ⌄` (amber avatar pill with Pro badge and chevron).
- Upward Floating Menu:
  - Header: `elliotakpalu@gmail.com`
  - ⚙ **Settings** (`Ctrl+,`) $\rightarrow$ `/settings`
  - 🌐 **Language** $\rightarrow$ `/settings/app`
  - ❓ **Get Help**
  - 🚀 **Account & Cloud** (`Pro`) $\rightarrow$ `/settings/account`
  - 📦 **Get Apps and Extensions** $\rightarrow$ `/settings/skills`
  - 📄 **View Changelog** $\rightarrow$ Release history
  - ℹ **Learn More** $\rightarrow$ Official site
  - 🚪 **Log Out**

### B. Settings Navigation Structure
1. **Agent Profiles** (`/settings/agents`)
2. **Models** (`/settings/llm`)
3. **Skills** (`/settings/skills`)
4. **Agent Tools** (`/settings/tools`) — Read-only runtime tool schemas & sovereign directives
5. **Compactor** (`/settings/condenser`)
6. **Context** (`/settings/agent-context`)
7. **Validation** (`/settings/verification`)
8. **Appearance** (`/settings/app`)
9. **Account & Cloud** (`/settings/account`)
10. **Secrets** (`/settings/secrets`)

### C. Chat Input & Context Menu
- Chat `+` Menu: Strictly for Prompt Macros, Attach Files & Images, and Git Tools.
- System Prompt is **read-only transparency** (locked sovereign DNA). Custom user rules are added in the **Context** tab (`/settings/agent-context`).

---

## 5. Local Port Stack & Process Management

| Port | Service | Description |
|---|---|---|
| **18080** | Ingress Proxy / dev:static | Main UI entrypoint (`http://localhost:18080`) |
| **18000** | Python Agent Server | Core agent loop, bash events, and tool executor |
| **18001** | Automation Backend | Background flows, watchdog, and scheduled tasks |
| **3001** | Static Frontend Server | Fast pre-built asset server with ETag caching |

### Clean Stack Restart Command (PowerShell):
```powershell
Get-NetTCPConnection -LocalPort 18000,18001,18080,3001,8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1; $env:PORT="18080"; npm run dev:static -- --skip-build
```

---

## 6. Error Formatting & Sovereign System States

- **502 Bad Gateway / ECONNREFUSED**: Must NEVER dump raw `127.0.0.1:18000` errors. Always format as:
  > **Server Offline**: *"Exeaon Sovereign Server Offline — Please restart the application."*
- **Backend Modals**: Modifying / adding / deleting default sovereign connections is permanently disabled to prevent system misconfiguration.
