/**
 * Cached GitHub account identity for the VSCode-style connected-account chip.
 *
 * The token itself is stored as a write-only Secret (the list API never returns
 * values), so we can't re-query GitHub after connect. Instead we fetch the
 * account once at connect time and cache it here — name, login, and the avatar
 * as a data URL so it renders on reload and fully offline.
 */
export interface GitHubAccount {
  login: string;
  name: string | null;
  /** Data URL (preferred, offline-safe) or a remote avatar URL fallback. */
  avatar: string | null;
}

const KEY = "exeaon-github-account";

export function readGitHubAccount(): GitHubAccount | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GitHubAccount) : null;
  } catch {
    return null;
  }
}

export function writeGitHubAccount(account: GitHubAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // Storage unavailable/full — the chip falls back to a generic label.
  }
}

export function clearGitHubAccount(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore — nothing to clear if storage is unavailable.
  }
}

/**
 * Fetch the authenticated GitHub user with `token` and cache it. Best effort:
 * on any failure the connection still stands (the chip just shows a generic
 * label until the next successful fetch). The avatar is inlined as a data URL
 * so it survives reloads and offline use.
 */
export async function fetchAndCacheGitHubAccount(token: string): Promise<void> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return;
    const user = (await res.json()) as {
      login: string;
      name: string | null;
      avatar_url?: string;
    };

    let avatar: string | null = user.avatar_url ?? null;
    if (user.avatar_url) {
      try {
        const imgRes = await fetch(`${user.avatar_url}&s=64`);
        const blob = await imgRes.blob();
        avatar = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve(
              typeof reader.result === "string"
                ? reader.result
                : (user.avatar_url ?? ""),
            );
          reader.readAsDataURL(blob);
        });
      } catch {
        avatar = user.avatar_url ?? null;
      }
    }

    writeGitHubAccount({ login: user.login, name: user.name ?? null, avatar });
  } catch {
    // Best effort — never block the connection on identity fetch.
  }
}
