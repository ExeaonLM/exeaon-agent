import React from "react";
import ExeaonLogo from "#/assets/branding/openhands-logo.svg?react";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { useTracking } from "#/hooks/use-tracking";
import { ExeaonCloudLogin } from "#/components/features/backends/exeaon-cloud-login";

interface OnboardingModalProps {
  /** Called when the user dismisses the modal (skip / signed in / explore). */
  onClose: () => void;
  /** Optional slide index for dev preview. */
  initialStep?: number;
  /** When true, skip/close does not persist onboarding completion. */
  isPreview?: boolean;
}

/**
 * Full-cover welcome + sign-in. Uses the canonical native email/password flow
 * (ExeaonCloudLogin against the Exeaon Cloud gateway — the same one the account
 * UI and /me read), not a device-flow. Always non-blocking: the "Explore
 * without signing in" escape and ExeaonCloudLogin's own local option both drop
 * straight into the app on the local (default) engine.
 */
export function OnboardingModal({
  onClose,
  isPreview = false,
}: OnboardingModalProps) {
  const { trackOnboardingCompleted } = useTracking();

  const handleContinueLocal = React.useCallback(() => {
    if (!isPreview) {
      trackOnboardingCompleted({ agent: "local" });
    }
    onClose();
  }, [isPreview, onClose, trackOnboardingCompleted]);

  const handleSignedIn = React.useCallback(() => {
    if (!isPreview) {
      trackOnboardingCompleted({ agent: "cloud" });
    }
    onClose();
  }, [isPreview, onClose, trackOnboardingCompleted]);

  return (
    <ModalBackdrop aria-label="Welcome to Exeaon Claw">
      <div className="relative flex flex-col items-center justify-center min-h-[500px] w-full max-w-[400px] px-4 py-8 mx-auto">
        {/* Glowing Exeaon Logo & Title */}
        <div className="flex flex-col items-center text-center gap-4 mb-7">
          <div className="relative flex items-center justify-center">
            <div className="absolute size-24 rounded-full bg-gradient-to-tr from-[#FFD026] via-[#FF7A00] to-[#FF3D00] opacity-25 blur-2xl animate-pulse" />
            <div className="relative flex size-14 items-center justify-center rounded-2xl bg-[#12110D] border border-[#FFD026]/30 shadow-[0_0_30px_rgba(255,208,38,0.25)]">
              <ExeaonLogo className="size-8 text-[#FFD026]" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white mt-1">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-[#FFD026] via-[#FFF4B8] to-[#FF7A00] bg-clip-text text-transparent">
              Exeaon Claw
            </span>
          </h1>
        </div>

        {/* Sign-in card — native email/password */}
        <section
          data-testid="onboarding-modal"
          className="w-full flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#12110D]/95 p-6 shadow-2xl backdrop-blur-xl transition-all"
        >
          <ExeaonCloudLogin onSignedIn={handleSignedIn} />

          <div className="flex items-center justify-center pt-1 text-center">
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

        {/* Non-blocking escape into the app on the local (default) engine. */}
        <div className="flex items-center justify-center mt-6">
          <button
            type="button"
            data-testid="onboarding-continue-local"
            onClick={handleContinueLocal}
            className="text-sm font-medium text-[var(--oh-muted)] hover:text-white transition-colors cursor-pointer"
          >
            Explore Workspace without signing in →
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
