/**
 * COMBAT MODE AUTHORITY
 *
 * Tracks and transitions the client's combat mode state.
 * Combat mode is an explicit, visible gameplay state — not implicit.
 *
 * States:
 *   PEACEFUL  — no target, no combat
 *   TARGETED  — entity selected, not yet engaged
 *   ENGAGED   — actively in combat (combat overlay open)
 *   PVP_PREP  — targeting a player in frontier (pre-engagement warning)
 *
 * This is a pure state machine — no React hooks. Import into hooks/pages.
 */

export const COMBAT_MODE = {
  PEACEFUL: "peaceful",
  TARGETED: "targeted",
  ENGAGED:  "engaged",
  PVP_PREP: "pvp_prep",
};

/**
 * Compute the new combat mode given context.
 */
export function computeCombatMode(current, { hasTarget, targetIsHostile, inCombat, targetIsPlayer, inSafeZone }) {
  if (inCombat) return COMBAT_MODE.ENGAGED;
  if (!hasTarget) return COMBAT_MODE.PEACEFUL;
  if (targetIsPlayer && !inSafeZone) return COMBAT_MODE.PVP_PREP;
  if (targetIsHostile) return COMBAT_MODE.TARGETED;
  return COMBAT_MODE.TARGETED;
}

export const COMBAT_MODE_UI = {
  [COMBAT_MODE.PEACEFUL]: {
    label: "",
    color: "text-gray-500",
    border: "border-gray-700",
    bg: "",
    indicator: null,
  },
  [COMBAT_MODE.TARGETED]: {
    label: "Target Locked",
    color: "text-amber-400",
    border: "border-amber-700",
    bg: "bg-amber-900/10",
    indicator: "🎯",
  },
  [COMBAT_MODE.ENGAGED]: {
    label: "IN COMBAT",
    color: "text-red-400",
    border: "border-red-700",
    bg: "bg-red-900/20",
    indicator: "⚔️",
    pulse: true,
  },
  [COMBAT_MODE.PVP_PREP]: {
    label: "PvP Target",
    color: "text-orange-400",
    border: "border-orange-600",
    bg: "bg-orange-900/15",
    indicator: "⚠️",
    pulse: false,
  },
};