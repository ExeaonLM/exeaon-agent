import type { LocalWorkspace } from "#/types/workspace";

function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) || trimmed : trimmed;
}

/**
 * Open the native OS folder picker (Tauri dialog plugin) and return the chosen
 * directory as a workspace, or null if the user cancelled.
 *
 * The OS dialog is the right tool here: it gives folder creation, rename, and
 * full navigation for free — none of which the in-app browser can do without a
 * dedicated agent-server endpoint. Throws when the native dialog isn't available
 * (a non-Tauri context, or before the Tauri side has been rebuilt with the
 * dialog plugin), so callers can fall back to the in-app folder browser.
 */
export async function pickWorkspaceFolderNative(): Promise<LocalWorkspace | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select workspace folder",
  });
  // `directory: true, multiple: false` resolves to a single path or null.
  if (typeof selected !== "string") return null;
  return { id: selected, name: basename(selected), path: selected };
}

/** Whether the native Tauri dialog is likely available in this runtime. */
export function isNativeDialogAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}
