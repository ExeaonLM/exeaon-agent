import React from "react";

/**
 * Speech-to-text via the browser's Web Speech API (Voice v1). Zero deps. The
 * `SpeechRecognition` / `webkitSpeechRecognition` globals aren't in the standard
 * DOM lib types, so we access them through a minimal local shape rather than
 * `any`. `onFinal` fires with each finalized transcript chunk — the caller
 * decides where the text goes (e.g. append into the composer).
 */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface SpeechToText {
  supported: boolean;
  listening: boolean;
  toggle: () => void;
  stop: () => void;
}

export function useSpeechToText(onFinal: (text: string) => void): SpeechToText {
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = React.useRef(onFinal);
  React.useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const supported = React.useMemo(() => getCtor() !== null, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = React.useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      const trimmed = finalText.trim();
      if (trimmed) onFinalRef.current(trimmed);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, stop]);

  React.useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  return { supported, listening, toggle, stop };
}
