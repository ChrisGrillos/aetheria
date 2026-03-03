import { shouldLevelUp, levelUpUpdates } from "@/components/shared/charUtils";

/**
 * Shared combat resolution engine used by both CombatOverlay and TravelEncounterModal.
 *
 * ABILITY SCALING CONVENTION:
 * effect_magnitude is a MULTIPLIER expressed as percentage of base damage.
 *   100 = 1.0x (normal attack)
 *   150 = 1.5x (+50% damage)
 *   200 = 2.0x (double damage)
 *   500 = 5.0x
 * Buff/heal/debuff magnitudes are flat amounts, not multipliers.
 */

export function calcAttackDamage(attacker, defender, ability = null) {
  const atk = attacker.attack_power || attacker.atk || 10;
  const def = defender.defense || defender.def || 0;
  const magnitude = ability ? ability.effect_magnitude / 100 : 1.0;
  const variance = Math.random() * atk * 0.2;
  let dmg = Math.max(1, Math.round(atk * magnitude - def * 0.5 + variance));

  const critChance = (attacker.critical_hit_chance || 5) / 100;
  const isCrit = Math.random() < critChance;
  if (isCrit) dmg = Math.round(dmg * 1.5);

  const evasion = (defender.evasion || 0) / 100;
  const evaded = Math.random() < evasion;

  return { dmg, isCrit, evaded };
}

export function resolveMonsterAttack(monster, playerDerived) {
  const monsterAtk = (monster.level || 1) * 8 + 5;
  return calcAttackDamage(
    { attack_power: monsterAtk, critical_hit_chance: 5 },
    playerDerived,
    null
  );
}

export function calcRewards(monster, won) {
  if (!won) return { xp: 0, gold: 0 };
  return {
    xp: monster.xp_reward || (monster.level || 1) * 20,
    gold: monster.gold_reward || (monster.level || 1) * 8,
  };
}

/**
 * Auto-resolve full combat. Returns { won, rounds, log, finalPlayerHP, xpGained, goldGained }.
 */
export function autoResolveCombat(character, derived, monster) {
  let playerHP = character.hp || character.max_hp || 100;
  const playerMax = character.max_hp || 100;
  let monsterHP = monster.hp || monster.max_hp || 50;
  const log = [];
  let rounds = 0;
  const monsterDef = { defense: (monster.level || 1) * 3, evasion: 10 };

  while (playerHP > 0 && monsterHP > 0 && rounds < 20) {
    rounds++;

    // Player attacks
    const { dmg: pDmg, isCrit, evaded: pEvaded } = calcAttackDamage(derived, monsterDef, null);
    if (pEvaded) {
      log.push(`R${rounds}: ${monster.name || "Enemy"} dodged your attack!`);
    } else {
      monsterHP = Math.max(0, monsterHP - pDmg);
      log.push(`R${rounds}: You deal ${pDmg}${isCrit ? " 💥CRIT" : ""} dmg. Enemy HP: ${Math.max(0, monsterHP)}`);
    }
    if (monsterHP <= 0) break;

    // Monster attacks
    const { dmg: mDmg, isCrit: mCrit, evaded: mEvaded } = resolveMonsterAttack(monster, derived);
    if (mEvaded) {
      log.push(`R${rounds}: You dodge the attack! 💨`);
    } else {
      playerHP = Math.max(0, playerHP - mDmg);
      log.push(`R${rounds}: Enemy deals ${mDmg}${mCrit ? " 💥" : ""} dmg. Your HP: ${Math.max(0, playerHP)}`);
    }
  }

  const won = monsterHP <= 0;
  const rewards = calcRewards(monster, won);

  return {
    won,
    rounds,
    log,
    finalPlayerHP: Math.max(1, playerHP),
    xpGained: rewards.xp,
    goldGained: rewards.gold,
  };
}