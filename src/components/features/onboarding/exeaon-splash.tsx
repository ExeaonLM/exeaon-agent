import React from "react";
import ExeaonLogo from "#/assets/branding/openhands-logo.svg?react";

interface ExeaonSplashProps {
  onDone: () => void;
}

/**
 * Full-screen branded splash shown once before the onboarding modal.
 * - Exeaon logo pulses (fade in -> hold -> fade out).
 * - A gold infinity path draws itself around the logo.
 * Auto-calls onDone after the animation completes (~2.4 s).
 */
export function ExeaonSplash({ onDone }: ExeaonSplashProps) {
  React.useEffect(() => {
    const timer = setTimeout(onDone, 2400);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0A0A]"
      style={{ animation: "exeaon-splash-wrapper 2.4s ease forwards" }}
    >
      <style>{`
        @keyframes exeaon-logo-pulse {
          0%   { opacity: 0; transform: scale(0.88); }
          25%  { opacity: 1; transform: scale(1); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes exeaon-infinity-spin {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes exeaon-splash-wrapper {
          0%   { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .exeaon-splash-logo {
          animation: exeaon-logo-pulse 2.2s ease forwards;
        }
        .exeaon-infinity-path {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: exeaon-infinity-spin 1.8s ease-in-out 0.2s forwards;
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        {/* Gold infinity SVG that draws itself around the logo */}
        <svg
          viewBox="-90 -55 180 110"
          width="320"
          height="200"
          className="absolute"
          aria-hidden
        >
          <path
            d="M0,0 C0,-40 60,-40 60,0 C60,40 20,40 0,0 C-20,-40 -60,-40 -60,0 C-60,40 0,40 0,0Z"
            fill="none"
            stroke="#F3CE49"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="exeaon-infinity-path"
          />
        </svg>

        {/* Pulsing Exeaon logo */}
        <div className="exeaon-splash-logo w-20 h-20 relative z-10">
          <ExeaonLogo width="100%" height="100%" />
        </div>
      </div>
    </div>
  );
}
