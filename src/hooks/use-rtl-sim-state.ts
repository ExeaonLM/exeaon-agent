import { useMemo } from "react";
import { useEventStore } from "#/stores/use-event-store";
import { isObservationEvent } from "#/types/agent-server/type-guards";
import { textFromContent } from "#/components/features/chat/tool-visualizers/text-content";

/** One signal's value-change trace: [time, value] points. `value` is "0"/"1"/
 * "x"/"z" for scalars, or a bit-string ("1010") for buses. */
export interface RtlSignal {
  name: string;
  width: number;
  wave: [number, string][];
}

export interface RtlWaveform {
  active: boolean;
  timescale: string;
  endTime: number;
  signals: RtlSignal[];
  log: string | null;
  installed: boolean | null;
  hint: string | null;
}

const EMPTY: RtlWaveform = {
  active: false,
  timescale: "1ns",
  endTime: 0,
  signals: [],
  log: null,
  installed: null,
  hint: null,
};

const RTL_MCP = "rtl-sim";

function parsePayload(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
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
 * Derives the live RTL waveform from the conversation event stream: the latest
 * `rtl-sim` MCP simulate / get_waveform observation. Drives the waveform viewer.
 */
export function useRtlSimState(): RtlWaveform {
  const events = useEventStore((s) => s.events);

  return useMemo(() => {
    const wf: RtlWaveform = { ...EMPTY };
    let sawAny = false;

    for (const event of events) {
      if (!isObservationEvent(event)) continue;
      const toolName = (event as { tool_name?: string }).tool_name ?? "";
      if (!toolName.includes(RTL_MCP)) continue;

      const obs = event.observation as {
        content?: Parameters<typeof textFromContent>[0];
        is_error?: boolean;
      };
      const text = textFromContent(obs.content ?? []).trim();
      if (!text) continue;

      const payload = parsePayload(text);
      if (!payload) {
        if (/not (installed|found)|iverilog/i.test(text)) {
          wf.installed = false;
          wf.hint = text;
        }
        continue;
      }

      sawAny = true;

      if ("installed" in payload) {
        wf.installed = Boolean(payload.installed);
        if (typeof payload.hint === "string") wf.hint = payload.hint;
      }

      // A waveform result (simulate / get_waveform): carries `signals`.
      if (Array.isArray(payload.signals)) {
        wf.signals = payload.signals as RtlSignal[];
        wf.timescale =
          typeof payload.timescale === "string"
            ? payload.timescale
            : wf.timescale;
        wf.endTime = Number(payload.end_time ?? wf.endTime);
        wf.log = typeof payload.log === "string" ? payload.log : wf.log;
        wf.installed = wf.installed ?? true;
      }
    }

    wf.active = wf.signals.length > 0;
    if (!sawAny) return EMPTY;
    return wf;
  }, [events]);
}
