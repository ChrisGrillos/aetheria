import { useState, useEffect, useRef } from "react";
import { X, Swords, Shield, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateDerivedStats } from "@/components/shared/charUtils";
import { getCharacterAbilities } from "@/components/shared/classDefinitions";
import { base44 } from "@/api/base44Client";
import { calcAttackDamage, tickCooldowns, tickEffects, initializeCooldowns } from "./authorizedCombatEngine";
import { triggerEntityState } from "@/components/world/WorldScene3D";
import DamageNumber from "./DamageNumber";
import AbilityBar from "./AbilityBar";
import CombatCharCard from "./CombatCharCard";
import LootPopup from "./LootPopup";
import { rollLoot } from "@/components/shared/lootTables";
import { getZoneAt } from "@/components/shared/worldZones";
import { addItemToInventory } from "@/components/shared/inventoryUtils";

const MONSTER_EMOJI = {
  goblin: "👺", orc: "👹", dragon: "🐉", skeleton: "💀",
  troll: "🧌", vampire: "🧛", werewolf: "🐺", wraith: "👻",
  basilisk: "🦎", kraken: "🦑"
};

const MONSTER_ABILITIES = {
  goblin:    [{ name: "Scratch",       effect_type: "damage", effect_magnitude: 80,  type: "active" }],
  orc:       [{ name: "Smash",         effect_type: "damage", effect_magnitude: 110, type: "active" }],
  dragon:    [{ name: "Fire Breath",   effect_type: "damage", effect_magnitude: 180, type: "active" }, { name: "Tail Swipe", effect_type: "damage", effect_magnitude: 130, type: "active" }],
  skeleton:  [{ name: "Bone Strike",   effect_type: "damage", effect_magnitude: 90,  type: "active" }],
  troll:     [{ name: "Club Bash",     effect_type: "damage", effect_magnitude: 120, type: "active" }, { name: "Regenerate", effect_type: "heal", effect_magnitude: 15, type: "active" }],
  vampire:   [{ name: "Life Drain",    effect_type: "damage", effect_magnitude: 100, type: "active" }],
  werewolf:  [{ name: "Savage Bite",   effect_type: "damage", effect_magnitude: 115, type: "active" }],
  wraith:    [{ name: "Soul Rend",     effect_type: "damage", effect_magnitude: 95,  type: "active" }],
  basilisk:  [{ name: "Stone Gaze",    effect_type: "debuff", effect_magnitude: 30,  type: "active" }, { name: "Bite", effect_type: "damage", effect_magnitude: 105, type: "active" }],
  kraken:    [{ name: "Tentacle Slam", effect_type: "damage", effect_magnitude: 140, type: "active" }],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPassiveBonuses(abilities) {
  const bonuses = {};
  abilities.filter(a => a.type === "passive").forEach(p => {
    const desc = (p.description || "").toLowerCase();
    const mag = p.effect_magnitude || 0;
    if (p.id === "undying" || desc.includes("survive") || desc.includes("killing blow")) { bonuses.undying = true; return; }
    if (desc.includes("each round") || desc.includes("per round")) { bonuses.per_round_attack = (bonuses.per_round_attack || 0) + mag; return; }
    if (desc.includes("evasion"))  bonuses.evasion      = (bonuses.evasion      || 0) + mag;
    if (desc.includes("defense") || p.name.toLowerCase().includes("hardened") || p.name.toLowerCase().includes("fortress") || p.name.toLowerCase().includes("aura") || p.name.toLowerCase().includes("aegis") || p.name.toLowerCase().includes("bear"))
                                   bonuses.defense      = (bonuses.defense      || 0) + mag;
    if (desc.includes("attack") || desc.includes("damage")) bonuses.attack_power = (bonuses.attack_power || 0) + mag;
    if (desc.includes("magic power") || desc.includes("magic")) bonuses.magic_power  = (bonuses.magic_power  || 0) + mag;
    if (desc.includes("healing") || desc.includes("heal power")) bonuses.healing_power = (bonuses.healing_power || 0) + mag;
    if (desc.includes("critical") || desc.includes("crit")) bonuses.critical_hit_chance = (bonuses.critical_hit_chance || 0) + mag;
  });
  return bonuses;
}

function applyEffects(baseStats, effects) {
  const s = { ...baseStats };
  effects.forEach(e => {
    const sign = e.type === "buff" ? 1 : -1;
    s[e.stat] = Math.max(0, (s[e.stat] || 0) + sign * e.value);
  });
  return s;
}

function buildEffect(ability) {
  const desc = (ability.description || "").toLowerCase();
  let stat = "attack_power";
  if (desc.includes("defense")) stat = "defense";
  else if (desc.includes("evasion") || desc.includes("slow") || desc.includes("speed")) stat = "evasion";
  else if (desc.includes("magic")) stat = "magic_power";
  return {
    name: ability.name,
    type: ability.effect_type, // "buff" | "debuff"
    stat,
    value: ability.effect_magnitude || 0,
    roundsLeft: ability.duration_rounds || 3,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CombatOverlay({ character, monster, onClose, onVictory, onDefeat }) {
  const derived = calculateDerivedStats(character);
  const abilities = getCharacterAbilities(character.base_class || character.class, character.specialization, character.level || 1);

  // ── Energy ────────────────────────────────────────────────────────────────
  const maxEnergy = 50 + ((character.stats?.wisdom || 10) * 2);
  const [playerEnergy, setPlayerEnergy] = useState(character.energy ?? maxEnergy);

  // ── HP ────────────────────────────────────────────────────────────────────
  const [playerHP, setPlayerHP] = useState(character.hp || 100);
  const [enemyHP,  setEnemyHP]  = useState(monster.hp || 50);
  const playerMaxHP = character.max_hp || 100;
  const enemyMaxHP  = monster.max_hp || monster.hp || 50;

  // ── Effects (buffs/debuffs) ────────────────────────────────────────────────
  const [playerEffects, setPlayerEffects] = useState([]);
  const [enemyEffects,  setEnemyEffects]  = useState([]);

  // ── Passives ──────────────────────────────────────────────────────────────
  const [passiveBonuses] = useState(() => buildPassiveBonuses(abilities));
  const [usedUndying, setUsedUndying] = useState(false);
  const [roundAttackBonus, setRoundAttackBonus] = useState(0);

  // ── Other state ───────────────────────────────────────────────────────────
  const [cooldowns, setCooldowns] = useState({});
  const [log, setLog] = useState(["⚔️ Combat begins!"]);
  const [phase, setPhase] = useState("player");
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [loot, setLoot] = useState(null);
  const [shaking, setShaking] = useState("");
  const [flashTarget, setFlashTarget] = useState("");

  const logRef = useRef(null);
  const dnIdRef = useRef(0);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Log passives at start
  useEffect(() => {
    const passives = abilities.filter(a => a.type === "passive");
    if (passives.length > 0) {
      const bonusStr = Object.entries(passiveBonuses)
        .filter(([k, v]) => typeof v === "number" && v > 0)
        .map(([k, v]) => `+${v} ${k.replace(/_/g, " ")}`)
        .join(", ");
      addLog(`✨ Passives: ${bonusStr || passives.map(p => p.name).join(", ")}`);
    }
  }, []);

  const addLog = (msg) => setLog(prev => [...prev.slice(-50), msg]);

  const spawnDamageNumber = (value, type, side) => {
    const id = ++dnIdRef.current;
    const x = side === "player" ? 25 : 65;
    const y = 35 + Math.random() * 20;
    setDamageNumbers(prev => [...prev, { id, value, type, x, y }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1100);
  };

  const flashAndShake = (side, type) => {
    setFlashTarget(side);
    if (type === "damage") setShaking(side);
    setTimeout(() => { setFlashTarget(""); setShaking(""); }, 400);
  };

  // Build "combat-effective" stats including passives + active effects
  const getPlayerCombatStats = (effects = playerEffects) => {
    const withPassives = {
      ...derived,
      attack_power:        (derived.attack_power        || 0) + (passiveBonuses.attack_power        || 0) + roundAttackBonus,
      defense:             (derived.defense             || 0) + (passiveBonuses.defense             || 0),
      evasion:             (derived.evasion             || 0) + (passiveBonuses.evasion             || 0),
      magic_power:         (derived.magic_power         || 0) + (passiveBonuses.magic_power         || 0),
      critical_hit_chance: (derived.critical_hit_chance || 0) + (passiveBonuses.critical_hit_chance || 0),
    };
    return applyEffects(withPassives, effects);
  };

  const calcDamage = (attacker, defender, ability) => calcAttackDamage(attacker, defender, ability);

  // ─── Player action ────────────────────────────────────────────────────────
  const handlePlayerAbility = (ability) => {
    if (phase !== "player") return;
    if (cooldowns[ability.id] > 0) return;

    const cost = ability.energy_cost || 0;
    if (playerEnergy < cost) {
      addLog(`⚡ Not enough energy for ${ability.name}! (Need ${cost}, have ${playerEnergy})`);
      return;
    }
    if (cost > 0) setPlayerEnergy(prev => prev - cost);

    let newEnemyHP = enemyHP;
    let newPlayerHP = playerHP;

    const playerStats   = getPlayerCombatStats();
    const enemyDefStats = applyEffects({ defense: monster.level * 3, evasion: 10, critical_hit_chance: 0 }, enemyEffects.filter(e => e.type === "debuff"));

    if (ability.effect_type === "damage") {
      const { dmg, isCrit, evaded } = calcDamage(playerStats, enemyDefStats, ability);
      triggerEntityState(character.id, "attack", 380);
      if (evaded) {
        addLog(`💨 ${monster.name} evaded ${ability.name}!`);
        spawnDamageNumber("DODGE", "dodge", "enemy");
      } else {
        newEnemyHP = Math.max(0, enemyHP - dmg);
        const critLabel = isCrit ? " 💥 CRIT!" : "";
        addLog(`⚔️ ${ability.name}: dealt ${dmg} damage to ${monster.name}${critLabel}`);
        spawnDamageNumber(isCrit ? `${dmg}!` : dmg, isCrit ? "crit" : "damage", "enemy");
        flashAndShake("enemy", "damage");
        triggerEntityState(monster.id, "hurt", 400);
      }
    } else if (ability.effect_type === "heal") {
      const healBonus = passiveBonuses.healing_power ? Math.floor(ability.effect_magnitude * (1 + passiveBonuses.healing_power / 100)) : ability.effect_magnitude;
      newPlayerHP = Math.min(playerMaxHP, playerHP + healBonus);
      addLog(`💚 ${ability.name}: healed ${healBonus} HP`);
      spawnDamageNumber(`+${healBonus}`, "heal", "player");
      flashAndShake("player", "heal");
      triggerEntityState(character.id, "cast", 700);
    } else if (ability.effect_type === "buff") {
      const eff = buildEffect(ability);
      setPlayerEffects(prev => [...prev, eff]);
      addLog(`✨ ${ability.name}: +${ability.effect_magnitude} ${eff.stat.replace(/_/g, " ")} for ${eff.roundsLeft} rounds`);
      spawnDamageNumber(`+${ability.effect_magnitude}`, "buff", "player");
      triggerEntityState(character.id, "cast", 800);
    } else if (ability.effect_type === "debuff") {
      const eff = buildEffect(ability);
      setEnemyEffects(prev => [...prev, eff]);
      addLog(`🌀 ${ability.name}: -${ability.effect_magnitude} ${eff.stat.replace(/_/g, " ")} on ${monster.name} for ${eff.roundsLeft} rounds`);
      spawnDamageNumber(`-${ability.effect_magnitude}`, "debuff", "enemy");
    } else {
      addLog(`✅ ${ability.name}: used`);
    }

    setEnemyHP(newEnemyHP);
    setPlayerHP(newPlayerHP);

    if (ability.cooldown_rounds > 0) {
      setCooldowns(prev => ({ ...prev, [ability.id]: ability.cooldown_rounds }));
    }

    if (newEnemyHP <= 0) {
      handleVictory(newPlayerHP, playerEnergy - cost);
    } else {
      setPhase("enemy");
      setTimeout(() => enemyTurn(newPlayerHP, newEnemyHP), 900);
    }
  };

  // ─── Enemy turn ───────────────────────────────────────────────────────────
  const enemyTurn = (curPlayerHP, curEnemyHP) => {
    const monAbilities = MONSTER_ABILITIES[monster.species] || [{ name: "Strike", effect_type: "damage", effect_magnitude: 100, type: "active" }];
    const ability = monAbilities[Math.floor(Math.random() * monAbilities.length)];

    const monBaseStats  = { attack_power: (monster.level || 1) * 8 + 5, defense: (monster.level || 1) * 3, critical_hit_chance: 5, evasion: 5 };
    const monDerived    = applyEffects(monBaseStats, enemyEffects.filter(e => e.type === "buff"));
    const playerDefStats = applyEffects(
      { defense: getPlayerCombatStats().defense, evasion: getPlayerCombatStats().evasion, critical_hit_chance: 0 },
      playerEffects.filter(e => e.type === "debuff")
    );

    let newHP = curPlayerHP;

    if (ability.effect_type === "damage") {
      const { dmg, isCrit, evaded } = calcDamage(monDerived, playerDefStats, ability);
      triggerEntityState(monster.id, "attack", 380);
      if (evaded) {
        addLog(`💨 You evaded ${ability.name}!`);
        spawnDamageNumber("DODGE", "dodge", "player");
      } else {
        let finalDmg = dmg;
        newHP = Math.max(0, curPlayerHP - finalDmg);
        const critLabel = isCrit ? " 💥 CRIT!" : "";
        addLog(`💢 ${monster.name} used ${ability.name}: ${finalDmg} damage${critLabel}`);
        spawnDamageNumber(isCrit ? `${finalDmg}!` : finalDmg, isCrit ? "crit" : "damage", "player");
        flashAndShake("player", "damage");
        triggerEntityState(character.id, "hurt", 400);
      }
    } else if (ability.effect_type === "heal") {
      const healed = ability.effect_magnitude;
      setEnemyHP(Math.min(enemyMaxHP, curEnemyHP + healed));
      addLog(`💜 ${monster.name} healed ${healed} HP!`);
      spawnDamageNumber(`+${healed}`, "heal", "enemy");
    }

    // Tick cooldowns
    setCooldowns(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] > 0) next[k]--; });
      return next;
    });

    // Tick effects
    setPlayerEffects(prev => prev.map(e => ({ ...e, roundsLeft: e.roundsLeft - 1 })).filter(e => e.roundsLeft > 0));
    setEnemyEffects( prev => prev.map(e => ({ ...e, roundsLeft: e.roundsLeft - 1 })).filter(e => e.roundsLeft > 0));

    // Regen energy each round
    setPlayerEnergy(prev => Math.min(maxEnergy, prev + 10));

    // Bloodlust / per-round attack bonus
    if (passiveBonuses.per_round_attack) {
      setRoundAttackBonus(prev => prev + passiveBonuses.per_round_attack);
    }

    // Nature's Grace — passive HP regen
    const regen = abilities.find(a => a.id === "natures_grace");
    if (regen) {
      newHP = Math.min(playerMaxHP, newHP + regen.effect_magnitude);
      addLog(`🌿 Nature's Grace: +${regen.effect_magnitude} HP`);
    }

    setPlayerHP(newHP);

    // Check undying
    if (newHP <= 0 && passiveBonuses.undying && !usedUndying) {
      const savedHP = 1;
      setPlayerHP(savedHP);
      setUsedUndying(true);
      addLog("💀 Undying triggers! You survive with 1 HP!");
      spawnDamageNumber("UNDYING!", "buff", "player");
      setPhase("player");
      return;
    }

    if (newHP <= 0) {
      triggerEntityState(character.id, "death", 1200);
      setPhase("defeat");
      addLog("💀 You were defeated...");
      setTimeout(() => onDefeat && onDefeat(), 2000);
    } else {
      setPhase("player");
    }
  };

  // ─── Victory ──────────────────────────────────────────────────────────────
  const handleVictory = async (finalHP, finalEnergy) => {
    setPhase("victory");
    const xpGain   = monster.xp_reward  || (monster.level || 1) * 20;
    const goldGain = monster.gold_reward || (monster.level || 1) * 8;
    const zone = getZoneAt(character.x || 20, character.y || 18);
    const drop = rollLoot(monster, zone);
    setLoot(drop);
    addLog(`🏆 Victory! +${xpGain} XP, +${goldGain} gold!`);
    if (drop) addLog(`💰 Loot: ${drop.emoji} ${drop.name} x${drop.qty}`);

    const updates = {
      hp:        finalHP,
      energy:    finalEnergy ?? playerEnergy,
      xp:        (character.xp   || 0) + xpGain,
      gold:      (character.gold || 0) + goldGain,
      inventory: drop ? addItemToInventory(character.inventory, drop) : (character.inventory || []),
    };
    await base44.entities.Character.update(character.id, updates);
    onVictory && onVictory(updates, drop);
  };

  const basicAttack = {
    id: "basic_attack", name: "Basic Attack", type: "active", effect_type: "damage",
    effect_magnitude: 100, cooldown_rounds: 0, energy_cost: 0, description: "A standard attack."
  };
  const allAbilities = [basicAttack, ...abilities.filter(a => a.type === "active" || a.type === "ultimate")];

  // Active effects display
  const ActiveEffectBadges = ({ effects }) => (
    <div className="flex gap-1 px-2 py-1 flex-wrap min-h-5">
      {effects.map((e, i) => (
        <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${e.type === "buff" ? "bg-blue-900 text-blue-300" : "bg-red-900/70 text-red-300"}`}>
          {e.name} ({e.roundsLeft}r)
        </span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" />

      <div className="relative w-full pointer-events-auto bg-gray-950 border-t-2 border-red-900/60"
        style={{ height: "62vh" }}>

        {/* Damage numbers */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {damageNumbers.map(dn => (
            <DamageNumber key={dn.id} value={dn.value} type={dn.type} x={dn.x} y={dn.y} />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <div className="flex items-center gap-2 text-red-400 font-black text-sm">
            <Swords className="w-4 h-4" /> Combat
            {phase === "player" && <span className="text-xs text-green-400 ml-2">— Your Turn</span>}
            {phase === "enemy"  && <span className="text-xs text-red-400 ml-2">— Enemy Turn</span>}
          </div>

          {/* Energy bar */}
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-blue-400" />
            <div className="relative w-20 bg-gray-800 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(playerEnergy / maxEnergy) * 100}%` }} />
            </div>
            <span className="text-xs text-blue-400">{playerEnergy}/{maxEnergy}</span>
          </div>

          {(phase === "victory" || phase === "defeat") && (
            <Button size="sm" onClick={onClose} className="bg-amber-600 hover:bg-amber-500 text-xs">Continue</Button>
          )}
          {phase === "player" && (
            <Button size="sm" variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-900/50 text-xs"
              onClick={() => {
                const fleeChance = Math.min(0.7, 0.3 + ((character.stats?.dexterity || 10) / 100));
                if (Math.random() < fleeChance) {
                  addLog("🏃 You fled the battle!");
                  const goldLoss = Math.floor((character.gold || 0) * 0.1);
                  base44.entities.Character.update(character.id, { gold: (character.gold || 0) - goldLoss, hp: playerHP, energy: playerEnergy });
                  onClose();
                } else {
                  addLog("❌ Failed to flee! The enemy blocks your escape.");
                  enemyTurn(playerHP, enemyHP);
                }
              }}>🏃 Flee</Button>
          )}
          {phase === "enemy" && (
            <span className="text-xs text-gray-500 animate-pulse">Enemy attacking...</span>
          )}
        </div>

        <div className="flex" style={{ height: "calc(100% - 44px)" }}>
          {/* Left: Player */}
          <div className="flex flex-col">
            <CombatCharCard
              name={character.name}
              emoji={character.avatar_emoji || "🧑"}
              level={character.level || 1}
              className={character.base_class || character.class}
              hp={playerHP}
              maxHP={playerMaxHP}
              isPlayer
              isShaking={shaking === "player"}
              isFlashing={flashTarget === "player"}
            />
            <ActiveEffectBadges effects={playerEffects} />
          </div>

          {/* Center: Log */}
          <div className="flex-1 flex flex-col min-w-0 border-x border-gray-800/50">
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1">
              {log.map((line, i) => (
                <div key={i} className="text-xs text-gray-300 font-mono">{line}</div>
              ))}
            </div>
            {phase === "victory" && <div className="text-center py-2 text-green-400 font-black text-sm">🏆 VICTORY!</div>}
            {phase === "defeat"  && <div className="text-center py-2 text-red-400 font-black text-sm">💀 DEFEATED</div>}
            {loot && (
              <LootPopup loot={loot} onDismiss={() => setLoot(null)} />
            )}
          </div>

          {/* Right: Enemy */}
          <div className="flex flex-col">
            <CombatCharCard
              name={monster.name}
              emoji={MONSTER_EMOJI[monster.species] || "👾"}
              level={monster.level || 1}
              className={monster.species}
              hp={enemyHP}
              maxHP={enemyMaxHP}
              isShaking={shaking === "enemy"}
              isFlashing={flashTarget === "enemy"}
            />
            <ActiveEffectBadges effects={enemyEffects} />
          </div>
        </div>

        <AbilityBar
          abilities={allAbilities}
          cooldowns={cooldowns}
          playerEnergy={playerEnergy}
          disabled={phase !== "player"}
          onUse={handlePlayerAbility}
        />
      </div>
    </div>
  );
}