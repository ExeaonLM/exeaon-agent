import React from "react";
import { useLocation } from "react-router";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { useSettings } from "#/hooks/query/use-settings";
import { isSubscriptionLlmConfig } from "#/constants/llm-subscription";
import type { Settings } from "#/types/settings";
import { OnboardingModal } from "./onboarding-modal";
import {
  isOnboardingPreviewActive,
  readOnboardingPreviewStep,
} from "./onboarding-preview";
import { useOnboardingCompletion } from "./use-onboarding-completion";
import { ExeaonSplash } from "./exeaon-splash";

function hasUsableCloudLlm(settings: Settings | undefined): boolean {
  const llm = settings?.agent_settings?.llm as
    | Record<string, unknown>
    | undefined;
  const hasModel =
    typeof llm?.model === "string" && llm.model.trim().length > 0;
  const hasAuth =
    settings?.llm_api_key_set === true || isSubscriptionLlmConfig(llm);
  return hasModel && hasAuth;
}

/**
 * Mounts the onboarding modal automatically the first time the user
 * lands on a host route (i.e. when the localStorage onboarding flag
 * isn't set yet). Closing or completing the flow marks it done so the
 * modal won't re-appear on subsequent visits.
 *
 * An already-authenticated Cloud backend may provide everything onboarding
 * would collect. Once the active Cloud backend reports a usable LLM, suppress
 * the redundant modal without writing a fake completion marker. Local backends
 * remain browser-onboarding-driven.
 *
 * With `?previewOnboardingStep=<0-3>` the modal opens on that slide for
 * design review without persisting completion (works on any route when
 * mounted from the root layout).
 *
 * For first-time users the Exeaon branded splash screen is shown for ~2.4 s
 * before the onboarding modal appears.
 */
export function OnboardingHost() {
  const location = useLocation();
  const previewStep = readOnboardingPreviewStep(location.search);
  const isPreview = isOnboardingPreviewActive(location.search);
  const { isCompleted, markCompleted } = useOnboardingCompletion();
  const { backend } = useActiveBackend();
  const settings = useSettings();
  const isCloudBackend = backend.kind === "cloud";

  // Show the splash only once per session for brand-new users (not previews).
  const [showSplash, setShowSplash] = React.useState(() => {
    if (isPreview) return false;
    // If onboarding is already done we won't show the modal at all, so skip
    // the splash too.
    const done = !!window.localStorage.getItem("openhands-onboarding-completed");
    return !done;
  });

  if (!isPreview) {
    if (isCompleted) return null;
    if (isCloudBackend && settings.isLoading) return null;
    if (isCloudBackend && hasUsableCloudLlm(settings.data)) {
      return null;
    }
  }

  if (showSplash) {
    return <ExeaonSplash onDone={() => setShowSplash(false)} />;
  }

  const handleClose = () => {
    if (isPreview) return;
    markCompleted();
  };

  return (
    <OnboardingModal
      onClose={handleClose}
      initialStep={previewStep ?? 0}
      isPreview={isPreview}
    />
  );
}
