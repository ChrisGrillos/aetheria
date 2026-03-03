import { useState, useEffect, useRef } from "react";
import { X, Swords, Shield, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateDerivedStats } from "@/components/shared/charUtils";
import { getCharacterAbilities } from "@/components/shared/classDefinitions";
import { base44 } from "@/api/base44Client";
import { calcAttackDamage } from "./combatEngine";
import DamageNumber from "./DamageNumber";
import AbilityBar from "./AbilityBar";
import CombatCharCard from "./CombatCharCard";
import LootPopup from "./LootPopup";
import { rollLoot } from "@/components/shared/lootTables";
import { getZoneAt } from "@/components/shared/worldZones";

const MONSTER_EMOJI = {
  goblin: "👺", orc: "👹", dragon: "🐉", skeleton: "💀",
  troll: "🧌", vampire: "🧛", werewolf: "🐺", wraith: "👻",
  basilisk: "🦎", kraken: "🦑"
};

// Simple monster ability sets
const MONSTER_ABILITIES = {
  goblin:    [{ name: "Scratch", effect_type: "damage", effect_magnitude: 80, type: "active" }],
  orc:       [{ name: "Smash",   effect_type: "damage", effect_magnitude: 110, type: "active" }],
  dragon:    [{ name: "Fire Breath", effect_type: "damage", effect_magnitude: 180, type: "active" }, { name: "Tail Swipe", effect_type: "damage", effect_magnitude: 130, type: "active" }],
  skeleton:  [{ name: "Bone Strike", effect_type: "damage", effect_magnitude: 90, type: "active" }],
  troll:     [{ name: "Club Bash", effect_type: "damage", effect_magnitude: 120, type: "active" }, { name: "Regenerate", effect_type: "heal", effect_magnitude: 15, type: "active" }],
  vampire:   [{ name: "Life Drain", effect_type: "damage", effect_magnitude: 100, type: "active" }],
  werewolf:  [{ name: "Savage Bite", effect_type: "damage", effect_magnitude: 115, type: "active" }],
  wraith:    [{ name: "Soul Rend", effect_type: "damage", effect_magnitude: 95, type: "active" }],
  basilisk:  [{ name: "Stone Gaze", effect_type: "debuff", effect_magnitude: 30, type: "active" }, { name: "Bite", effect_type: "damage", effect_magnitude: 105, type: "active" }],
  kraken:    [{ name: "Tentacle Slam", effect_type: "damage", effect_magnitude: 140, type: "active" }],
};

