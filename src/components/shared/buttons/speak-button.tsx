import React from "react";
import { Volume2, Square } from "lucide-react";
import { StyledTooltip } from "./styled-tooltip";
import { cn } from "#/utils/utils";

/**
 * Read-aloud (TTS) toggle for an agent message — Voice v1. Uses the browser's
 * native `speechSynthesis` (zero deps, works offline). Click to speak the given
 * text; click again (or start another message) to stop. Renders nothing where
 * the Web Speech API is unavailable.
 */
export function SpeakButton({
  text,
  isHidden,
}: {
  text: string;
  isHidden?: boolean;
}) {
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const utterOK =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  // Stop any in-flight speech if this message unmounts.
  React.useEffect(
    () => () => {
      if (utterOK && isSpeaking) window.speechSynthesis.cancel();
    },
    [utterOK, isSpeaking],
  );

  if (!utterOK || !text.trim()) return null;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    // Cancel anything else already reading, then speak this message.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <StyledTooltip content={isSpeaking ? "Stop" : "Read aloud"} placement="top">
      <button
        type="button"
        onClick={handleClick}
        aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
        className={cn(
          "button-base p-1 cursor-pointer",
          isHidden && "hidden",
          isSpeaking && "text-[#FFD026]",
        )}
      >
        {isSpeaking ? (
          <Square className="size-4" />
        ) : (
          <Volume2 className="size-4" />
        )}
      </button>
    </StyledTooltip>
  );
}
