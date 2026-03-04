/**
 * LEGACY SHIM — pure combat math functions and backward-compat re-exports.
 */

// Re-export authority/validation functions
export {
  canUseAbility,
  tickCooldowns,
  handleDeath,
  initiateCombat,
} from "./authorizedCombatEngine";

// Stub pure math exports (used by CombatOverlay)
// In production, these should be implemented here or imported from a dedicated math module
export function calcAttackDamage(attacker, defender, ability) {
  // Pure damage calculation
  const base = ability.effect_magnitude || 100;
  const attackBonus = attacker.attack_power || 0;
  const defenseReduction = Math.max(0, defender.defense || 0);
  const baseDamage = base + attackBonus - (defenseReduction * 0.5);
  
  const isCrit = Math.random() * 100 < (attacker.critical_hit_chance || 0);
  const dmg = Math.max(1, Math.floor(baseDamage * (isCrit ? 1.5 : 1)));
  
  const evaded = Math.random() * 100 < (defender.evasion || 0);
  
  return { dmg, isCrit, evaded };
}

export function resolveCombatRound(character, monster) {
  // Stub for backward compat
  return { success: true };
}

export function initializeCooldowns(character) {
  return {};
}

export function applyCooldown(cooldowns, abilityId, rounds) {
  return { ...cooldowns, [abilityId]: rounds };
}

export function calcRewards(monster) {
  return {
    xp: (monster.xp_reward || (monster.level || 1) * 20),
    gold: (monster.gold_reward || (monster.level || 1) * 8),
  };
}

export function applyVictoryRewards(character, rewards) {
  return {
    xp: (character.xp || 0) + rewards.xp,
    gold: (character.gold || 0) + rewards.gold,
  };
}

export function getLevelUpThreshold(level) {
  return Math.floor(100 * Math.pow(1.1, level - 1));
}

export async function autoResolveCombat(character, monster) {
  // Stub for backward compat
  return { success: true };
}