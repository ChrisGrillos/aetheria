export function parseVoiceHotbarCommand(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return null;

  const text = raw.toLowerCase();
  const direct = text.match(/\b(?:hotbar|slot|ability|spell|cast|use)\s*(?:ability|slot|spell)?\s*([1-9])\b/);
  if (direct) {
    return {
      action: "use_hotbar",
      slot: Number(direct[1]),
      confidence: 0.9,
      rawText: raw,
    };
  }

  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
  };

  for (const [word, slot] of Object.entries(words)) {
    if (new RegExp(`\\b(?:hotbar|slot|ability|spell|cast|use)\\b.*\\b${word}\\b`, "i").test(text)) {
      return {
        action: "use_hotbar",
        slot,
        confidence: 0.75,
        rawText: raw,
      };
    }
  }

  return null;
}
