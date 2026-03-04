
/**
 * LEGACY SHIM — all exports delegate to authorizedCombatEngine.
 * Do not add logic here. This file exists only for backward-compat imports.
 */
export {
  calcAttackDamage,
  resolveCombatRound,
  initializeCooldowns,
  canUseAbility,
  tickCooldowns,
  applyCooldown,
  handleDeath,
  calcRewards,
  applyVictoryRewards,
  getLevelUpThreshold,
  autoResolveCombat,
  initiateCombat,
} from "./authorizedCombatEngine";
