import { cn } from "#/utils/utils";

interface OnboardingProgressBarProps {
  /** Index of the current step (0-based). */
  currentStep: number;
  /** Total number of steps in the flow. */
  totalSteps: number;
  className?: string;
}

/**
 * Segmented progress bar rendered at the top of the onboarding modal.
 * Each step is its own pill that fills in as the user moves forward,
 * giving an at-a-glance sense of how far they have to go.
 */
export function OnboardingProgressBar({
  currentStep,
  totalSteps,
  className,
}: OnboardingProgressBarProps) {
  const percentage = Math.min(
    100,
    Math.max(0, Math.round(((currentStep + 1) / totalSteps) * 100)),
  );

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      data-testid="onboarding-progress-bar"
      className={cn("flex w-full flex-col gap-1.5", className)}
    >
      <div className="flex items-center justify-between text-xs font-mono text-[var(--oh-muted)]">
        <span>STEP {currentStep + 1} OF {totalSteps}</span>
        <span className="font-semibold text-[#FFD026]">{percentage}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          data-testid="onboarding-progress-fill"
          className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] via-[#FFD026] to-[#FFF4B8] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(255,208,38,0.5)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
