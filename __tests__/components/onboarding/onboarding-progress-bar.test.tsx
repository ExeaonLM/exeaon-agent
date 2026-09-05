import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingProgressBar } from "#/components/features/onboarding/onboarding-progress-bar";

describe("OnboardingProgressBar", () => {
  it("renders progress percentage and fills the bar", () => {
    render(<OnboardingProgressBar currentStep={1} totalSteps={4} />);

    const bar = screen.getByTestId("onboarding-progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("STEP 2 OF 4")).toBeInTheDocument();

    const fill = screen.getByTestId("onboarding-progress-fill");
    expect(fill).toHaveStyle({ width: "50%" });
  });

  it("treats the first step as 33% when there are 3 total steps", () => {
    render(<OnboardingProgressBar currentStep={0} totalSteps={3} />);

    const bar = screen.getByTestId("onboarding-progress-bar");
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText("33%")).toBeInTheDocument();
  });
});
