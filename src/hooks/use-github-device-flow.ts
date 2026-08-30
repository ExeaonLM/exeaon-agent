import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { SecretsService } from "#/api/secrets-service";
import { fetchAndCacheGitHubAccount } from "#/api/cloud/github-account-store";
import {
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_SCOPE,
  GITHUB_TOKEN_SECRET,
} from "#/constants/github-oauth";

export type DeviceFlowStatus =
  | "idle"
  | "starting"
  | "awaiting" // waiting for the user to approve on github.com/login/device
  | "success"
  | "error";

interface DeviceStartResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  // Some GitHub responses include the code pre-filled — open this when present
  // so the user doesn't have to type the code at all.
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

const DEVICE_VERIFICATION_URL = "https://github.com/login/device";

function openExternal(url: string): void {
  void invoke("open_external", { url }).catch(() => {
    // Best effort — the URL + code are shown in the modal for manual entry.
  });
}

interface DevicePollResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  interval?: number;
}

export interface GitHubDeviceFlow {
  status: DeviceFlowStatus;
  userCode: string | null;
  verificationUri: string | null;
  error: string | null;
  start: () => Promise<void>;
  /** Re-open the GitHub verification page in the OS browser (for the link). */
  openVerification: () => void;
  reset: () => void;
}

/**
 * Drives GitHub's OAuth Device Flow via the Rust commands `github_device_start`
 * / `github_device_poll` (run in Rust to dodge GitHub's missing CORS headers).
 * On approval, the access token is saved into `provider_tokens_set.github` so
 * the existing git-service can list/clone/push real repositories.
 */
export function useGitHubDeviceFlow(): GitHubDeviceFlow {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<DeviceFlowStatus>("idle");
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll bookkeeping lives in refs so the interval callback isn't recreated and
  // the loop survives re-renders; cancelled on unmount / reset.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  // The URL to launch (verification_uri_complete when present, else the plain
  // page). Held in a ref so `openVerification` stays a stable callback.
  const openUrlRef = useRef<string>(DEVICE_VERIFICATION_URL);

  const openVerification = useCallback(() => {
    openExternal(openUrlRef.current);
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    setStatus("idle");
    setUserCode(null);
    setVerificationUri(null);
    setError(null);
  }, []);

  useEffect(() => () => reset(), [reset]);

  const persistToken = useCallback(
    async (token: string) => {
      // Store as a Secret so the local runtime exposes it as $GITHUB_TOKEN for
      // the agent's git operations. (provider_tokens_set is cloud-only.)
      await SecretsService.createSecret(
        GITHUB_TOKEN_SECRET,
        token,
        "GitHub access token for Exeaon Claw (clone, branch, push, PRs).",
      );
      // Cache the account identity (name + avatar) for the connected-account
      // chip — the token is write-only afterward, so this is our only chance.
      await fetchAndCacheGitHubAccount(token);
      await queryClient.invalidateQueries({ queryKey: ["secrets"] });
    },
    [queryClient],
  );

  const start = useCallback(async () => {
    cancelledRef.current = false;
    clearTimer();
    setError(null);
    setStatus("starting");

    let device: DeviceStartResponse;
    try {
      device = await invoke<DeviceStartResponse>("github_device_start", {
        clientId: GITHUB_OAUTH_CLIENT_ID,
        scope: GITHUB_OAUTH_SCOPE,
      });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    if (device.error || !device.device_code || !device.user_code) {
      setStatus("error");
      setError(
        device.error_description ||
          device.error ||
          "GitHub did not return a device code.",
      );
      return;
    }

    setUserCode(device.user_code);
    setVerificationUri(device.verification_uri ?? DEVICE_VERIFICATION_URL);
    // Prefer the pre-filled URL (code embedded) for the actual browser launch.
    openUrlRef.current =
      device.verification_uri_complete ??
      device.verification_uri ??
      DEVICE_VERIFICATION_URL;
    setStatus("awaiting");

    // Open the verification page in the OS default browser via Rust (the
    // webview's window.open doesn't reliably launch it).
    openExternal(openUrlRef.current);

    const deviceCode = device.device_code;
    const deadline = Date.now() + (device.expires_in ?? 900) * 1000;
    let intervalMs = Math.max(device.interval ?? 5, 5) * 1000;

    const poll = async () => {
      if (cancelledRef.current) return;
      if (Date.now() > deadline) {
        setStatus("error");
        setError("The code expired before approval. Try connecting again.");
        return;
      }

      let result: DevicePollResponse;
      try {
        result = await invoke<DevicePollResponse>("github_device_poll", {
          clientId: GITHUB_OAUTH_CLIENT_ID,
          deviceCode,
        });
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
        return;
      }

      if (cancelledRef.current) return;

      if (result.access_token) {
        try {
          await persistToken(result.access_token);
          setStatus("success");
        } catch (e) {
          setStatus("error");
          setError(
            e instanceof Error
              ? `Connected, but saving the token failed: ${e.message}`
              : "Connected, but saving the token failed.",
          );
        }
        return;
      }

      switch (result.error) {
        case "authorization_pending":
          break; // keep waiting at the current cadence
        case "slow_down":
          // GitHub asks us to back off; honor its new interval (+5s default).
          intervalMs = Math.max(
            (result.interval ?? intervalMs / 1000 + 5) * 1000,
            intervalMs + 5000,
          );
          break;
        case "expired_token":
          setStatus("error");
          setError("The code expired before approval. Try connecting again.");
          return;
        case "access_denied":
          setStatus("error");
          setError("Authorization was denied on GitHub.");
          return;
        default:
          setStatus("error");
          setError(
            result.error_description ||
              result.error ||
              "GitHub authorization failed.",
          );
          return;
      }

      timerRef.current = setTimeout(poll, intervalMs);
    };

    timerRef.current = setTimeout(poll, intervalMs);
  }, [persistToken]);

  return {
    status,
    userCode,
    verificationUri,
    error,
    start,
    openVerification,
    reset,
  };
}
