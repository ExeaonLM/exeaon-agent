import { useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { Check, Loader2, Copy } from "lucide-react";
import { useGitHubDeviceFlow } from "#/hooks/use-github-device-flow";
import { useSearchSecrets } from "#/hooks/query/use-get-secrets";
import { GITHUB_TOKEN_SECRET } from "#/constants/github-oauth";
import { isNativeDialogAvailable } from "#/utils/pick-workspace-folder";

/**
 * "Connect GitHub" via OAuth Device Flow. Renders a pill; connected state comes
 * from the saved provider token (useUserProviders). Only meaningful in the Tauri
 * desktop app, where the Rust device-flow commands exist — hidden otherwise.
 */
export function ConnectGitHubButton() {
  const { data: secrets = [] } = useSearchSecrets();
  const isConnected = secrets.some((s) => s.name === GITHUB_TOKEN_SECRET);
  const flow = useGitHubDeviceFlow();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Once connected, the pill vanishes from the home — GitHub is then managed
  // from the sidebar account menu and Settings → Account. Also nothing to show
  // outside Tauri, where the device-flow Rust commands don't exist.
  if (isConnected || !isNativeDialogAvailable()) return null;

  const openAndStart = () => {
    setOpen(true);
    void flow.start();
  };

  const close = () => {
    setOpen(false);
    flow.reset();
    setCopied(false);
  };

  const copyCode = async () => {
    if (!flow.userCode) return;
    try {
      await navigator.clipboard.writeText(flow.userCode);
      setCopied(true);
    } catch {
      // Clipboard unavailable — the code is shown for manual entry.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openAndStart}
        className="flex h-9 items-center gap-2 rounded-full border border-[var(--oh-border)] pl-3 pr-3.5 text-sm text-[var(--oh-fg)] transition-colors hover:border-[#F3CE49]/50"
      >
        <FaGithub className="size-3.5 text-[var(--oh-muted)]" aria-hidden />
        Connect GitHub
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#2B2316] bg-[#0D0B08] p-6 text-[#EDE7D8] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#241F14] text-[#FFD026]">
                <FaGithub className="size-5" aria-hidden />
              </div>
              <h2 className="text-base font-bold text-white">Connect GitHub</h2>
            </div>

            {(flow.status === "starting" || flow.status === "idle") && (
              <p className="flex items-center gap-2 text-sm text-[var(--oh-muted)]">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Requesting a device code from GitHub…
              </p>
            )}

            {flow.status === "awaiting" && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-[var(--oh-muted)]">
                  1. Go to{" "}
                  <button
                    type="button"
                    onClick={flow.openVerification}
                    className="text-[#FFD026] underline"
                  >
                    {(
                      flow.verificationUri ?? "github.com/login/device"
                    ).replace(/^https?:\/\//, "")}
                  </button>{" "}
                  (click to open, or type it into your browser).
                </p>
                <p className="text-sm text-[var(--oh-muted)]">
                  2. Enter this code:
                </p>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex items-center justify-center gap-3 rounded-xl border border-[#2B2316] bg-[#14110C] py-3 font-mono text-2xl font-bold tracking-[0.3em] text-white hover:border-[#FFD026]/40"
                  title="Copy code"
                >
                  {flow.userCode}
                  {copied ? (
                    <Check className="size-4 text-[#8BD98B]" aria-hidden />
                  ) : (
                    <Copy
                      className="size-4 text-[var(--oh-muted)]"
                      aria-hidden
                    />
                  )}
                </button>
                <p className="flex items-center gap-2 text-xs text-[var(--oh-muted)]">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Waiting for you to approve on GitHub…
                </p>
              </div>
            )}

            {flow.status === "success" && (
              <p className="flex items-center gap-2 text-sm text-[#8BD98B]">
                <Check className="size-4" aria-hidden />
                GitHub connected. Your repositories are now available.
              </p>
            )}

            {flow.status === "error" && (
              <p className="text-sm text-red-400">{flow.error}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              {flow.status === "error" && (
                <button
                  type="button"
                  onClick={() => void flow.start()}
                  className="rounded-xl border border-[#2E281F] bg-[#18140E] px-4 py-2 text-xs font-medium text-[#EDE7D8] hover:border-[#FFD026]/40"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-xl bg-[#FFD026] px-4 py-2 text-xs font-bold text-black hover:bg-[#FFE066]"
              >
                {flow.status === "success" ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