export default function CombatOverlay({ character, monster, onClose, onVictory, onDefeat }) {
  const derived = calculateDerivedStats(character);
  const abilities = getCharacterAbilities(character.base_class || character.class, character.specialization, character.level || 1);

  const [playerHP, setPlayerHP] = useState(character.hp || 100);
  const [enemyHP,  setEnemyHP]  = useState(monster.hp || 50);
  const [cooldowns, setCooldowns] = useState({});
  const [log, setLog] = useState(["⚔️ Combat begins!"]);
  const [phase, setPhase] = useState("player"); // player | enemy | victory | defeat
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [loot, setLoot] = useState(null);
  const [shaking, setShaking] = useState(""); // "player" | "enemy" | ""
  const [flashTarget, setFlashTarget] = useState(""); // "player" | "enemy" | ""

  const logRef = useRef(null);
  const dnIdRef = useRef(0);

  const playerMaxHP = character.max_hp || 100;
  const enemyMaxHP  = monster.max_hp || monster.hp || 50;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Apply passive abilities at start
  useEffect(() => {
    const passives = abilities.filter(a => a.type === "passive");
    if (passives.length > 0) {
      addLog(`✨ Passives active: ${passives.map(p => p.name).join(", ")}`);
    }
  }, []);

  const addLog = (msg) => setLog(prev => [...prev.slice(-50), msg]);

  const spawnDamageNumber = (value, type, side) => {
    const id = ++dnIdRef.current;
    // side: "player" (left) or "enemy" (right)
    const x = side === "player" ? 25 : 65; // percent
    const y = 35 + Math.random() * 20;
    setDamageNumbers(prev => [...prev, { id, value, type, x, y }]);
    setTimeout(() => setDamageNumbers(prev => prev.filter(d => d.id !== id)), 1100);
  };

  const flashAndShake = (side, type) => {
    setFlashTarget(side);
    if (type === "damage") setShaking(side);
    setTimeout(() => { setFlashTarget(""); setShaking(""); }, 400);
  };

  // Uses shared engine — same math as TravelEncounterModal
  const calcDamage = (attacker, defender, ability) => calcAttackDamage(attacker, defender, ability);

  const handlePlayerAbility = (ability) => {
    if (phase !== "player") return;
    if (cooldowns[ability.id] > 0) return;

    let newEnemyHP = enemyHP;
    let newPlayerHP = playerHP;

    if (ability.effect_type === "damage") {
      const defStats = { defense: monster.level * 3, evasion: 10, critical_hit_chance: 0 };
      const { dmg, isCrit, evaded } = calcDamage(derived, defStats, ability);
      if (evaded) {
        addLog(`💨 ${monster.name} evaded ${ability.name}!`);
        spawnDamageNumber("DODGE", "dodge", "enemy");
      } else {
        newEnemyHP = Math.max(0, enemyHP - dmg);
        const critLabel = isCrit ? " 💥 CRIT!" : "";
        addLog(`⚔️ ${ability.name}: dealt ${dmg} damage to ${monster.name}${critLabel}`);
        spawnDamageNumber(isCrit ? `${dmg}!` : dmg, isCrit ? "crit" : "damage", "enemy");
        flashAndShake("enemy", "damage");
      }
    } else if (ability.effect_type === "heal") {
      const healed = ability.effect_magnitude;
      newPlayerHP = Math.min(playerMaxHP, playerHP + healed);
      addLog(`💚 ${ability.name}: healed ${healed} HP`);
      spawnDamageNumber(`+${healed}`, "heal", "player");
      flashAndShake("player", "heal");
    } else if (ability.effect_type === "buff") {
      addLog(`✨ ${ability.name}: buff applied (+${ability.effect_magnitude})`);
      spawnDamageNumber(`+${ability.effect_magnitude}`, "buff", "player");
    } else if (ability.effect_type === "debuff") {
      addLog(`🌀 ${ability.name}: debuff applied to ${monster.name}`);
      spawnDamageNumber(`-${ability.effect_magnitude}`, "debuff", "enemy");
    } else {
      addLog(`✅ ${ability.name}: used`);
    }

    setEnemyHP(newEnemyHP);
    setPlayerHP(newPlayerHP);

    // Set cooldown
    if (ability.cooldown_rounds > 0) {
      setCooldowns(prev => ({ ...prev, [ability.id]: ability.cooldown_rounds }));
    }

    if (newEnemyHP <= 0) {
      handleVictory(newPlayerHP);
    } else {
      setPhase("enemy");
      setTimeout(() => enemyTurn(newPlayerHP, newEnemyHP), 900);
    }
  };

  const enemyTurn = (curPlayerHP, curEnemyHP) => {
    const monAbilities = MONSTER_ABILITIES[monster.species] || [{ name: "Strike", effect_type: "damage", effect_magnitude: 100, type: "active" }];
    const ability = monAbilities[Math.floor(Math.random() * monAbilities.length)];
    const monDerived = { attack_power: (monster.level || 1) * 8 + 5, defense: (monster.level || 1) * 3, critical_hit_chance: 5, evasion: 5 };
    const playerDef  = { defense: derived.defense || 0, evasion: derived.evasion || 0, critical_hit_chance: 0 };

    let newHP = curPlayerHP;
    if (ability.effect_type === "damage") {
      const { dmg, isCrit, evaded } = calcDamage(monDerived, playerDef, ability);
      if (evaded) {
        addLog(`💨 You evaded ${ability.name}!`);
        spawnDamageNumber("DODGE", "dodge", "player");
      } else {
        newHP = Math.max(0, curPlayerHP - dmg);
        const critLabel = isCrit ? " 💥 CRIT!" : "";
        addLog(`💢 ${monster.name} used ${ability.name}: ${dmg} damage${critLabel}`);
        spawnDamageNumber(isCrit ? `${dmg}!` : dmg, isCrit ? "crit" : "damage", "player");
        flashAndShake("player", "damage");
      }
    } else if (ability.effect_type === "heal") {
      const healed = ability.effect_magnitude;
      const newEHP = Math.min(enemyMaxHP, curEnemyHP + healed);
      setEnemyHP(newEHP);
      addLog(`💜 ${monster.name} healed ${healed} HP!`);
      spawnDamageNumber(`+${healed}`, "heal", "enemy");
    }

    setPlayerHP(newHP);

    // Tick down cooldowns
    setCooldowns(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] > 0) next[k]--; });
      return next;
    });

    if (newHP <= 0) {
      setPhase("defeat");
      addLog("💀 You were defeated...");
      setTimeout(() => onDefeat && onDefeat(), 2000);
    } else {
      setPhase("player");
    }
  };

  const handleVictory = async (finalHP) => {
    setPhase("victory");
    const xpGain   = monster.xp_reward || (monster.level || 1) * 20;
    const goldGain  = monster.gold_reward || (monster.level || 1) * 8;
    const zone = getZoneAt(character.x || 20, character.y || 18);
    const drop = rollLoot(monster, zone);
    setLoot(drop);
    addLog(`🏆 Victory! +${xpGain} XP, +${goldGain} gold!`);

    const updates = {
      hp: finalHP,
      xp: (character.xp || 0) + xpGain,
      gold: (character.gold || 0) + goldGain,
    };
    await base44.entities.Character.update(character.id, updates);
    onVictory && onVictory(updates, drop);
  };

  const basicAttack = {
    id: "basic_attack", name: "Basic Attack", type: "active", effect_type: "damage",
    effect_magnitude: 100, cooldown_rounds: 0, description: "A standard attack."
  };
  const allAbilities = [basicAttack, ...abilities.filter(a => a.type === "active" || a.type === "ultimate")];

  return (
    <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
      {/* Dim background */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" />

      {/* Combat panel — bottom 60% */}
      <div className="relative w-full pointer-events-auto bg-gray-950 border-t-2 border-red-900/60"
        style={{ height: "60vh" }}>
        {/* Damage numbers overlay */}
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
          {(phase === "victory" || phase === "defeat") && (
            <Button size="sm" onClick={onClose} className="bg-amber-600 hover:bg-amber-500 text-xs">
              Continue
            </Button>
          )}
          {phase === "player" && (
            <Button size="sm" variant="outline"
              className="border-red-800 text-red-400 hover:bg-red-900/50 text-xs"
              onClick={() => {
                const fleeChance = Math.min(0.7, 0.3 + ((character.stats?.dexterity || 10) / 100));
                if (Math.random() < fleeChance) {
                  addLog("🏃 You fled the battle!");
                  const goldLoss = Math.floor((character.gold || 0) * 0.1);
                  base44.entities.Character.update(character.id, {
                    gold: (character.gold || 0) - goldLoss,
                    hp: playerHP,
                  });
                  onClose();
                } else {
                  addLog("❌ Failed to flee! The enemy blocks your escape.");
                  enemyTurn(playerHP, enemyHP);
                }
              }}>
              🏃 Flee
            </Button>
          )}
          {phase === "enemy" && (
            <span className="text-xs text-gray-500 animate-pulse">Enemy attacking...</span>
          )}
        </div>

        <div className="flex h-[calc(100%-44px)]">
          {/* Left: Player */}
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

          {/* Center: Combat log */}
          <div className="flex-1 flex flex-col min-w-0 border-x border-gray-800/50">
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1">
              {log.map((line, i) => (
                <div key={i} className="text-xs text-gray-300 font-mono">{line}</div>
              ))}
            </div>
            {phase === "victory" && (
              <div className="text-center py-2 text-green-400 font-black text-sm">🏆 VICTORY!</div>
            )}
            {phase === "defeat" && (
              <div className="text-center py-2 text-red-400 font-black text-sm">💀 DEFEATED</div>
            )}
            {loot && (
              <LootPopup loot={loot} onTake={(item) => {
                const inv = [...(character.inventory || []), item];
                base44.entities.Character.update(character.id, { inventory: inv });
                setLoot(null);
              }} onDismiss={() => setLoot(null)} />
            )}
          </div>

          {/* Right: Enemy */}
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
        </div>

        {/* Ability Bar */}
        <AbilityBar
          abilities={allAbilities}
          cooldowns={cooldowns}
          disabled={phase !== "player"}
          onUse={handlePlayerAbility}
        />
      </div>
    </div>
  );
}