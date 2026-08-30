import React from "react";
import { invoke } from "@tauri-apps/api/core";

/** The OpenAI-compatible endpoint the local llama.cpp server serves on. */
export const LOCAL_MODEL_ENDPOINT = "http://127.0.0.1:18002/v1";
const ACTIVE_MODEL_KEY = "exeaon-local-active-model";

export interface LocalGgufModel {
  name: string;
  path: string;
  sizeGb: number;
  /** User-set display name (falls back to the file name). */
  displayName: string;
}

const GGUF_NAMES_KEY = "exeaon-gguf-display-names";

function readNameOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GGUF_NAMES_KEY) || "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function writeNameOverride(path: string, name: string): void {
  try {
    const all = readNameOverrides();
    const trimmed = name.trim();
    if (trimmed) all[path] = trimmed;
    else delete all[path];
    localStorage.setItem(GGUF_NAMES_KEY, JSON.stringify(all));
  } catch {
    /* ignore: rename is a convenience, never load-bearing */
  }
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
  /** Set a GGUF's display name (name-edit only; the file itself is untouched). */
  rename: (path: string, name: string) => void;
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
      const overrides = readNameOverrides();
      setModelsDir(dir);
      setModels(
        list.map((m) => ({ ...m, displayName: overrides[m.path] || m.name })),
      );
      setRunning(status);
      setRunningModel(status ? readActiveModel() : null);
    } catch {
      // Best-effort: on any failure show nothing rather than break the page.
      setModels([]);
      setRunning(false);
      setRunningModel(null);
    }
  }, []);

  const rename = React.useCallback(
    (path: string, name: string) => {
      writeNameOverride(path, name);
      refresh();
    },
    [refresh],
  );

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
    rename,
  };
}
