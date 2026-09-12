import { useMemo } from "react";
import { useEventStore } from "#/stores/use-event-store";
import { isObservationEvent } from "#/types/agent-server/type-guards";
import { textFromContent } from "#/components/features/chat/tool-visualizers/text-content";

/** One static geom descriptor from the model schema (load_model). */
export interface RoboticsGeom {
  name: string;
  type: string; // plane | sphere | capsule | cylinder | box | ellipsoid | mesh
  size: number[];
  rgba: number[];
}

export interface RoboticsScene {
  /** True once a model has been loaded (geom schema seen). */
  active: boolean;
  model: string | null;
  geoms: RoboticsGeom[];
  /** Latest per-geom world position [[x,y,z], …]. */
  xpos: number[][];
  /** Latest per-geom world rotation (row-major 3x3, 9 values each). */
  xmat: number[][];
  time: number;
  qpos: number[];
  qvel: number[];
  /** Count of step observations seen (a liveness counter for the UI). */
  updates: number;
  /** MuJoCo install state from mujoco_status: true/false/null(unknown). */
  installed: boolean | null;
  /** Install hint surfaced when MuJoCo isn't present. */
  hint: string | null;
}

const EMPTY: RoboticsScene = {
  active: false,
  model: null,
  geoms: [],
  xpos: [],
  xmat: [],
  time: 0,
  qpos: [],
  qvel: [],
  updates: 0,
  installed: null,
  hint: null,
};

const ROBOTICS_MCP = "robotics-mujoco";

function parsePayload(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // OpenHands may wrap the tool text — pull the first {...} block out.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<
          string,
          unknown
        >;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Derives the live robotics scene from the conversation event stream: every
 * `robotics-mujoco` MCP tool observation (load_model → schema+state, step /
 * get_state / reset → state) folds into the current scene. Drives the live 3D
 * viewer — real sim state, not animation.
 */
export function useRoboticsSimState(): RoboticsScene {
  const events = useEventStore((s) => s.events);

  return useMemo(() => {
    const scene: RoboticsScene = { ...EMPTY };
    let sawAny = false;

    for (const event of events) {
      if (!isObservationEvent(event)) continue;
      const toolName = (event as { tool_name?: string }).tool_name ?? "";
      // Only the robotics MuJoCo MCP's tool results carry the sim scene.
      if (!toolName.includes(ROBOTICS_MCP)) continue;

      const obs = event.observation as {
        content?: Parameters<typeof textFromContent>[0];
        is_error?: boolean;
      };
      const text = textFromContent(obs.content ?? []).trim();
      if (!text) continue;

      const payload = parsePayload(text);
      if (!payload) {
        // Non-JSON result — most likely the "MuJoCo is not installed" hint.
        if (/not installed|pip install mujoco/i.test(text)) {
          scene.installed = false;
          scene.hint = text;
        }
        continue;
      }

      sawAny = true;

      if ("installed" in payload) {
        scene.installed = Boolean(payload.installed);
        if (typeof payload.hint === "string") scene.hint = payload.hint;
      }

      // Schema (load_model): carries geoms; may embed an initial state.
      if (Array.isArray(payload.geoms)) {
        scene.geoms = payload.geoms as RoboticsGeom[];
        scene.model =
          typeof payload.name === "string" ? payload.name : scene.model;
        const embedded = payload.state as Record<string, unknown> | undefined;
        if (embedded && Array.isArray(embedded.geom_xpos)) {
          scene.xpos = embedded.geom_xpos as number[][];
          scene.xmat = (embedded.geom_xmat as number[][]) ?? [];
          scene.time = Number(embedded.time ?? 0);
          scene.qpos = (embedded.qpos as number[]) ?? [];
          scene.qvel = (embedded.qvel as number[]) ?? [];
        }
      }

      // State (step / get_state / reset): per-geom world transforms.
      if (Array.isArray(payload.geom_xpos)) {
        scene.xpos = payload.geom_xpos as number[][];
        scene.xmat = (payload.geom_xmat as number[][]) ?? [];
        scene.time = Number(payload.time ?? scene.time);
        scene.qpos = (payload.qpos as number[]) ?? scene.qpos;
        scene.qvel = (payload.qvel as number[]) ?? scene.qvel;
        scene.installed = scene.installed ?? true;
        scene.updates += 1;
      }
    }

    scene.active = scene.geoms.length > 0;
    if (!sawAny) return EMPTY;
    return scene;
  }, [events]);
}
