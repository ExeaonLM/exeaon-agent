import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { GitRepository } from "#/types/git";
import { Provider } from "#/types/settings";
import { LocalWorkspace } from "#/types/workspace";

interface HomeState {
  recentRepositories: GitRepository[];
  // Local workspaces the user has recently launched from, most-recent first.
  // Powers the home workspace picker's "Recent" list and the default-to-last
  // behavior (a new chat pre-selects the most recent workspace, like Claude).
  recentWorkspaces: LocalWorkspace[];
  lastSelectedProvider: Provider | null;
}

interface HomeActions {
  addRecentRepository: (repository: GitRepository) => void;
  clearRecentRepositories: () => void;
  getRecentRepositories: () => GitRepository[];
  addRecentWorkspace: (workspace: LocalWorkspace) => void;
  clearRecentWorkspaces: () => void;
  setLastSelectedProvider: (provider: Provider | null) => void;
  getLastSelectedProvider: () => Provider | null;
}

type HomeStore = HomeState & HomeActions;

const initialState: HomeState = {
  recentRepositories: [],
  recentWorkspaces: [],
  lastSelectedProvider: null,
};

export const useHomeStore = create<HomeStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addRecentRepository: (repository: GitRepository) =>
        set((state) => {
          // Remove the repository if it already exists to avoid duplicates
          const filteredRepos = state.recentRepositories.filter(
            (repo) => repo.id !== repository.id,
          );

          // Add the new repository to the beginning and keep only top 3
          const updatedRepos = [repository, ...filteredRepos].slice(0, 3);

          return {
            recentRepositories: updatedRepos,
          };
        }),

      clearRecentRepositories: () =>
        set(() => ({
          recentRepositories: [],
        })),

      getRecentRepositories: () => get().recentRepositories,

      addRecentWorkspace: (workspace: LocalWorkspace) =>
        set((state) => {
          // Dedupe by path (the stable identity — ids can be regenerated when a
          // workspace is re-derived from a parent). Newest first, keep top 5.
          const filtered = state.recentWorkspaces.filter(
            (w) => w.path !== workspace.path,
          );
          return {
            recentWorkspaces: [workspace, ...filtered].slice(0, 5),
          };
        }),

      clearRecentWorkspaces: () =>
        set(() => ({
          recentWorkspaces: [],
        })),

      setLastSelectedProvider: (provider: Provider | null) =>
        set(() => ({
          lastSelectedProvider: provider,
        })),

      getLastSelectedProvider: () => get().lastSelectedProvider,
    }),
    {
      name: "home-store", // unique name for localStorage
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
