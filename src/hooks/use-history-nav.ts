import * as React from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";

/**
 * Browser-style back/forward navigation state for the sidebar controls.
 *
 * Correctness (why not just navigate(-1)/(+1) blindly): React Router stores a
 * monotonic `idx` in `window.history.state`. `canBack` is simply `idx > 0`.
 * For `canForward` we remember the furthest index reached this session and
 * only enable forward while the current index is behind it — a fresh PUSH
 * discards any forward entries, so we reset the ceiling to the new index then.
 * We distinguish a PUSH/REPLACE from a POP via `useNavigationType()`.
 *
 * This drives navigation through the router (`navigate(±1)`), so every route's
 * guards/loaders re-run on arrival — back/forward can't bypass an auth gate or
 * re-enter a closed/blocked route; it only replays the same routing the browser
 * would, within the app.
 */
export function useHistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const ceilingRef = React.useRef(0);
  const [, force] = React.useState(0);

  const currentIdx =
    typeof window !== "undefined"
      ? ((window.history.state?.idx as number | undefined) ?? 0)
      : 0;

  React.useEffect(() => {
    if (navType === "POP") {
      if (currentIdx > ceilingRef.current) ceilingRef.current = currentIdx;
    } else {
      // PUSH or REPLACE: forward history (if any) is discarded.
      ceilingRef.current = currentIdx;
    }
    force((n) => n + 1);
    // location.key changes on every navigation; currentIdx/navType are derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const canBack = currentIdx > 0;
  const canForward = currentIdx < ceilingRef.current;

  return {
    canBack,
    canForward,
    goBack: React.useCallback(() => {
      if (currentIdx > 0) navigate(-1);
    }, [currentIdx, navigate]),
    goForward: React.useCallback(() => {
      if (currentIdx < ceilingRef.current) navigate(1);
    }, [currentIdx, navigate]),
  };
}
