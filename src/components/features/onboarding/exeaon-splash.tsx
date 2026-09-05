import React from "react";
import ExeaonLogo from "#/assets/branding/openhands-logo.svg?react";

interface ExeaonSplashProps {
  onDone?: () => void;
  loop?: boolean;
}

/**
 * Full-screen branded splash/loader:
 * - Prominent Exeaon logo in the center with a soft solar ambient halo.
 * - Smooth, cinematic breathing pulse.
 * - Gentle fade-in and smooth fade-out with natural pacing.
 */
export function ExeaonSplash({ onDone, loop = false }: ExeaonSplashProps) {
  React.useEffect(() => {
    if (!loop && onDone) {
      const timer = setTimeout(onDone, 2600);
      return () => clearTimeout(timer);
    }
  }, [onDone, loop]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#070707] transition-opacity duration-700"
      style={
        loop
          ? undefined
          : { animation: "exeaon-splash-wrapper 2.6s cubic-bezier(0.16, 1, 0.3, 1) forwards" }
      }
    >
      <style>{`
        @keyframes exeaon-logo-pulse-loop {
          0%, 100% {
            opacity: 0.85;
            transform: scale(0.96);
            filter: drop-shadow(0 0 16px rgba(255, 208, 38, 0.25));
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
            filter: drop-shadow(0 0 35px rgba(255, 208, 38, 0.45));
          }
        }
        @keyframes exeaon-halo-breathe {
          0%, 100% {
            opacity: 0.18;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.12);
          }
        }
        @keyframes exeaon-logo-pulse-once {
          0% {
            opacity: 0;
            transform: scale(0.9);
            filter: drop-shadow(0 0 10px rgba(255, 208, 38, 0.1));
          }
          30% {
            opacity: 1;
            transform: scale(1.02);
            filter: drop-shadow(0 0 35px rgba(255, 208, 38, 0.45));
          }
          75% {
            opacity: 1;
            transform: scale(1.0);
            filter: drop-shadow(0 0 25px rgba(255, 208, 38, 0.35));
          }
          100% {
            opacity: 0;
            transform: scale(1.05);
            filter: drop-shadow(0 0 50px rgba(255, 208, 38, 0));
          }
        }
        @keyframes exeaon-splash-wrapper {
          0% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            pointer-events: none;
          }
        }
        .exeaon-splash-logo-loop {
          animation: exeaon-logo-pulse-loop 2.4s ease-in-out infinite;
        }
        .exeaon-splash-logo-once {
          animation: exeaon-logo-pulse-once 2.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .exeaon-halo-loop {
          animation: exeaon-halo-breathe 2.4s ease-in-out infinite;
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        {/* Soft solar ambient glow halo behind the logo */}
        <div
          className={`absolute size-44 rounded-full bg-gradient-to-tr from-[#FFD026] via-[#FF7A00] to-[#FF3D00] blur-2xl ${
            loop ? "exeaon-halo-loop" : "opacity-25"
          }`}
        />

        {/* Cinematic centered Exeaon Logo */}
        <div
          className={`relative z-10 w-28 h-28 flex items-center justify-center ${
            loop ? "exeaon-splash-logo-loop" : "exeaon-splash-logo-once"
          }`}
        >
          <ExeaonLogo width="100%" height="100%" />
        </div>
      </div>
    </div>
  );
}
