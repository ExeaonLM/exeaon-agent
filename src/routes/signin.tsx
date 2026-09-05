import { useNavigate } from "react-router";
import { OnboardingModal } from "#/components/features/onboarding/onboarding-modal";

/**
 * In-app sign in — the full-cover onboarding welcome (native email/password).
 * Non-blocking: signing in or choosing local both return to the app. Reached
 * from the profile popover's "Sign in" and the account page.
 */
export default function SignInRoute() {
  const navigate = useNavigate();
  return <OnboardingModal onClose={() => navigate("/")} />;
}
