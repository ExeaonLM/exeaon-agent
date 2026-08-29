import { create } from "zustand";

/**
 * In-app updater state (Tauri updater + GitHub Releases).
 *
 * The whole flow lives in one store so the Settings version tile ("Check for
 * update") and the sidebar "Restart to update" chip react to the same state.
 * Outside a packaged Tauri build (dev `tauri dev`, plain browser) there is no
 * bundle to replace, so everything degrades to `unsupported` rather than
 * throwing. The Tauri plugin modules are imported dynamically so the web build
 * never hard-depends on them.
 */
export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready" // downloaded + installed; a relaunch applies it
  | "uptodate"
  | "error"
  | "unsupported";

interface UpdaterState {
  status: UpdaterStatus;
  availableVersion: string | null;
  notes: string | null;
  progress: number; // 0..1 while downloading
  error: string | null;
  /** Check GitHub Releases; if an update exists, auto-download + install it. */
  checkAndUpdate: () => Promise<void>;
  /** Relaunch to apply a downloaded update. */
  relaunch: () => Promise<void>;
}

/** True inside a packaged Tauri desktop build (where in-app updates work). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const isTauri = isTauriRuntime;

// The Update handle returned by check(), kept between check and install.
let pendingUpdate: { downloadAndInstall: (cb?: (e: unknown) => void) => Promise<void> } | null =
  null;

export const useUpdater = create<UpdaterState>((set) => ({
  status: "idle",
  availableVersion: null,
  notes: null,
  progress: 0,
  error: null,

  checkAndUpdate: async () => {
    if (!isTauri()) {
      set({ status: "unsupported" });
      return;
    }
    set({ status: "checking", error: null, progress: 0 });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        set({ status: "uptodate" });
        return;
      }
      pendingUpdate = update as unknown as typeof pendingUpdate;
      set({
        status: "available",
        availableVersion: (update as { version?: string }).version ?? null,
        notes: (update as { body?: string }).body ?? null,
      });

      // Auto-download + install (updates should not require the user to run a
      // command or visit a site — just "download, then restart").
      set({ status: "downloading", progress: 0 });
      let downloaded = 0;
      let total = 0;
      await (update as unknown as {
        downloadAndInstall: (cb: (e: {
          event: string;
          data?: { contentLength?: number; chunkLength?: number };
        }) => void) => Promise<void>;
      }).downloadAndInstall((e) => {
        if (e.event === "Started") {
          total = e.data?.contentLength ?? 0;
        } else if (e.event === "Progress") {
          downloaded += e.data?.chunkLength ?? 0;
          set({ progress: total ? Math.min(1, downloaded / total) : 0 });
        } else if (e.event === "Finished") {
          set({ progress: 1 });
        }
      });
      set({ status: "ready", progress: 1 });
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  relaunch: async () => {
    if (!isTauri()) return;
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));
