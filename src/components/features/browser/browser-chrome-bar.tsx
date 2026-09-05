import { useEffect, useState } from "react";
import { ExternalLink, ArrowRight, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { openExternalUrl } from "#/utils/open-external-url";
import { useBrowserStore } from "#/stores/browser-store";
import { cn } from "#/utils/utils";

type BrowserChromeBarProps = {
  url: string;
  hasPage: boolean;
};

/**
 * The browser panel's chrome: an editable URL bar the user can type into. The
 * in-panel view is the agent's headless-browser screenshot, so navigation opens
 * the typed URL in the OS browser (via the Tauri `open_external` command) — the
 * pragmatic "user-drivable" browser until a live embedded webview lands.
 */
export function BrowserChromeBar({ url, hasPage }: BrowserChromeBarProps) {
  const { t } = useTranslation("openhands");
  const setUrl = useBrowserStore((s) => s.setUrl);
  const [draft, setDraft] = useState(url);

  // Keep the input in sync when the agent navigates the browser elsewhere,
  // unless the user is mid-edit (draft already differs).
  useEffect(() => {
    setDraft(url);
  }, [url]);

  const normalize = (value: string): string => {
    const v = value.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (
      /^localhost(:\d+)?(\/|$)/i.test(v) ||
      /^\d{1,3}(\.\d{1,3}){3}/.test(v)
    ) {
      return `http://${v}`;
    }
    return `https://${v}`;
  };

  const go = () => {
    const target = normalize(draft);
    if (!target) return;
    setUrl(target);
    openExternalUrl(target);
  };

  const iconBtn = cn(
    "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md",
    "text-[var(--oh-text-tertiary)] hover:bg-[var(--oh-surface-raised)] cursor-pointer",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  );
  const iconClassName = "w-3.5 h-3.5";

  return (
    <div
      className="flex w-full min-h-[34px] shrink-0 items-center gap-1 border-b border-[var(--oh-border)] px-2 py-1.5"
      data-testid="browser-chrome-bar"
    >
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
        }}
        spellCheck={false}
        placeholder={t(I18nKey.BROWSER$URL_PLACEHOLDER)}
        data-testid="browser-chrome-url"
        title={draft || undefined}
        className={cn(
          "min-h-7 min-w-0 flex-1 rounded-md border border-[var(--oh-border)]",
          "bg-[var(--oh-surface-raised)] px-2 text-xs leading-5 text-[var(--oh-fg)]",
          "outline-none focus:border-[#F3CE49]/50 placeholder:text-[var(--oh-text-dim)]",
        )}
      />

      <button
        type="button"
        onClick={go}
        disabled={!draft.trim()}
        aria-label={t(I18nKey.BROWSER$URL_PLACEHOLDER)}
        title="Go"
        className={iconBtn}
      >
        <ArrowRight className={iconClassName} aria-hidden strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => hasPage && url && openExternalUrl(url)}
        disabled={!hasPage || !url}
        aria-label={t(I18nKey.BUTTON$OPEN_IN_NEW_TAB)}
        title={t(I18nKey.BUTTON$OPEN_IN_NEW_TAB)}
        data-testid="browser-chrome-open-external"
        className={iconBtn}
      >
        <ExternalLink className={iconClassName} aria-hidden strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => url && openExternalUrl(url)}
        disabled={!url}
        aria-label="Reopen"
        title="Reopen in browser"
        className={iconBtn}
      >
        <RotateCw className={iconClassName} aria-hidden strokeWidth={2} />
      </button>
    </div>
  );
}
