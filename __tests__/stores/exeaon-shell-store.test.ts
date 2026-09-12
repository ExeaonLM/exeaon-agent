import { beforeEach, describe, expect, it } from "vitest";
import {
  useExeaonShellStore,
  resolveSurface,
} from "#/stores/exeaon-shell-store";

/**
 * The spine of the re-architected shell (docs/EXEAON_ARCHITECTURE.md §9).
 * These tests pin the model rules so later UI work can't silently break them.
 */
describe("exeaon-shell-store (the shell spine)", () => {
  beforeEach(() => {
    // Reset to a known baseline between cases (the store is a singleton).
    useExeaonShellStore.setState({
      primaryMode: "conversation",
      activeOverlay: "none",
      orbPosition: { x: 24, y: 120 },
      orbOpen: false,
      orbStatus: "idle",
    });
  });

  it("defaults to conversation, no overlay, orb closed/idle", () => {
    const s = useExeaonShellStore.getState();
    expect(s.primaryMode).toBe("conversation");
    expect(s.activeOverlay).toBe("none");
    expect(s.orbOpen).toBe(false);
    expect(s.orbStatus).toBe("idle");
    expect(resolveSurface(s)).toBe("conversation");
  });

  it("toggleMode flips Conversation <-> View", () => {
    useExeaonShellStore.getState().toggleMode();
    expect(useExeaonShellStore.getState().primaryMode).toBe("view");
    useExeaonShellStore.getState().toggleMode();
    expect(useExeaonShellStore.getState().primaryMode).toBe("conversation");
  });

  it("an overlay fills the page; primaryMode is untouched underneath", () => {
    useExeaonShellStore.getState().openUtility();
    let s = useExeaonShellStore.getState();
    expect(s.activeOverlay).toBe("utility");
    expect(resolveSurface(s)).toBe("utility");
    // the orb still carries the mode
    expect(s.primaryMode).toBe("conversation");

    useExeaonShellStore.getState().closeOverlay();
    s = useExeaonShellStore.getState();
    expect(s.activeOverlay).toBe("none");
    expect(resolveSurface(s)).toBe("conversation");
  });

  it("agent opens Utility while in View -> closing returns to View (orb kept the mode)", () => {
    // user is in View
    useExeaonShellStore.getState().setPrimaryMode("view");
    // agent throws the user into Utility on its own
    useExeaonShellStore.getState().openUtility();
    expect(resolveSurface(useExeaonShellStore.getState())).toBe("utility");
    // closing Utility lands back on View, not Conversation
    useExeaonShellStore.getState().closeOverlay();
    expect(resolveSurface(useExeaonShellStore.getState())).toBe("view");
  });

  it("Settings is a separate overlay with the same return-to-mode rule", () => {
    useExeaonShellStore.getState().setPrimaryMode("view");
    useExeaonShellStore.getState().openSettings();
    expect(resolveSurface(useExeaonShellStore.getState())).toBe("settings");
    useExeaonShellStore.getState().closeOverlay();
    expect(resolveSurface(useExeaonShellStore.getState())).toBe("view");
  });

  it("mode can change while an overlay is open (orb works over Utility)", () => {
    useExeaonShellStore.getState().openUtility();
    useExeaonShellStore.getState().toggleMode();
    const s = useExeaonShellStore.getState();
    // still showing utility, but the mode underneath flipped
    expect(resolveSurface(s)).toBe("utility");
    expect(s.primaryMode).toBe("view");
    s.closeOverlay();
    expect(resolveSurface(useExeaonShellStore.getState())).toBe("view");
  });

  it("orb position / open / status update independently", () => {
    useExeaonShellStore.getState().setOrbPosition({ x: 500, y: 40 });
    useExeaonShellStore.getState().toggleOrbOpen();
    useExeaonShellStore.getState().setOrbStatus("executing");
    const s = useExeaonShellStore.getState();
    expect(s.orbPosition).toEqual({ x: 500, y: 40 });
    expect(s.orbOpen).toBe(true);
    expect(s.orbStatus).toBe("executing");
    // none of that touched the surface state
    expect(resolveSurface(s)).toBe("conversation");
  });
});
