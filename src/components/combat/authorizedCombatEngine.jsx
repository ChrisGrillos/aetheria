/**
 * AUTHORITATIVE COMBAT ENGINE
 * 
 * Single shared combat resolution used by:
 * - CombatOverlay (world combat)
 * - TravelEncounterModal (travel encounters)
 * - Future PvP duels and auto-combat
 * 
 * All combat modifications, cooldowns, energy, buffs, loot, death—route through here.
 * Enforces world rules, prevents exploits, ensures backward compat.
 */

import { shouldLevelUp, levelUpUpdates, calculateDerivedStats } from "@/components/shared/charUtils";
import { canAttack, validateTarget, getDeathRules, applyDeathPenalty, getRespawnLocation } from "@/components/shared/worldRules";
import { rollLoot } from "@/components/shared/lootTables";

// ─── COMBAT INITIALIZATION ────────────────────────────────────────────────────

/**
 * Start a combat session. Validate both combatants, apply initial state.
 * Returns { valid: boolean, reason?: string, session?: CombatSession }
 */
export function initiateCombat(attacker, target, zone, relationshipState = {}) {
  // Validate attacker can attack target
  const validation = validateTarget(attacker, target, zone, relationshipState);
  if (!validation.valid) {
    return { valid: false, reason: validation.reason };
  }

  // Valid combat session
  return {
    valid: true,
    session: {
      attackerId: attacker.id,
      targetId: target.id,
      zoneId: zone?.id,
      relationshipState,
      attackerStartHP: attacker.hp || attacker.max_hp || 100,
      targetStartHP: target.hp || target.max_hp || 100,
      log: [],
      round: 0,
    }
  };
}

// ─── DAMAGE CALCULATION ────────────────────────────────────────────────────────

/**
 * Calculate attack damage: base attack - defense, variance, crit, evasion.
 * Ability effect_magnitude is % of base attack (100 = 1.0x, 150 = 1.5x, etc).
 */
export function calcAttackDamage(attacker, defender, ability = null) {
  const atkPower = attacker.attack_power || 10;
  const defPower = defender.defense || 0;
  const magnitude = ability ? ability.effect_magnitude / 100 : 1.0;

  // Base damage = (attack - defense) * ability magnitude + variance
  const baseDmg = Math.max(1, atkPower * magnitude - defPower * 0.5);
  const variance = Math.random() * atkPower * 0.2;
  let dmg = Math.round(baseDmg + variance);

  // Critical hit
  const critChance = (attacker.critical_hit_chance || 5) / 100;
  const isCrit = Math.random() < critChance;
  if (isCrit) dmg = Math.round(dmg * 1.5);

  // Evasion
  const evasionChance = (defender.evasion || 0) / 100;
  const evaded = Math.random() < evasionChance;

  return { dmg, isCrit, evaded };
}

// ─── COMBAT ROUND RESOLUTION ──────────────────────────────────────────────────

/**
 * Resolve a single round of combat.
 * attacker and defender are { hp, max_hp, attack_power, defense, etc. }
 * ability is optional (null = basic attack).
 */
export function resolveCombatRound(session, attacker, defender, attackerAbility = null) {
  const { dmg, isCrit, evaded } = calcAttackDamage(attacker, defender, attackerAbility);

  let log = [];
  let newDefenderHP = defender.hp;

  if (evaded) {
    log.push(`${defender.name} evaded the attack!`);
  } else {
    newDefenderHP = Math.max(0, defender.hp - dmg);
    const critLabel = isCrit ? " 💥CRIT" : "";
    log.push(`${attacker.name} dealt ${dmg}${critLabel} damage`);
  }

  return { newDefenderHP, log, dmg, isCrit, evaded };
}

// ─── COOLDOWN / ENERGY MANAGEMENT ──────────────────────────────────────────────

export function initializeCooldowns(abilities = []) {
  const cooldowns = {};
  abilities.forEach(a => {
    if (a.id) cooldowns[a.id] = 0;
  });
  return cooldowns;
}

export function canUseAbility(abilityId, cooldowns = {}, currentEnergy = 0, ability = {}) {
  if (cooldowns[abilityId] && cooldowns[abilityId] > 0) {
    return { canUse: false, reason: `Cooldown: ${cooldowns[abilityId]} rounds` };
  }
  const cost = ability.energy_cost || 0;
  if (currentEnergy < cost) {
    return { canUse: false, reason: `Need ${cost} energy, have ${currentEnergy}` };
  }
  return { canUse: true };
}

export function tickCooldowns(cooldowns = {}) {
  const next = { ...cooldowns };
  Object.keys(next).forEach(k => {
    if (next[k] > 0) next[k]--;
  });
  return next;
}

export function applyCooldown(cooldowns = {}, abilityId, rounds) {
  return { ...cooldowns, [abilityId]: rounds };
}

// ─── BUFFS / DEBUFFS ──────────────────────────────────────────────────────────

