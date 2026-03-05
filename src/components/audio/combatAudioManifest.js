import swingSfx from "@/assets/audio/combat/swing.wav";
import monsterSwingSfx from "@/assets/audio/combat/monster_swing.wav";
import impactSfx from "@/assets/audio/combat/impact.wav";
import castWindupSfx from "@/assets/audio/combat/cast_windup.wav";
import hurtSfx from "@/assets/audio/combat/hurt.wav";
import deathSfx from "@/assets/audio/combat/death.wav";
import cooldownReadySfx from "@/assets/audio/combat/cooldown_ready.wav";
import uiErrorSfx from "@/assets/audio/combat/ui_error.wav";

/**
 * CombatAudioManifestEntry
 * eventType -> clips/sourceClips + mix defaults.
 */
export const COMBAT_AUDIO_MANIFEST = {
  intent: {
    eventType: "intent",
    category: "weapon",
    volume: 0.44,
    cooldownMs: 85,
    sourceClips: {
      player: [swingSfx],
      monster: [monsterSwingSfx],
      system: [swingSfx],
    },
  },
  cast_start: {
    eventType: "cast_start",
    category: "cast",
    volume: 0.48,
    cooldownMs: 120,
    clips: [castWindupSfx],
  },
  hit: {
    eventType: "hit",
    category: "impact",
    volume: 0.62,
    cooldownMs: 80,
    clips: [impactSfx],
  },
  hurt: {
    eventType: "hurt",
    category: "hurt",
    volume: 0.55,
    cooldownMs: 95,
    clips: [hurtSfx],
  },
  death: {
    eventType: "death",
    category: "death",
    volume: 0.75,
    cooldownMs: 320,
    clips: [deathSfx],
  },
  cooldown_ready: {
    eventType: "cooldown_ready",
    category: "ui",
    volume: 0.50,
    cooldownMs: 260,
    clips: [cooldownReadySfx],
  },
  range_fail: {
    eventType: "range_fail",
    category: "ui",
    volume: 0.45,
    cooldownMs: 140,
    clips: [uiErrorSfx],
  },
};

export function resolveCombatAudioEntry(event) {
  const type = String(event?.type || "");
  if (type === "miss" && String(event?.payload?.reason || "") === "cooldown") {
    return COMBAT_AUDIO_MANIFEST.range_fail;
  }
  return COMBAT_AUDIO_MANIFEST[type] || null;
}

