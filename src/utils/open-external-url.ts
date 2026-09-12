import { invoke } from "@tauri-apps/api/core";
import { isNativeDialogAvailable } from "#/utils/pick-workspace-folder";

/**
 * Open an http(s) URL in the OS default browser. Uses the Tauri `open_external`
 * command (the webview's own `window.open` doesn't reliably launch the OS
 * browser); falls back to `window.open` outside Tauri (web/dev).
 */
export function openExternalUrl(url: string): void {
  const target = url.trim();
  if (!/^https?:\/\//i.test(target)) return;
  if (isNativeDialogAvailable()) {
    void invoke("open_external", { url: target }).catch(() => {
      try {
        window.open(target, "_blank", "noopener,noreferrer");
      } catch {
        // Nothing else to try.
      }
    });
    return;
  }
  try {
    window.open(target, "_blank", "noopener,noreferrer");
  } catch {
    // Ignore — no way to open in this context.
  }
}
