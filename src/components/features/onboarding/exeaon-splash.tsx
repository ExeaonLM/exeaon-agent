import React from "react";
import ExeaonLogo from "#/assets/branding/openhands-logo.svg?react";

interface ExeaonSplashProps {
  onDone?: () => void;
  loop?: boolean;
}

/**
 * Full-screen branded splash/loader:
 * - Exeaon logo pulses in the center.
 * - A gold infinity path animates around the logo.
 * If loop=true (or onDone not passed), runs continuously as a loading screen.
 * If onDone is passed and loop=false, auto-calls onDone after 2.4s.
 */
export function ExeaonSplash({ onDone, loop = false }: ExeaonSplashProps) {
  React.useEffect(() => {
    if (!loop && onDone) {
      const timer = setTimeout(onDone, 2400);
      return () => clearTimeout(timer);
    }
  }, [onDone, loop]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0A0A]"
      style={
        loop
          ? undefined
          : { animation: "exeaon-splash-wrapper 2.4s ease forwards" }
      }
    >
      <style>{`
        @keyframes exeaon-logo-pulse-loop {
          0%, 100% { opacity: 0.65; transform: scale(0.92); }
          50%      { opacity: 1; transform: scale(1.05); }
        }
        @keyframes exeaon-infinity-spin-loop {
          from { stroke-dashoffset: 600; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes exeaon-logo-pulse-once {
          0%   { opacity: 0; transform: scale(0.88); }
          25%  { opacity: 1; transform: scale(1); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes exeaon-splash-wrapper {
          0%   { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .exeaon-splash-logo-loop {
          animation: exeaon-logo-pulse-loop 2s ease-in-out infinite;
        }
        .exeaon-splash-logo-once {
          animation: exeaon-logo-pulse-once 2.2s ease forwards;
        }
        .exeaon-infinity-path-loop {
          stroke-dasharray: 200 100;
          animation: exeaon-infinity-spin-loop 2.4s linear infinite;
        }
        .exeaon-infinity-path-once {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: exeaon-infinity-spin-loop 1.8s ease-in-out 0.2s forwards;
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        {/* Gold infinity SVG orbiting around the logo */}
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
            className={
              loop
                ? "exeaon-infinity-path-loop"
                : "exeaon-infinity-path-once"
            }
          />
        </svg>

        {/* Pulsing Exeaon logo */}
        <div
          className={`w-20 h-20 relative z-10 ${
            loop ? "exeaon-splash-logo-loop" : "exeaon-splash-logo-once"
          }`}
        >
          <ExeaonLogo width="100%" height="100%" />
        </div>
      </div>
    </div>
  );
}
