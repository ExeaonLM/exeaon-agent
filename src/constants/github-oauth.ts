/**
 * GitHub OAuth App client id for Exeaon Claw's "Connect GitHub" (Device Flow).
 *
 * This is a PUBLIC value — Device Flow uses no client secret, so baking the
 * client id into the desktop app is expected and safe (this is how the `gh` CLI
 * and VS Code ship). The per-user access token is obtained at runtime via the
 * device flow and stored in the app's provider settings, never here.
 */
export const GITHUB_OAUTH_CLIENT_ID = "Ov23ctxxjymJg6lSdnQU";

/**
 * Scopes requested for the token. `repo` covers private + public repo read/write
 * (clone, branch, push, PRs); `read:user` lets us show who is connected.
 */
export const GITHUB_OAUTH_SCOPE = "repo read:user";

/**
 * Name of the secret the GitHub token is stored under on the local agent-server.
 * `provider_tokens_set` is a cloud-only field the local engine never populates,
 * so on Exeaon (local runtime) the token lives as a Secret — exposed to the
 * runtime as `$GITHUB_TOKEN` for the agent's git clone/push/PR commands. The
 * connected state is derived from this secret's presence.
 */
export const GITHUB_TOKEN_SECRET = "GITHUB_TOKEN";
