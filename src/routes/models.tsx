import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { getEffectiveLocalBackend } from "#/api/backend-registry/active-store";
import { getAgentServerHttpClientOptions } from "#/api/agent-server-client-options";
import { I18nKey } from "#/i18n/declaration";

interface HardwareSpecs {
  ramGb: number;
  cores: number;
  gpuName: string;
  vramMb: number;
}

interface LocalModelEntry {
  name: string;
  path: string;
  sizeGb: number;
}

type Device = "cpu" | "gpu";

interface Recommendation {
  device: "GPU" | "CPU";
  tier: string;
}

// A GGUF is worth offering GPU offload for when a real GPU with usable VRAM was
// detected. Below this we only recommend/offer CPU.
function hasUsableGpu(specs: HardwareSpecs): boolean {
  const vram = specs.vramMb / 1024;
  return (
    !!specs.gpuName &&
    specs.gpuName.toLowerCase() !== "unknown" &&
    (vram >= 4 || specs.vramMb === 0) // vram 0 = detected GPU, size unknown (WMI cap)
  );
}

// Recommend a model CLASS (not a specific model) per compute path: one for the
// GPU and one for the CPU when a GPU exists, otherwise just CPU.
function recommendations(specs: HardwareSpecs): Recommendation[] {
  const ram = specs.ramGb;
  const vram = specs.vramMb / 1024;
  const byRam =
    ram >= 64
      ? "Aeon-class (27B+) — flagship"
      : ram >= 32
        ? "Arc-class (13–14B) — balanced"
        : ram >= 16
          ? "Spark-class (7–8B) — fast"
          : "Spark-class mini (1–3B) — lightweight";
  const recs: Recommendation[] = [];
  if (hasUsableGpu(specs)) {
    const byVram =
      vram >= 24
        ? "Aeon-class (27B+) — flagship"
        : vram >= 12
          ? "Arc-class (13–14B) — balanced"
          : vram >= 6
            ? "Spark-class (7–8B) — fast"
            : "Spark-class mini (1–3B) — lightweight";
    recs.push({ device: "GPU", tier: byVram });
  }
  recs.push({ device: "CPU", tier: byRam });
  return recs;
}

// Hardware specs are stable for a session, so detect once and cache at module
// scope. The Refresh button forces a fresh detect.
let cachedSpecs: HardwareSpecs | null = null;

const LLAMA_ENDPOINT = "http://127.0.0.1:18002/v1";

