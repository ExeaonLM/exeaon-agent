import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, ChevronLeft, HardDrive, Star, FolderPlus, Check } from "lucide-react";
import { ModalBackdrop } from "#/components/shared/modals/modal-backdrop";
import { ModalCloseButton } from "#/components/shared/modals/modal-close-button";
import {
  MODAL_MAX_WIDTH_VIEWPORT,
  modalWidthClassName,
} from "#/components/shared/modals/modal-body";
import { I18nKey } from "#/i18n/declaration";
import { LocalWorkspace, LocalWorkspaceParent } from "#/types/workspace";
import {
  type HomeDirectoryResponse,
  useHomeDirectory,
  useSearchSubdirs,
} from "#/hooks/query/use-search-subdirs";
import { useActiveBackend } from "#/contexts/active-backend-context";
import { cn } from "#/utils/utils";

const PROJECTS_PATH = "/projects";

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (items: LocalWorkspace[]) => void;
  onAddParent?: (items: LocalWorkspaceParent[]) => void;
}

interface SidebarEntry {
  label: string;
  path: string;
}

interface SidebarSectionProps {
  label: string;
  icon?: React.ReactNode;
  entries: SidebarEntry[];
  currentPath: string | null;
  onPick: (path: string) => void;
}

function SidebarSection({
  label,
  icon,
  entries,
  currentPath,
  onPick,
}: SidebarSectionProps) {
  if (entries.length === 0) return null;
  return (
    <div className="px-3 pb-4">
      <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[10px] uppercase tracking-wider text-[#8C8370] font-bold">
        {icon}
        {label}
      </div>
      <ul className="space-y-0.5">
        {entries.map((entry) => {
          const isActive = currentPath === entry.path;
          return (
            <li key={entry.path}>
              <button
                type="button"
                onClick={() => onPick(entry.path)}
                data-testid={`folder-browser-sidebar-${entry.label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs transition-all duration-100 cursor-pointer text-left truncate",
                  isActive
                    ? "bg-[#241F14] text-[#FFD026] font-semibold border border-[#FFD026]/30 shadow-sm shadow-[#FFD026]/10"
                    : "text-[#B8AF9E] hover:bg-[#1C1811] hover:text-[#EDE7D8] border border-transparent",
                )}
              >
                <Folder className={cn("size-3.5 shrink-0", isActive ? "text-[#FFD026]" : "text-[#8C8370]")} />
                <span className="truncate">{entry.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getParentPath(path: string): string | null {
  const trimmed = trimTrailingSeparators(path);
  if (!trimmed || trimmed === "/" || isWindowsDriveRoot(trimmed)) return null;

  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (idx < 0) return null;
  if (idx === 0) return "/";

  const parent = trimmed.slice(0, idx);
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}${trimmed[idx]}`;
  }

  return parent;
}

function isWindowsDriveRoot(path: string): boolean {
  return /^[A-Za-z]:[\\/]?$/.test(path);
}

function trimTrailingSeparators(path: string): string {
  if (isWindowsDriveRoot(path)) {
    return path;
  }
  return path.replace(/[/\\]+$/, "");
}

export function FolderBrowserModal({
  isOpen,
  onClose,
  onAdd,
  onAddParent,
}: FolderBrowserModalProps) {
  const { t } = useTranslation("openhands");
  const { backend } = useActiveBackend();
  const isHostWorkspace = backend.kind === "local";

  const { data: homeData } = useHomeDirectory();

  const defaultPath = useMemo(() => {
    if (homeData?.home) return homeData.home;
    if (homeData?.locations && homeData.locations.length > 0) return homeData.locations[0].path;
    return isHostWorkspace ? "/" : PROJECTS_PATH;
  }, [homeData, isHostWorkspace]);

  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (homeData?.home && (currentPath === null || currentPath === PROJECTS_PATH)) {
        setCurrentPath(homeData.home);
      } else if (currentPath === null && defaultPath) {
        setCurrentPath(defaultPath);
      }
    }
  }, [isOpen, defaultPath, homeData?.home, currentPath]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPath(null);
    }
  }, [isOpen]);

  const {
    data: subdirsData,
    isLoading,
    isError,
    error,
  } = useSearchSubdirs(currentPath);

  const subdirs = useMemo(() => {
    if (!subdirsData) return [];
    if (Array.isArray(subdirsData)) return subdirsData;
    if (Array.isArray((subdirsData as any).items)) return (subdirsData as any).items;
    return [];
  }, [subdirsData]);

  const favorites = useMemo<SidebarEntry[]>(() => {
    if (homeData?.favorites && homeData.favorites.length > 0) {
      return homeData.favorites;
    }
    const list: SidebarEntry[] = [];
    if (homeData?.home) {
      list.push({ label: "Home", path: homeData.home });
    }
    return list;
  }, [homeData]);

  const locations = useMemo<SidebarEntry[]>(() => {
    if (homeData?.locations && homeData.locations.length > 0) {
      return homeData.locations;
    }
    const list: SidebarEntry[] = [];
    if (!isHostWorkspace) {
      list.push({ label: "projects", path: PROJECTS_PATH });
    }
    return list;
  }, [homeData, isHostWorkspace]);

  if (!isOpen) return null;

  const parent = currentPath ? getParentPath(currentPath) : null;
  const isAtProjectsRoot = !isHostWorkspace && currentPath === PROJECTS_PATH;
  const showHostHomeHint = isAtProjectsRoot && subdirs.length === 0;

  const getBasename = (path: string): string => {
    const trimmed = trimTrailingSeparators(path);
    const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
    return idx >= 0 ? trimmed.slice(idx + 1) || trimmed : trimmed;
  };

  const handleAddDirectory = () => {
    if (!currentPath) return;
    const item: LocalWorkspace = {
      id: currentPath,
      name: getBasename(currentPath),
      path: currentPath,
    };
    onAdd([item]);
    onClose();
  };

  const handleAddAllSubdirectories = () => {
    if (!currentPath || !onAddParent) return;
    onAddParent([
      {
        id: currentPath,
        name: getBasename(currentPath),
        path: currentPath,
      },
    ]);
    onClose();
  };

  return (
    <ModalBackdrop
      onClose={onClose}
      aria-label={t(I18nKey.HOME$ADD_WORKSPACES_TITLE)}
    >
      <div
        data-testid="folder-browser-modal"
        className={cn(
          "flex flex-col bg-[#0D0B08] text-[#EDE7D8] border border-[#2B2316] rounded-2xl shadow-2xl overflow-hidden",
          modalWidthClassName("xl"),
          MODAL_MAX_WIDTH_VIEWPORT,
          "h-[520px] max-h-[90vh]",
          "animate-in fade-in zoom-in-95 duration-150 select-none",
        )}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#241F16] bg-[#14110C] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-[#241F14] border border-[#FFD026]/40 text-[#FFD026] shadow-sm shadow-[#FFD026]/10">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">
                {t(I18nKey.HOME$ADD_WORKSPACES_TITLE)}
              </h2>
              <p className="text-[11px] text-[#8C8370]">
                Select local directory to attach as workspace
              </p>
            </div>
          </div>
          <ModalCloseButton onClose={onClose} />
        </div>

        {/* Body: sidebar + main */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside
            data-testid="folder-browser-sidebar"
            className="w-[200px] shrink-0 border-r border-[#241F16] bg-[#100E0A] py-3.5 overflow-y-auto custom-scrollbar"
          >
            <SidebarSection
              label={t(I18nKey.HOME$FAVORITES)}
              icon={<Star className="size-3 text-[#FFD026]" />}
              entries={favorites}
              currentPath={currentPath}
              onPick={setCurrentPath}
            />
            <SidebarSection
              label={t(I18nKey.HOME$LOCATIONS)}
              icon={<HardDrive className="size-3 text-[#3880F6]" />}
              entries={locations}
              currentPath={currentPath}
              onPick={setCurrentPath}
            />
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0D0B08]">
            {/* Nav row / Breadcrumb */}
            <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-[#241F16] bg-[#13100B]">
              <button
                type="button"
                data-testid="folder-browser-up"
                onClick={() => parent && setCurrentPath(parent)}
                disabled={!parent}
                aria-label={t(I18nKey.COMMON$UP)}
                className="flex size-7 items-center justify-center rounded-lg border border-[#2B2316] bg-[#18140E] text-[#EDE7D8] hover:border-[#FFD026]/40 hover:bg-[#241F14] hover:text-[#FFD026] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div
                className="flex-1 min-w-0 font-mono text-xs text-[#A89F8D] bg-[#0A0907] px-3 py-1.5 rounded-lg border border-[#201B12] truncate"
                data-testid="folder-browser-current-path"
              >
                {currentPath ?? ""}
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_100px] px-5 py-2 border-b border-[#241F16] bg-[#110F0A] text-[10px] text-[#8C8370] font-bold uppercase tracking-wider">
              <span>{t(I18nKey.HOME$NAME)}</span>
              <span>{t(I18nKey.HOME$KIND)}</span>
            </div>

            {/* Folder List */}
            <ul
              className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#1A1610]/40"
              data-testid="folder-browser-list"
            >
              {isLoading && (
                <li className="px-5 py-6 text-center text-xs text-[#8C8370]">
                  <span className="inline-block size-4 border-2 border-[#FFD026] border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                  {t(I18nKey.HOME$LOADING)}
                </li>
              )}
              {isError && (
                <li
                  className="px-5 py-4 text-xs text-red-400 bg-red-950/20"
                  data-testid="folder-browser-error"
                >
                  {(error as Error | undefined)?.message ??
                    t(I18nKey.COMMON$FAILED_TO_LOAD)}
                </li>
              )}
              {!isLoading && !isError && subdirs.length === 0 && (
                <li
                  className="px-5 py-8 text-center text-xs text-[#8C8370]"
                  data-testid={
                    showHostHomeHint
                      ? "folder-browser-host-home-hint"
                      : "folder-browser-empty"
                  }
                >
                  {showHostHomeHint
                    ? t(I18nKey.HOME$HOST_HOME_NOT_MOUNTED_HINT)
                    : t(I18nKey.HOME$NO_WORKSPACES)}
                </li>
              )}
              {subdirs.map((entry: { name: string; path: string }) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => setCurrentPath(entry.path)}
                    className="grid grid-cols-[1fr_100px] items-center w-full text-left px-5 py-2 text-xs text-[#EDE7D8] hover:bg-[#1A1610] hover:text-[#FFF4B8] transition-colors cursor-pointer group"
                    data-testid={`folder-browser-entry-${entry.name}`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Folder className="size-4 shrink-0 text-[#FFD026] group-hover:scale-110 transition-transform" />
                      <span className="truncate font-medium">{entry.name}</span>
                    </span>
                    <span className="text-[#736A58] group-hover:text-[#A89F8D] font-mono text-[11px]">
                      {t(I18nKey.HOME$FOLDER)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[#241F16] bg-[#14110C]">
          <button
            type="button"
            onClick={onClose}
            data-testid="folder-browser-cancel"
            className="px-4 py-2 rounded-xl text-xs font-medium border border-[#2E281F] bg-[#18140E] text-[#B8AF9E] hover:border-[#FFD026]/40 hover:bg-[#201C15] hover:text-[#EDE7D8] transition-all cursor-pointer"
          >
            {t(I18nKey.HOME$CANCEL)}
          </button>
          {onAddParent && (
            <button
              type="button"
              onClick={handleAddAllSubdirectories}
              disabled={!currentPath || isLoading}
              data-testid="folder-browser-add-all-subdirs"
              className="px-4 py-2 rounded-xl text-xs font-medium border border-[#2E281F] bg-[#18140E] text-[#EDE7D8] hover:border-[#FFD026]/40 hover:bg-[#201C15] hover:text-[#FFF4B8] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {t(I18nKey.HOME$ADD_ALL_SUBDIRECTORIES)}
            </button>
          )}
          <button
            type="button"
            onClick={handleAddDirectory}
            disabled={!currentPath || isLoading}
            data-testid="folder-browser-use"
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#FFD026] text-black hover:bg-[#FFE066] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-[#FFD026]/20 cursor-pointer"
          >
            {t(I18nKey.HOME$ADD_THIS_DIRECTORY)}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
