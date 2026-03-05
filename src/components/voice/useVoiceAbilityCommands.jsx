import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseVoiceHotbarCommand } from "./voiceCommandParser";

export default function useVoiceAbilityCommands({ enabled = true, onVoiceAction }) {
  const recRef = useRef(null);
  const heldAltRef = useRef(false);
  const onVoiceActionRef = useRef(onVoiceAction);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastError, setLastError] = useState("");
  const [manualPrompt, setManualPrompt] = useState(false);
  const [manualInput, setManualInput] = useState("");

  onVoiceActionRef.current = onVoiceAction;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 2;
    rec.continuous = false;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setLastError(e?.error || "speech_error");
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(String(e?.error || ""))) {
        setManualPrompt(true);
      }
      setListening(false);
    };
    rec.onresult = (e) => {
      const text = e?.results?.[0]?.[0]?.transcript || "";
      setLastTranscript(text);
      const parsed = parseVoiceHotbarCommand(text);
      if (parsed) onVoiceActionRef.current?.(parsed);
      else setLastError(`Unrecognized command: "${text}"`);
    };

    recRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, []);

  const startListening = useCallback(() => {
    if (!enabled) return;
    if (supported && recRef.current) {
      try {
        setLastError("");
        recRef.current.start();
      } catch {
        // ignore repeated start calls
      }
    } else {
      setManualPrompt(true);
    }
  }, [enabled, supported]);

  const stopListening = useCallback(() => {
    if (supported && recRef.current) {
      try { recRef.current.stop(); } catch {}
    }
  }, [supported]);

  const submitManual = useCallback(() => {
    const parsed = parseVoiceHotbarCommand(manualInput);
    if (parsed) {
      onVoiceActionRef.current?.(parsed);
      setLastTranscript(manualInput);
      setLastError("");
      setManualInput("");
      setManualPrompt(false);
      return true;
    }
    setLastError(`Unrecognized command: "${manualInput}"`);
    return false;
  }, [manualInput]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!enabled) return;
      if (e.key !== "Alt") return;
      if (heldAltRef.current) return;
      heldAltRef.current = true;
      startListening();
    };
    const onKeyUp = (e) => {
      if (e.key !== "Alt") return;
      heldAltRef.current = false;
      stopListening();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, startListening, stopListening]);

  return useMemo(() => ({
    supported,
    listening,
    lastTranscript,
    lastError,
    manualPrompt,
    manualInput,
    setManualInput,
    setManualPrompt,
    submitManual,
  }), [supported, listening, lastTranscript, lastError, manualPrompt, manualInput, submitManual]);
}
