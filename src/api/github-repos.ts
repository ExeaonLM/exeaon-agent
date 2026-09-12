import { SettingsClient } from "@openhands/typescript-client/clients";
import { getAgentServerClientOptions } from "./agent-server-client-options";
import { GITHUB_TOKEN_SECRET } from "#/constants/github-oauth";

export interface GitHubRepo {
  /** "owner/name" */
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
}

export interface GitHubBranch {
  name: string;
}

/**
 * Read the connected GitHub token back from the local agent-server's Secret
 * store. Secrets are write-only in the UI list, but the value can be fetched by
 * name — which is how the repo picker calls the GitHub API on the user's behalf.
 */
async function getGitHubToken(): Promise<string> {
  const value = await new SettingsClient(
    getAgentServerClientOptions(),
  ).getSecret(GITHUB_TOKEN_SECRET);
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) {
    throw new Error(
      "GitHub isn't connected. Connect it first, then try again.",
    );
  }
  return token;
}

async function githubApi<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const detail = res.status === 401 ? " (token expired or revoked)" : "";
    throw new Error(`GitHub API ${res.status}${detail}`);
  }
  return (await res.json()) as T;
}

/**
 * List the user's repositories, most-recently-updated first (owned, member, and
 * collaborator). One page of 100 covers the common case; the picker filters
 * client-side.
 */
export async function listGitHubRepos(): Promise<GitHubRepo[]> {
  const token = await getGitHubToken();
  const raw = await githubApi<
    Array<{
      full_name: string;
      private: boolean;
      default_branch: string;
      description: string | null;
    }>
  >(
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    token,
  );
  return raw.map((r) => ({
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    description: r.description,
  }));
}

/** List a repository's branches (default branch first when present). */
export async function listGitHubBranches(
  fullName: string,
): Promise<GitHubBranch[]> {
  const token = await getGitHubToken();
  const raw = await githubApi<Array<{ name: string }>>(
    `/repos/${fullName}/branches?per_page=100`,
    token,
  );
  return raw.map((b) => ({ name: b.name }));
}
