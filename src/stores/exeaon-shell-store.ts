import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

/**
 * Exeaon shell state — the SPINE of the re-architected UI.
 * See docs/EXEAON_ARCHITECTURE.md §9 and the desktop-orb model.
 *
 * Everything about the new shell falls out of four fields:
 *
 *   primaryMode   "conversation" | "view"      — the ORB owns this; it is the
 *                                                 memory of where you were.
 *   activeOverlay "none" | "utility" | "settings" — a full-page layer OVER the
 *                                                 primary surface. Utility can be
 *                                                 opened by the USER *or by the
 *                                                 agent itself* (it opens the
 *                                                 browser/terminal to work).
 *   orb           position + open + status      — a draggable, always-on-top
 *                                                 floating bubble (desktop
 *                                                 overlay). It floats over
 *                                                 everything, including overlays.
 *
 * Rules:
 *   - When activeOverlay === "none", the full page renders `primaryMode`.
 *   - Opening Utility/Settings layers over it; the orb keeps floating and keeps
 *     carrying `primaryMode`.
 *   - closeOverlay() returns you to `primaryMode` — the Conversation or View you
 *     were in reappears as the full page.
 *   - Switching mode works whether or not an overlay is open and whether or not
 *     the orb bubble is expanded — `primaryMode` is the single truth.
 *
 * `resolveSurface(state)` is the one render decision for "what fills the page".
 */

export type ExeaonMode = "conversation" | "view";
export type ExeaonOverlay = "none" | "utility" | "settings";

/** Visual state of the floating orb (drives the bubble's glyph/animation). */
export type OrbStatus = "idle" | "thinking" | "executing" | "attention";

export interface OrbPosition {
  /** px from the left of the viewport (clamped to bounds by the orb component). */
  x: number;
  /** px from the top of the viewport. */
  y: number;
}

export interface ExeaonShellState {
  /** The orb's mode = what the full page shows when no overlay is up. */
  primaryMode: ExeaonMode;
  /** A full-page layer over the primary surface. Reset to "none" each session. */
  activeOverlay: ExeaonOverlay;
  /** Floating-bubble position (persisted). */
  orbPosition: OrbPosition;
  /** Whether the orb's popup (Chat/View/Status) is expanded. */
  orbOpen: boolean;
  /** Runtime status glyph — never persisted; driven by agent activity. */
  orbStatus: OrbStatus;

  // --- mode (orb-owned) ---
  setPrimaryMode: (mode: ExeaonMode) => void;
  /** Flip Conversation <-> View. */
  toggleMode: () => void;

  // --- overlays ---
  /** Open the full-page Utility layer. Callable by the user OR the agent. */
  openUtility: () => void;
  /** Open the full-page Settings layer (separate from Utility). */
  openSettings: () => void;
  /** Dismiss any overlay — land back on `primaryMode`. */
  closeOverlay: () => void;
  setOverlay: (overlay: ExeaonOverlay) => void;

  // --- orb ---
  setOrbPosition: (position: OrbPosition) => void;
  setOrbOpen: (open: boolean) => void;
  toggleOrbOpen: () => void;
  setOrbStatus: (status: OrbStatus) => void;
}

/** Default resting spot for the bubble; the orb component clamps to the viewport. */
const DEFAULT_ORB_POSITION: OrbPosition = { x: 24, y: 120 };

export const useExeaonShellStore = create<ExeaonShellState>()(
  devtools(
    persist(
      (set) => ({
        primaryMode: "conversation",
        activeOverlay: "none",
        orbPosition: DEFAULT_ORB_POSITION,
        orbOpen: false,
        orbStatus: "idle",

        setPrimaryMode: (mode) =>
          set({ primaryMode: mode }, false, "setPrimaryMode"),
        toggleMode: () =>
          set(
            (s) => ({
              primaryMode:
                s.primaryMode === "conversation" ? "view" : "conversation",
            }),
            false,
            "toggleMode",
          ),

        openUtility: () =>
          set({ activeOverlay: "utility" }, false, "openUtility"),
        openSettings: () =>
          set({ activeOverlay: "settings" }, false, "openSettings"),
        closeOverlay: () =>
          set({ activeOverlay: "none" }, false, "closeOverlay"),
        setOverlay: (overlay) =>
          set({ activeOverlay: overlay }, false, "setOverlay"),

        setOrbPosition: (position) =>
          set({ orbPosition: position }, false, "setOrbPosition"),
        setOrbOpen: (open) => set({ orbOpen: open }, false, "setOrbOpen"),
        toggleOrbOpen: () =>
          set((s) => ({ orbOpen: !s.orbOpen }), false, "toggleOrbOpen"),
        setOrbStatus: (status) =>
          set({ orbStatus: status }, false, "setOrbStatus"),
      }),
      {
        name: "exeaon-shell",
        storage: createJSONStorage(() => localStorage),
        // Persist only the durable bits. activeOverlay resets to "none" each
        // session (you should never reload straight into a stale overlay), and
        // orbStatus is runtime-only.
        partialize: (s) => ({
          primaryMode: s.primaryMode,
          orbPosition: s.orbPosition,
          orbOpen: s.orbOpen,
        }),
      },
    ),
    { name: "ExeaonShellStore" },
  ),
);

/**
 * The single render decision for "what fills the full page":
 * an overlay if one is up, otherwise the orb's primary mode.
 */
export function resolveSurface(
  state: Pick<ExeaonShellState, "activeOverlay" | "primaryMode">,
): ExeaonOverlay | ExeaonMode {
  return state.activeOverlay === "none"
    ? state.primaryMode
    : state.activeOverlay;
}