export default function ModelsPage() {
  const { t } = useTranslation("openhands");
  const [specs, setSpecs] = React.useState<HardwareSpecs | null>(null);
  const [modelsDir, setModelsDir] = React.useState<string>("");
  const [localModels, setLocalModels] = React.useState<LocalModelEntry[]>([]);
  const [running, setRunning] = React.useState(false);
  const [runningModel, setRunningModel] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [hasTauri, setHasTauri] = React.useState(false);
  const [device, setDevice] = React.useState<Device>("cpu");

  const gpuAvailable = specs ? hasUsableGpu(specs) : false;

  // Default the device to GPU once we know one is present.
  React.useEffect(() => {
    if (gpuAvailable) setDevice("gpu");
  }, [gpuAvailable]);

  const refreshStatus = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const status = await invoke<boolean>("local_model_status");
      setRunning(status);
      if (!status) setRunningModel(null);
    } catch {
      setRunning(false);
    }
  }, [hasTauri]);

  const loadModels = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const dir = await invoke<string>("models_dir");
      setModelsDir(dir);
      const list = await invoke<LocalModelEntry[]>("list_local_models");
      setLocalModels(list);
    } catch (e) {
      setError(String(e));
    }
  }, [hasTauri]);

  const detectSpecs = React.useCallback(async (force = false) => {
    if (!force && cachedSpecs) {
      setSpecs(cachedSpecs);
      return;
    }
    try {
      const s = await invoke<HardwareSpecs>("get_hardware_specs");
      cachedSpecs = s;
      setSpecs(s);
    } catch {
      setSpecs(cachedSpecs);
    }
  }, []);

  React.useEffect(() => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    setHasTauri(isTauri);
    if (!isTauri) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await detectSpecs(false);
      if (!cancelled) {
        await refreshStatus();
        await loadModels();
      }
    })();
    const poll = window.setInterval(refreshStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [refreshStatus, loadModels, detectSpecs]);

  // Point the local agent-server's LLM at the running llama endpoint so the
  // started model is immediately usable in chat everywhere — "activate for
  // inference". Best-effort with a short retry (first run may still be booting).
  const activateForChat = React.useCallback(async (model: LocalModelEntry) => {
    const local = getEffectiveLocalBackend();
    const host = local?.host || "http://127.0.0.1:18000";
    const sdk = getAgentServerHttpClientOptions();
    const llm = {
      provider: "openai",
      model: `openai/${model.name.replace(/\.gguf$/i, "")}`,
      base_url: LLAMA_ENDPOINT,
      api_key: "sk-local",
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Direct PATCH to the local agent-server's settings to point its LLM at
        // the just-started local llama endpoint. The typed client has no
        // settings-diff surface for this one-shot wiring, so a direct fetch is
        // intentional here.
        // eslint-disable-next-line local/no-direct-agent-server-fetch
        const resp = await fetch(`${host}/api/settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(sdk.apiKey ? { Authorization: `Bearer ${sdk.apiKey}` } : {}),
          },
          body: JSON.stringify({ agent_settings_diff: { llm } }),
        });
        if (resp.ok || resp.status === 401) return true;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }, []);

  const startModel = async (model: LocalModelEntry) => {
    setBusy(true);
    setError("");
    setNotice("");
    setRunningModel(model.name); // optimistic — the button shows "Starting…"
    const doStart = () =>
      invoke("start_local_model", { modelPath: model.path, device });
    try {
      try {
        await doStart();
      } catch (e) {
        // An orphaned server from a previous run can still hold :18002 (status
        // reads "stopped" but start reports "already running"). Stop it and
        // retry once so Start is self-healing instead of dead-ending.
        if (String(e).toLowerCase().includes("already running")) {
          await invoke("stop_local_model").catch(() => {});
          await new Promise((r) => setTimeout(r, 800));
          await doStart();
        } else {
          throw e;
        }
      }
      await refreshStatus();
      setRunningModel(model.name);
      const activated = await activateForChat(model);
      setNotice(
        activated
          ? `${model.name} is running on ${device.toUpperCase()} at ${LLAMA_ENDPOINT} — active for chat.`
          : `${model.name} is running on ${device.toUpperCase()} at ${LLAMA_ENDPOINT}. Open a new chat to use it.`,
      );
    } catch (e) {
      setRunningModel(null);
      setError(
        `Couldn't start ${model.name}: ${String(e)}. Fix the issue and press Start to retry.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const stopModel = async () => {
    setBusy(true);
    setError("");
    try {
      await invoke("stop_local_model");
      await refreshStatus();
      setNotice("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const openFolder = async () => {
    try {
      await invoke("open_models_dir");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--oh-fg)]">
          {t(I18nKey.NAV$MODELS)}
        </h1>
        {hasTauri && (
          <button
            type="button"
            className="rounded-lg border border-[var(--oh-border)] px-3 py-1.5 text-sm text-[var(--oh-muted)] hover:text-[var(--oh-fg)]"
            onClick={() => {
              detectSpecs(true);
              refreshStatus();
              loadModels();
            }}
          >
            Refresh
          </button>
        )}
      </div>

      {!hasTauri && (
        <div className="px-6 py-8 text-sm text-[var(--oh-muted)]">
          Local models are only available in the Exeaon Claw desktop app.
        </div>
      )}

      {error && (
        <div className="mx-6 mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-6 mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {notice}
        </div>
      )}

      {hasTauri && (
        <>
          {/* Machine card */}
          <div className="mx-6 mb-5 rounded-xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)] p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--oh-muted)]">
              Your machine
            </div>
            {specs ? (
              <>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-[var(--oh-muted)]">RAM: </span>
                    <span className="text-[var(--oh-fg)]">
                      {specs.ramGb} GB
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--oh-muted)]">CPU cores: </span>
                    <span className="text-[var(--oh-fg)]">{specs.cores}</span>
                  </div>
                  <div>
                    <span className="text-[var(--oh-muted)]">GPU: </span>
                    <span className="text-[var(--oh-fg)]">{specs.gpuName}</span>
                    {specs.vramMb > 0 && (
                      <span className="text-[var(--oh-muted)]">
                        {" "}
                        ({Math.round(specs.vramMb / 1024)} GB VRAM)
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--oh-muted)]">
                    Recommended for this machine:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {recommendations(specs).map((r) => (
                      <span
                        key={r.device}
                        className="rounded-lg bg-[var(--oh-bg)] px-3 py-1.5 text-sm"
                      >
                        <span className="font-semibold text-[var(--oh-fg)]">
                          {r.device}
                        </span>
                        <span className="text-[var(--oh-muted)]"> · </span>
                        <span className="font-semibold text-[#F3CE49]">
                          {r.tier}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--oh-muted)]">
                Detecting hardware…
              </div>
            )}
          </div>

          {/* Local server status */}
          <div className="mx-6 mb-5 flex items-center gap-3 rounded-xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)] p-5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                running ? "bg-emerald-400" : "bg-zinc-500"
              }`}
            />
            <div className="text-sm">
              <span className="text-[var(--oh-fg)]">Local model server: </span>
              <span className={running ? "text-emerald-300" : "text-zinc-400"}>
                {running ? "running" : "stopped"}
              </span>
              {running && (
                <span className="ml-2 text-xs text-[var(--oh-muted)]">
                  {runningModel ? `${runningModel} · ` : ""}
                  {LLAMA_ENDPOINT}
                </span>
              )}
            </div>
            {running && (
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={stopModel}
                  disabled={busy}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* Device picker + model list */}
          <div className="mx-6 mb-5 rounded-xl border border-[var(--oh-border)] bg-[var(--oh-surface-raised)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--oh-muted)]">
                Your models
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--oh-muted)]">Run on:</span>
                <div className="flex overflow-hidden rounded-lg border border-[var(--oh-border)]">
                  <button
                    type="button"
                    onClick={() => setDevice("cpu")}
                    className={`px-3 py-1 text-xs font-medium ${
                      device === "cpu"
                        ? "bg-[#F3CE49] text-[#070605]"
                        : "text-[var(--oh-muted)] hover:text-[var(--oh-fg)]"
                    }`}
                  >
                    CPU
                  </button>
                  <button
                    type="button"
                    onClick={() => gpuAvailable && setDevice("gpu")}
                    disabled={!gpuAvailable}
                    title={
                      gpuAvailable
                        ? specs?.gpuName
                        : "No compatible GPU detected"
                    }
                    className={`px-3 py-1 text-xs font-medium ${
                      device === "gpu"
                        ? "bg-[#F3CE49] text-[#070605]"
                        : "text-[var(--oh-muted)] hover:text-[var(--oh-fg)]"
                    } ${!gpuAvailable ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    GPU
                  </button>
                </div>
              </div>
            </div>

            {localModels.length === 0 ? (
              <p className="text-sm text-[var(--oh-muted)]">
                No GGUF models found yet. Add one to your models folder below,
                then Refresh.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {localModels.map((m) => {
                  const isRunning = running && runningModel === m.name;
                  return (
                    <div
                      key={m.path}
                      className="flex items-center gap-3 rounded-lg border border-[var(--oh-border)] bg-[var(--oh-bg)] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-[var(--oh-fg)]">
                          {m.name}
                        </div>
                        <div className="text-xs text-[var(--oh-muted)]">
                          {m.sizeGb} GB
                        </div>
                      </div>
                      {isRunning ? (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startModel(m)}
                          disabled={busy || running}
                          className="rounded-lg bg-[#F3CE49] px-3 py-1.5 text-sm font-semibold text-[#070605] hover:bg-[#F7DA6B] disabled:opacity-40"
                        >
                          {busy ? "Starting…" : "Start"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Models directory hint */}
          <div className="mx-6 mb-5 rounded-xl border border-dashed border-[var(--oh-border)] p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--oh-muted)]">
                Download models
              </div>
              <button
                type="button"
                onClick={openFolder}
                className="rounded-lg border border-[var(--oh-border)] px-3 py-1 text-xs text-[var(--oh-muted)] hover:text-[var(--oh-fg)]"
              >
                Open models folder
              </button>
            </div>
            <p className="mb-3 text-sm text-[var(--oh-muted)]">
              Put a GGUF file in your models folder, then Refresh and Start it.
              The folder is at:{" "}
              <code className="text-xs text-[var(--oh-fg)]">
                {modelsDir || "…"}
              </code>
            </p>
            <p className="text-xs leading-relaxed text-[var(--oh-muted)]">
              Tip: use the tier above as a guide — Spark-class (7–8B Q4_K_M, ~5
              GB) runs on most laptops; Arc-class (13–14B, ~8–9 GB) needs 16 GB+
              RAM; Aeon-class (27B+, ~16 GB) needs 32 GB+ RAM or a big GPU.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
