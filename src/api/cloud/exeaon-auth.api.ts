import axios from "axios";

/**
 * Native email/password auth against an Exeaon Cloud gateway.
 *
 * The gateway returns a session `token` in the body (as well as a cookie). The
 * desktop app holds that token and sends it as a bearer -- cookies are
 * unreliable cross-site in a webview -- so the user only ever sees email and
 * password, never a token or an API key. This is the friction-free flow the
 * product wants: sign up and sign in *inside* the app, no web detour.
 */
export interface CloudSession {
  userId: number;
  email: string;
  displayName: string;
  isPlatformAdmin: boolean;
  token: string;
}

const AUTH_PATH = "/ai/gateway/auth";

function unwrap(payload: unknown): CloudSession {
  const body = payload as { data?: Record<string, unknown>; msg?: string } | undefined;
  const d = (body?.data ?? body) as Record<string, unknown> | undefined;
  const token = d?.token as string | undefined;
  if (!token) {
    throw new Error(
      body?.msg ? String(body.msg) : "The gateway did not return a session token.",
    );
  }
  return {
    userId: Number(d?.userId ?? 0),
    email: String(d?.email ?? ""),
    displayName: String(d?.displayName ?? ""),
    isPlatformAdmin: Boolean(d?.isPlatformAdmin),
    token,
  };
}

function base(host: string): string {
  return host.replace(/\/+$/, "");
}

export async function cloudLogin(
  host: string,
  email: string,
  password: string,
): Promise<CloudSession> {
  const res = await axios.post(
    `${base(host)}${AUTH_PATH}/login`,
    { email, password },
    { timeout: 15000, headers: { "Content-Type": "application/json" } },
  );
  return unwrap(res.data);
}

export async function cloudRegister(
  host: string,
  name: string,
  email: string,
  password: string,
): Promise<CloudSession> {
  const res = await axios.post(
    `${base(host)}${AUTH_PATH}/register`,
    { name, email, password },
    { timeout: 15000, headers: { "Content-Type": "application/json" } },
  );
  return unwrap(res.data);
}