export function buildBuff(id, name, emoji, stat_affected, magnitude, duration_rounds, is_percent = false) {
  return {
    id: id || `buff_${Date.now()}`,
    name, emoji,
    type: "buff",
    stat_affected,
    magnitude: Math.abs(magnitude),
    is_percent,
    duration_rounds,
    rounds_remaining: duration_rounds,
  };
}

export function buildDebuff(id, name, emoji, stat_affected, magnitude, duration_rounds, is_percent = false) {
  return {
    id: id || `debuff_${Date.now()}`,
    name, emoji,
    type: "debuff",
    stat_affected,
    magnitude: -Math.abs(magnitude),
    is_percent,
    duration_rounds,
    rounds_remaining: duration_rounds,
  };
}

export function tickEffects(effects = []) {
  return effects
    .map(e => ({ ...e, rounds_remaining: (e.rounds_remaining || 0) - 1 }))
    .filter(e => e.rounds_remaining > 0);
}

// ─── DEATH & RESPAWN ───────────────────────────────────────────────────────────

/**
 * Handle character death: apply penalty, determine respawn, set state.
 */
export function handleDeath(character, zoneId, defeatedByMonster = false) {
  const deathRules = getDeathRules(zoneId);
  const penalty = applyDeathPenalty(character, zoneId);
  const respawn = getRespawnLocation(zoneId);

  return {
    death: {
      zoneId,
      defeatedByMonster,
      goldLost: penalty.goldLost,
      shouldDropLoot: penalty.shouldDropLoot,
    },
    updates: {
      x: respawn.x,
      y: respawn.y,
      hp: Math.floor((character.max_hp || 100) * 0.5),  // Respawn at 50% HP
      gold: penalty.gold,
    },
  };
}

// ─── LOOT & REWARDS ───────────────────────────────────────────────────────────

export function calcRewards(monster, won) {
  if (!won) return { xp: 0, gold: 0 };
  return {
    xp: monster.xp_reward || (monster.level || 1) * 20,
    gold: monster.gold_reward || (monster.level || 1) * 8,
  };
}

export function applyVictoryRewards(character, monster, zone) {
  const rewards = calcRewards(monster, true);
  const loot = rollLoot(monster, zone);

  const newXP = (character.xp || 0) + rewards.xp;
  const newGold = (character.gold || 0) + rewards.gold;

  return {
    xp: newXP,
    gold: newGold,
    loot,
    shouldLevelUp: newXP >= getLevelUpThreshold(character.level || 1),
  };
}

export function getLevelUpThreshold(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// ─── AUTO-RESOLVE (for testing/travel encounters) ────────────────────────────

/**
 * Fully auto-resolve combat between character and monster.
 * Used by TravelEncounterModal and testing.
 */
export function autoResolveCombat(character, monster, zone) {
  const derived = calculateDerivedStats(character);
  let playerHP = character.hp || character.max_hp || 100;
  let monsterHP = monster.hp || monster.max_hp || 50;
  const log = [];
  let rounds = 0;

  const monsterDefense = { 
    defense: (monster.level || 1) * 3, 
    evasion: 10,
    attack_power: (monster.level || 1) * 8 + 5,
    critical_hit_chance: 5,
  };

  while (playerHP > 0 && monsterHP > 0 && rounds < 20) {
    rounds++;

    // Player attacks
    const { dmg: pDmg, isCrit, evaded: pEvaded } = calcAttackDamage(derived, monsterDefense, null);
    if (pEvaded) {
      log.push(`R${rounds}: ${monster.name} dodged!`);
    } else {
      monsterHP = Math.max(0, monsterHP - pDmg);
      log.push(`R${rounds}: You deal ${pDmg}${isCrit ? " 💥CRIT" : ""} dmg. Enemy: ${Math.max(0, monsterHP)}HP`);
    }
    if (monsterHP <= 0) break;

    // Monster attacks
    const playerDefense = { defense: derived.defense, evasion: derived.evasion, critical_hit_chance: 0 };
    const { dmg: mDmg, isCrit: mCrit, evaded: mEvaded } = calcAttackDamage(monsterDefense, playerDefense, null);
    if (mEvaded) {
      log.push(`R${rounds}: You dodged! 💨`);
    } else {
      playerHP = Math.max(0, playerHP - mDmg);
      log.push(`R${rounds}: Enemy deals ${mDmg}${mCrit ? " 💥" : ""} dmg. You: ${Math.max(0, playerHP)}HP`);
    }
  }

  const won = monsterHP <= 0;
  const rewards = calcRewards(monster, won);

  if (!won) {
    const deathResult = handleDeath(character, zone?.id, true);
    return {
      won: false,
      rounds,
      log,
      finalPlayerHP: 0,
      xpGained: 0,
      goldGained: 0,
      death: deathResult.death,
      deathUpdates: deathResult.updates,
    };
  }

  return {
    won: true,
    rounds,
    log,
    finalPlayerHP: Math.max(1, playerHP),
    xpGained: rewards.xp,
    goldGained: rewards.gold,
    loot: rollLoot(monster, zone),
  };
}