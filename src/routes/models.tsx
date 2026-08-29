import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

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

// Tier table used to recommend a model class for the user's machine.
// These map onto the Exeaon lineup roughly as:
//   Spark-class  -> ~7B     (fast, everyday)
//   Arc-class    -> ~13-14B (balanced)
//   Aeon-class   -> ~27B+   (flagship, needs serious RAM/VRAM)
function recommendTier(specs: HardwareSpecs): string {
  const ram = specs.ramGb;
  const vram = specs.vramMb / 1024; // MB -> GB
  const gpuHeadroom = vram >= 12 ? vram : 0;
  if (ram >= 64 || gpuHeadroom >= 24) return "Aeon-class (27B+) — flagship";
  if (ram >= 32 || gpuHeadroom >= 12) return "Arc-class (13–14B) — balanced";
  if (ram >= 16 || gpuHeadroom >= 6) return "Spark-class (7–8B) — fast";
  return "Spark-class mini (1–3B) — lightweight";
}

// Hardware specs are stable for a session, so detect once and cache at module
// scope. Navigating back to this page then reuses the cached specs instead of
// re-probing the machine every time it opens -- the Refresh button forces a
// fresh detect.
let cachedSpecs: HardwareSpecs | null = null;

export default function ModelsPage() {
  const { t } = useTranslation("openhands");
  const [specs, setSpecs] = React.useState<HardwareSpecs | null>(null);
  const [modelsDir, setModelsDir] = React.useState<string>("");
  const [localModels, setLocalModels] = React.useState<LocalModelEntry[]>([]);
  const [running, setRunning] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [hasTauri, setHasTauri] = React.useState(false);

  const refreshStatus = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const status = await invoke<boolean>("local_model_status");
      setRunning(status);
    } catch {
      setRunning(false);
    }
  }, [hasTauri]);

  const loadModels = React.useCallback(async () => {
    if (!hasTauri) return;
    try {
      const dir = await invoke<string>("models_dir");
      setModelsDir(dir);
      // Frontend can't enumerate the dir directly; the command returns the
      // path, and we rely on the run flow to surface errors for missing files.
      setLocalModels([]);
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
      // Keep the last-known specs on a failed re-detect rather than blanking.
      setSpecs(cachedSpecs);
    }
  }, []);

  React.useEffect(() => {
    // Only meaningful inside the Tauri webview; degrade to a static page in
    // the plain browser (dev/cloud preview).
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

  const startModel = async (path: string) => {
    setBusy(true);
    setError("");
    try {
      await invoke("start_local_model", { modelPath: path });
      await refreshStatus();
    } catch (e) {
      setError(String(e));
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
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h1 className="text-lg font-semibold text-[var(--oh-fg)]">
          {t("NAV$MODELS")}
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
                    <span className="text-[var(--oh-fg)]">{specs.ramGb} GB</span>
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
                <div className="mt-4 rounded-lg bg-[var(--oh-bg)] px-3 py-2 text-sm">
                  <span className="text-[var(--oh-muted)]">
                    Recommended for this machine:{" "}
                  </span>
                  <span className="font-semibold text-[#F3CE49]">
                    {recommendTier(specs)}
                  </span>
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
              <span className="text-[var(--oh-fg)]">
                Local model server:{" "}
              </span>
              <span className={running ? "text-emerald-300" : "text-zinc-400"}>
                {running ? "running" : "stopped"}
              </span>
              {running && (
                <span className="ml-2 text-xs text-[var(--oh-muted)]">
                  http://127.0.0.1:18002/v1
                </span>
              )}
            </div>
            <div className="ml-auto">
              {running ? (
                <button
                  type="button"
                  onClick={stopModel}
                  disabled={busy}
                  className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || localModels.length === 0}
                  onClick={() => localModels[0] && startModel(localModels[0].path)}
                  className="rounded-lg bg-[#F3CE49] px-3 py-1.5 text-sm font-semibold text-[#070605] hover:bg-[#F7DA6B] disabled:opacity-40"
                >
                  Start first model
                </button>
              )}
            </div>
          </div>

          {/* Models directory hint */}
          <div className="mx-6 mb-5 rounded-xl border border-dashed border-[var(--oh-border)] p-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--oh-muted)]">
              Download models
            </div>
            <p className="mb-3 text-sm text-[var(--oh-muted)]">
              Put a GGUF file in your models folder, then start it here. The
              folder opens at:{" "}
              <code className="text-xs text-[var(--oh-fg)]">{modelsDir || "…"}</code>
            </p>
            <p className="text-xs leading-relaxed text-[var(--oh-muted)]">
              Tip: use the tier above as a guide — Spark-class (7–8B Q4_K_M,
              ~5 GB) runs on most laptops; Arc-class (13–14B, ~8–9 GB) needs
              16 GB+ RAM; Aeon-class (27B+, ~16 GB) needs 32 GB+ RAM or a
              big GPU.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
