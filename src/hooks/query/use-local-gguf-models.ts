import React from "react";
import { invoke } from "@tauri-apps/api/core";

/** The OpenAI-compatible endpoint the local llama.cpp server serves on. */
export const LOCAL_MODEL_ENDPOINT = "http://127.0.0.1:18002/v1";
const ACTIVE_MODEL_KEY = "exeaon-local-active-model";

export interface LocalGgufModel {
  name: string;
  path: string;
  sizeGb: number;
}

export interface LocalGgufState {
  /** GGUF files present in the models folder (source of truth = the folder). */
  models: LocalGgufModel[];
  /** Whether the local model server is up. */
  running: boolean;
  /** The model the server is currently serving, when known. */
  runningModel: string | null;
  /** The models folder path (for the "open folder" affordance). */
  modelsDir: string;
  /** The OpenAI-compatible URL of the running model. */
  endpoint: string;
  /** True only inside the Tauri desktop app (invokes are unavailable on web). */
  hasTauri: boolean;
  refresh: () => void;
}

const readActiveModel = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_MODEL_KEY);
  } catch {
    return null;
  }
};

/**
 * Read-only view of the on-device GGUF models for the unified Models list: the
 * files in the folder, whether the local server is running, and which model it
 * serves. Management (start/stop/switch, downloads) stays on the dedicated
 * Models page; this just surfaces the same state alongside cloud + API models.
 */
export function useLocalGgufModels(): LocalGgufState {
  const [models, setModels] = React.useState<LocalGgufModel[]>([]);
  const [running, setRunning] = React.useState(false);
  const [runningModel, setRunningModel] = React.useState<string | null>(null);
  const [modelsDir, setModelsDir] = React.useState("");
  const [hasTauri, setHasTauri] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const isTauri =
      typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    setHasTauri(isTauri);
    if (!isTauri) return;
    try {
      const [dir, list, status] = await Promise.all([
        invoke<string>("models_dir"),
        invoke<LocalGgufModel[]>("list_local_models"),
        invoke<boolean>("local_model_status"),
      ]);
      setModelsDir(dir);
      setModels(list);
      setRunning(status);
      setRunningModel(status ? readActiveModel() : null);
    } catch {
      // Best-effort: on any failure show nothing rather than break the page.
      setModels([]);
      setRunning(false);
      setRunningModel(null);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    models,
    running,
    runningModel,
    modelsDir,
    endpoint: LOCAL_MODEL_ENDPOINT,
    hasTauri,
    refresh,
  };
}
