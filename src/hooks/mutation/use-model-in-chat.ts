import { useCallback, useState } from "react";
import { useSaveLlmProfile } from "#/hooks/mutation/use-save-llm-profile";
import { useActivateLlmProfile } from "#/hooks/mutation/use-activate-llm-profile";
import type { SaveProfileRequest } from "#/api/profiles-service/profiles-service.api";
import { fetchMyGatewayKey, cloudHost } from "#/api/cloud/exeaon-models.api";
import { LOCAL_MODEL_ENDPOINT } from "#/hooks/query/use-local-gguf-models";
import {
  displayErrorToast,
  displaySuccessToast,
} from "#/utils/custom-toast-handlers";

/**
 * Turn a Cloud or on-device model into a usable, active LLM profile — the
 * bridge that makes catalog models selectable in chat. Cloud models route
 * through the gateway's /ai/v1 with the caller's personal virtual key (which
 * carries the gateway's provider credentials, so no per-user provider keys);
 * on-device GGUFs route to the local llama.cpp server.
 */
export function useModelInChat() {
  const save = useSaveLlmProfile();
  const activate = useActivateLlmProfile();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (name: string, model: string, baseUrl: string, apiKey: string) => {
      setPending(name);
      try {
        const request = {
          llm: { model, base_url: baseUrl, api_key: apiKey },
          include_secrets: true,
        } as unknown as SaveProfileRequest;
        await save.mutateAsync({ name, request });
        await activate.mutateAsync(name);
        displaySuccessToast(`${name} is now active in chat`);
      } catch {
        displayErrorToast(
          "Couldn't set that model. Make sure the local engine is running.",
        );
      } finally {
        setPending(null);
      }
    },
    [save, activate],
  );

  /** Route a Cloud catalog model through the gateway. */
  const activateCloudModel = useCallback(
    async (displayName: string) => {
      let key: string;
      try {
        key = await fetchMyGatewayKey();
      } catch {
        displayErrorToast("Sign in to Exeaon Cloud to use cloud models.");
        return;
      }
      const host = cloudHost();
      if (!host) {
        displayErrorToast("Sign in to Exeaon Cloud to use cloud models.");
        return;
      }
      // LiteLLM sends the model minus the "openai/" prefix; the gateway matches
      // that against its virtual-model catalog.
      await run(displayName, `openai/${displayName}`, `${host}/ai/v1`, key);
    },
    [run],
  );

  /** Route an on-device GGUF through the local llama.cpp server. */
  const activateLocalModel = useCallback(
    async (displayName: string, fileName: string) => {
      // llama.cpp ignores the key, but the profile requires a non-empty one.
      await run(
        displayName,
        `openai/${fileName}`,
        LOCAL_MODEL_ENDPOINT,
        "sk-local",
      );
    },
    [run],
  );

  return { activateCloudModel, activateLocalModel, pending };
}
