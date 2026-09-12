import { describe, expect, it } from "vitest";
import {
  resolveCapabilities,
  capabilityStatus,
  localManagedMcpSource,
  ardDiscoverySource,
  buildMcpConfigForCapabilities,
  type Capability,
  type DiscoverySource,
  type EnvironmentSnapshot,
} from "#/capabilities/capability-registry";

const WIN: EnvironmentSnapshot = {
  os: "win32",
  hasNetwork: true,
  installed: { node: true, python: true },
};

describe("capability-registry (the discovery spine)", () => {
  it("the local source exposes the managed MCPs as capabilities", () => {
    const caps = localManagedMcpSource.discover({ needs: [] }, WIN);
    const keys = caps.map((c) => c.key);
    expect(keys).toContain("cyber-unified");
    expect(keys).toContain("research");
    expect(keys).toContain("scholar");
    // every local capability is an mcp with a spec + provides tags
    for (const c of caps) {
      expect(c.kind).toBe("mcp");
      expect(c.spec).toBeTruthy();
      expect(c.provides.length).toBeGreaterThan(0);
    }
  });

  it("the ARD source is a wired seam that currently yields nothing", () => {
    expect(ardDiscoverySource.tier).toBe("public");
    expect(ardDiscoverySource.discover({ needs: ["anything"] }, WIN)).toEqual(
      [],
    );
  });

  it("resolves a task's needs to the capabilities that provide them", async () => {
    const res = await resolveCapabilities({ needs: ["web.fetch"] }, WIN);
    const keys = res.required.map((r) => r.capability.key);
    expect(keys).toContain("cyber-unified");
    // web.fetch is not provided by, say, the RTL sim
    expect(keys).not.toContain("rtl-sim");
  });

  it("classifies ready vs acquirable from the environment (not a field)", async () => {
    const res = await resolveCapabilities(
      { needs: ["research.integrity", "sim.physics"] },
      WIN,
    );
    const research = res.required.find((r) => r.capability.key === "research");
    const mujoco = res.required.find(
      (r) => r.capability.key === "robotics-mujoco",
    );
    // research: python present, bundled -> ready
    expect(research?.status).toBe("ready");
    // mujoco: needs the mujoco pip dep which isn't installed -> acquirable
    expect(mujoco?.status).toBe("acquirable");
    expect(res.available.map((r) => r.capability.key)).toContain("research");
    expect(res.missing.map((r) => r.capability.key)).toContain(
      "robotics-mujoco",
    );
  });

  it("marks platform-incompatible capabilities unavailable", () => {
    const deviceCap = localManagedMcpSource
      .discover({ needs: [] }, WIN)
      .find((c) => c.key === "device-windows")!;
    expect(capabilityStatus(deviceCap, { os: "darwin" })).toBe("unavailable");
    expect(
      capabilityStatus(deviceCap, { os: "win32", installed: {} }),
    ).toBe("ready");
  });

  it("marks network-only capabilities unavailable when offline", () => {
    const scholar = localManagedMcpSource
      .discover({ needs: [] }, WIN)
      .find((c) => c.key === "scholar")!;
    expect(
      capabilityStatus(scholar, {
        os: "win32",
        hasNetwork: false,
        installed: { python: true },
      }),
    ).toBe("unavailable");
  });

  it("reports needs no source can satisfy as unmet gaps", async () => {
    const res = await resolveCapabilities(
      { needs: ["quantum.annealing"] },
      WIN,
    );
    expect(res.required).toHaveLength(0);
    expect(res.unmet).toEqual(["quantum.annealing"]);
  });

  it("dedupes across tiers, locality wins", async () => {
    // a fake enterprise source that also offers "research.integrity"
    const enterprise: DiscoverySource = {
      id: "enterprise:test",
      tier: "enterprise",
      discover(): Capability[] {
        return [
          {
            key: "research",
            kind: "mcp",
            tier: "enterprise",
            provides: ["research.integrity"],
            meta: {
              platforms: ["win32", "darwin", "linux"],
              requiresNetwork: true,
              install: "external",
              security: "low",
            },
            description: "enterprise research service",
          },
        ];
      },
    };
    const res = await resolveCapabilities({ needs: ["research.integrity"] }, WIN, [
      localManagedMcpSource,
      enterprise,
      ardDiscoverySource,
    ]);
    const research = res.required.find((r) => r.capability.key === "research");
    // local instance wins over the enterprise one
    expect(research?.capability.tier).toBe("local");
  });

  it("builds an mcp_config fragment from resolved MCP capabilities", async () => {
    const res = await resolveCapabilities({ needs: ["research.integrity"] }, WIN);
    const cfg = buildMcpConfigForCapabilities(res.required, {
      nodePath: "/node",
      pythonPath: "/python",
      mcpRoot: "/mcp",
    });
    const names = Object.keys(cfg);
    expect(names.some((n) => n.startsWith("exeaon-field-research"))).toBe(true);
    for (const v of Object.values(cfg)) {
      expect(v.enabled).toBe(true);
    }
  });
});
