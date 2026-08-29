import React from "react";
import {
  cloudLogin,
  cloudRegister,
  type CloudSession,
} from "#/api/cloud/exeaon-auth.api";
import {
  readStoredBackends,
  writeStoredBackends,
  writeStoredActiveBackend,
} from "#/api/backend-registry/storage";
import type { Backend } from "#/api/backend-registry/types";

// The production Exeaon Cloud gateway. Editable for self-hosters and dev.
const DEFAULT_CLOUD_HOST = "https://exeaon-claw.fly.dev";

/**
 * In-app sign in / sign up for Exeaon Cloud.
 *
 * The user enters email and password (and a name to sign up) and never sees a
 * token: on success we take the session token the gateway returns, store it as
 * a cloud backend's bearer credential, make that backend active, and hand the
 * session up. No web detour, no copy-pasted API key.
 */
export function ExeaonCloudLogin({
  onSignedIn,
  defaultHost = DEFAULT_CLOUD_HOST,
}: {
  onSignedIn?: (session: CloudSession) => void;
  defaultHost?: string;
}) {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [host, setHost] = React.useState(defaultHost);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const persistSession = (session: CloudSession) => {
    const backend: Backend = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `cloud-${Date.now()}`,
      name: "Exeaon Cloud",
      host: host.replace(/\/+$/, ""),
      apiKey: session.token, // bearer, invisible to the user
      kind: "cloud",
      authMode: "api-key",
      connectionRevision: Date.now(),
    };
    // Replace any prior Exeaon Cloud entry for the same host so re-login does
    // not pile up duplicates; keep other backends untouched.
    const others = readStoredBackends().filter(
      (b) => !(b.kind === "cloud" && b.host === backend.host),
    );
    writeStoredBackends([...others, backend]);
    writeStoredActiveBackend({ backendId: backend.id, orgId: null });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your name to create an account.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session =
        mode === "login"
          ? await cloudLogin(host, email.trim(), password)
          : await cloudRegister(host, name.trim(), email.trim(), password);
      persistSession(session);
      onSignedIn?.(session);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { msg?: string } }; message?: string })
          ?.response?.data?.msg ||
        (err as { message?: string })?.message ||
        "Sign in failed. Check your details and try again.";
      setError(String(msg));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[var(--oh-border)] bg-[var(--oh-bg-input,#201D15)] px-3 py-2 text-sm text-[var(--oh-fg)] outline-none focus:border-[#F3CE49]";

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div>
        <h1 className="text-lg font-semibold text-[var(--oh-fg)]">
          {mode === "login" ? "Sign in to Exeaon" : "Create your Exeaon account"}
        </h1>
        <p className="mt-1 text-sm text-[var(--oh-muted)]">
          {mode === "login"
            ? "Use your Exeaon account. Works on the desktop app and the web."
            : "One account for the app and the web."}
        </p>
      </div>

      {mode === "signup" && (
        <input
          className={inputClass}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      )}
      <input
        className={inputClass}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        className={inputClass}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
      />

      {error && (
        <div className="text-sm text-red-400" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-[#F3CE49] px-3 py-2 text-sm font-semibold text-[#070605] hover:bg-[#F7DA6B] disabled:opacity-50"
      >
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>

      <button
        type="button"
        className="text-sm text-[var(--oh-muted)] hover:text-[var(--oh-fg)]"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
        }}
      >
        {mode === "login"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>

      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-[var(--oh-muted)]">
          Advanced: gateway host
        </summary>
        <input
          className={`${inputClass} mt-2`}
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="https://exeaon-claw.fly.dev"
        />
      </details>
    </form>
  );
}

export default ExeaonCloudLogin;
