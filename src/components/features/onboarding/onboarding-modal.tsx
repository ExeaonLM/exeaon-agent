import React from "react";
import { Loader2, Laptop, ShieldCheck } from "lucide-react";
import ExeaonLogo from "#/assets/branding/openhands-logo.svg?react";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { useTracking } from "#/hooks/use-tracking";
import { DeviceFlowAuth } from "#/components/features/backends/device-flow-auth";

interface OnboardingModalProps {
  /** Called when the user dismisses the modal (skip / X / launch). */
  onClose: () => void;
  /** Optional slide index for dev preview. */
  initialStep?: number;
  /** When true, skip/close does not persist onboarding completion. */
  isPreview?: boolean;
}

export function OnboardingModal({
  onClose,
  isPreview = false,
}: OnboardingModalProps) {
  const { trackOnboardingCompleted } = useTracking();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const handleContinueLocal = React.useCallback(() => {
    if (!isPreview) {
      trackOnboardingCompleted({ mode: "local" });
    }
    onClose();
  }, [isPreview, onClose, trackOnboardingCompleted]);

  const handleStartAuth = () => {
    setIsAuthenticating(true);
  };

  return (
    <ModalBackdrop aria-label="Welcome to Exeaon Claw">
      <div className="relative flex flex-col items-center justify-center min-h-[500px] w-full max-w-[390px] px-4 py-8 mx-auto">
        {/* Glowing Exeaon Logo & Title */}
        <div className="flex flex-col items-center text-center gap-4 mb-7">
          <div className="relative flex items-center justify-center">
            {/* Soft ambient solar halo */}
            <div className="absolute size-24 rounded-full bg-gradient-to-tr from-[#FFD026] via-[#FF7A00] to-[#FF3D00] opacity-25 blur-2xl animate-pulse" />
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-[#12110D] border border-[#FFD026]/30 shadow-[0_0_30px_rgba(255,208,38,0.25)]">
              <ExeaonLogo className="size-8 text-[#FFD026]" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mt-1">
            Welcome to <span className="bg-gradient-to-r from-[#FFD026] via-[#FFF4B8] to-[#FF7A00] bg-clip-text text-transparent">Exeaon Claw</span>
          </h1>
        </div>

        {/* Antigravity-Style Clean Compact Card */}
        <section
          data-testid="onboarding-modal"
          className="w-full flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#12110D]/95 p-6 shadow-2xl backdrop-blur-xl transition-all"
        >
          <div className="text-center pb-1">
            <span className="text-sm font-medium text-[var(--oh-muted)]">
              {isAuthenticating ? "Authenticating..." : "Sign in"}
            </span>
          </div>

          {isAuthenticating ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 text-sm font-medium">
                <Loader2 className="size-4 animate-spin text-sky-400" />
                <span>Awaiting Authentication...</span>
              </div>

              <div className="pt-2">
                <DeviceFlowAuth
                  host="https://cloud.exeaon.dev"
                  source="onboarding"
                  onConnected={() => {
                    if (!isPreview) trackOnboardingCompleted({ mode: "cloud" });
                    onClose();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAuthenticating(false)}
                className="text-xs text-[var(--oh-muted)] hover:text-white transition-colors mt-2 text-center"
              >
                ← Back to sign in options
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Primary Cloud Sign In */}
              <button
                type="button"
                data-testid="onboarding-signin-default"
                onClick={handleStartAuth}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0070F3] hover:bg-[#0060DF] text-white text-sm font-medium transition-all shadow-md hover:shadow-[0_0_20px_rgba(0,112,243,0.35)] cursor-pointer active:scale-[0.98]"
              >
                <span>Sign in</span>
              </button>

              {/* Secondary Business / Team Account */}
              <button
                type="button"
                data-testid="onboarding-signin-business"
                onClick={handleStartAuth}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A1813] hover:bg-[#24211A] text-white/90 hover:text-white text-sm font-medium border border-white/10 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <span>Use business account</span>
              </button>

              {/* Continue with Local Sovereign Engine */}
              <button
                type="button"
                data-testid="onboarding-continue-local"
                onClick={handleContinueLocal}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-transparent hover:bg-white/5 text-[var(--oh-muted)] hover:text-white text-sm font-medium border border-white/5 transition-colors cursor-pointer mt-1"
              >
                <Laptop className="size-4 text-[#FFD026]" />
                <span>Continue with Local Engine</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-center pt-2 text-center">
            <a
              href="https://docs.exeaon.dev/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--oh-muted)]/70 hover:text-white underline underline-offset-4 transition-colors"
            >
              Having trouble? Let us know
            </a>
          </div>
        </section>

        {/* Bottom Explore Link */}
        <div className="flex items-center justify-center mt-6">
          <button
            type="button"
            onClick={handleContinueLocal}
            className="text-xs text-[var(--oh-muted)] hover:text-white transition-colors cursor-pointer"
          >
            Explore Workspace without Signing In →
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
