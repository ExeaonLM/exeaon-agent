export const CORS_OR_NETWORK_ERROR_MESSAGE =
  "Disconnected (check URL or network). Check that the backend URL is correct and the backend server is reachable. If the backend is on another origin, check that it allows this frontend origin.";

export const BACKEND_REQUEST_TIMEOUT_MESSAGE =
  "Disconnected (request timed out). Check that the backend URL is correct and reachable.";

const MAX_CAUSE_DEPTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current !== undefined && current !== null && depth < MAX_CAUSE_DEPTH) {
    if (seen.has(current)) break;
    seen.add(current);

    if (current instanceof Error) {
      if (current.message) messages.push(current.message);
      current = current.cause;
    } else if (typeof current === "string") {
      if (current) messages.push(current);
      break;
    } else if (isRecord(current)) {
      const message = current.message;
      if (typeof message === "string" && message) messages.push(message);
      current = current.cause;
    } else {
      break;
    }

    depth += 1;
  }

  return messages;
}

export function getRawErrorMessage(error: unknown): string | null {
  return collectErrorMessages(error)[0] ?? null;
}

export function isCorsOrNetworkErrorMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();

  return (
    normalized.includes("disconnected (check cors or network)") ||
    normalized.includes("disconnected (check url or network)") ||
    normalized.includes("blocked by cors") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror when attempting to fetch resource") ||
    (normalized.includes("cors") && normalized.includes("blocked"))
  );
}

export function isCorsOrNetworkError(error: unknown): boolean {
  return collectErrorMessages(error).some(isCorsOrNetworkErrorMessage);
}

export function isBackendRequestTimeoutMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("request timeout") ||
    normalized.includes("timeout after") ||
    normalized.includes("backend request timed out")
  );
}

export const SERVER_DOWN_ERROR_MESSAGE =
  "Exeaon Server is currently offline. Please restart the application.";

export function isServerDownErrorMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("econnrefused") ||
    normalized.includes("502 bad gateway") ||
    normalized.includes("bad gateway") ||
    normalized.includes("127.0.0.1:18000") ||
    normalized.includes("connect econnrefused")
  );
}

export function getUserFacingConnectionErrorMessage(
  error: unknown,
): string | null {
  const messages = collectErrorMessages(error);
  if (messages.some(isServerDownErrorMessage)) {
    return SERVER_DOWN_ERROR_MESSAGE;
  }
  if (messages.some(isCorsOrNetworkErrorMessage)) {
    return CORS_OR_NETWORK_ERROR_MESSAGE;
  }
  if (messages.some(isBackendRequestTimeoutMessage)) {
    return BACKEND_REQUEST_TIMEOUT_MESSAGE;
  }
export function sanitizeLlmErrorMessage(
  message: string | null | undefined,
): string {
  if (!message) return "An unexpected error occurred. Please try again.";
  const normalized = message.toLowerCase();

  // 1. Connection / Unreachable / Offline / LiteLLM tracebacks
  if (
    normalized.includes("litellm.internalservererror") ||
    normalized.includes("litellm.apiconnectionerror") ||
    normalized.includes("litellm.openaiexception") ||
    normalized.includes("litellm.timeouterror") ||
    normalized.includes("litellm") ||
    normalized.includes("openai.apiconnectionerror") ||
    normalized.includes("connection error") ||
    normalized.includes("failed to connect") ||
    normalized.includes("enotfound") ||
    normalized.includes("network error") ||
    normalized.includes("peer closed connection") ||
    normalized.includes("server disconnected") ||
    normalized.includes("remote end closed connection") ||
    normalized.includes("econnreset")
  ) {
    return "Exeaon Sovereign Network — Inference server unreachable. Please verify your internet connection or check that the inference endpoint is active.";
  }

  // 2. Timeout
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "Exeaon Sovereign Network — Request timed out waiting for inference response. Please try again.";
  }

  // 3. Rate Limit / Quota
  if (
    normalized.includes("rate limit") ||
    normalized.includes("quota") ||
    normalized.includes("429")
  ) {
    return "Exeaon Sovereign Network — Inference capacity limit reached. Please wait a moment before sending your next request.";
  }

  // 4. Context Length
  if (
    normalized.includes("context length") ||
    normalized.includes("maximum context") ||
    normalized.includes("token limit")
  ) {
    return "Exeaon Sovereign Network — Context length limit reached for this conversation.";
  }

  // 5. Strip raw Python tracebacks
  if (
    normalized.includes("traceback (most recent call last)") ||
    normalized.includes("filenotfounderror")
  ) {
    return "Exeaon Sovereign Engine encountered an internal execution issue. Please try your request again.";
  }

  return message;
}

