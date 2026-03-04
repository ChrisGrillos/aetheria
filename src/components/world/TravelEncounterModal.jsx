import { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { calculateDerivedStats, shouldLevelUp, levelUpUpdates } from "@/components/shared/charUtils";
import { autoResolveCombat, handleDeath } from "@/components/combat/authorizedCombatEngine";
import { getZoneAt } from "@/components/shared/worldZones";
import { Sword, Package, MessageCircle, X } from "lucide-react";

const NPC_OUTCOMES = {
  merchant:       { msg: "The merchant offers you supplies.", gold: [5, 25], resource: null },
  quest_giver:    { msg: "A villager begs for your help. You earn XP for listening.", xp: 80 },
  herbalist:      { msg: "The herbalist teaches you plant lore. You find herbs nearby.", resource: "herb" },
  miner:          { msg: "The miner points you to a rich vein. You pocket some ore.", resource: "iron_ore" },
  farmer:         { msg: "The farmer is grateful for your company and shares food.", resource: "wheat" },
  trader:         { msg: "A traveling merchant sells you goods at fair prices.", gold: [5, 30] },
  hunter:         { msg: "A treasure hunter shares a map fragment. +XP.", xp: 50 },
  witch:          { msg: "The witch gives you a cryptic prophecy. +XP.", xp: 100 },
  spirit:         { msg: "The fire spirit blesses you with elemental insight. +XP.", xp: 120 },
};

export default function TravelEncounterModal({ encounter, character, zone, onClose, onResult }) {
  const [phase, setPhase] = useState("intro"); // intro | combat | outcome
  const [combatLog, setCombatLog] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFight = async () => {
    setPhase("combat");
    setLoading(true);

    const monsterHpBase = { goblin: 30, orc: 60, skeleton: 45, troll: 90, dragon: 200, wraith: 75, werewolf: 80, vampire: 100, basilisk: 120, kraken: 180 };
    const fakeMonster = {
      name: encounter.monster,
      level: Math.max(1, (zone?.danger || 1) * 2),
      hp: (monsterHpBase[encounter.monster] || 40) + (zone?.danger || 1) * 10,
      max_hp: (monsterHpBase[encounter.monster] || 40) + (zone?.danger || 1) * 10,
      xp_reward: encounter.xp || 30,
      gold_reward: encounter.gold || 10,
    };

    const derived = calculateDerivedStats(character);
    const result = autoResolveCombat(character, derived, fakeMonster);
    setCombatLog(result.log);

    const newXp = (character.xp || 0) + result.xpGained;
    const updates = {
      hp: result.finalPlayerHP,
      xp: newXp,
      gold: result.won ? (character.gold || 0) + result.goldGained : (character.gold || 0),
    };

    if (result.won && shouldLevelUp({ ...character, xp: newXp })) {
      Object.assign(updates, levelUpUpdates({ ...character, xp: newXp }));
    }

    await base44.entities.Character.update(character.id, updates);
    setOutcome({ won: result.won, xp: result.xpGained, gold: result.goldGained, levelUp: updates.level > (character.level || 1) });
    setPhase("outcome");
    setLoading(false);
    onResult(updates);
  };

  const handleFlee = () => {
    setOutcome({ fled: true });
    setPhase("outcome");
    onResult({});
  };

  const handleNPC = async () => {
    setLoading(true);
    const npcData = NPC_OUTCOMES[encounter.npc] || { msg: "A stranger nods at you.", xp: 10 };
    const updates = {};

    if (npcData.xp) updates.xp = (character.xp || 0) + npcData.xp;
    if (npcData.gold) {
      const [min, max] = npcData.gold;
      updates.gold = (character.gold || 0) + Math.floor(Math.random() * (max - min) + min);
    }
    if (npcData.resource) {
      const inv = [...(character.inventory || [])];
      const idx = inv.findIndex(i => i.id === npcData.resource);
      if (idx >= 0) inv[idx] = { ...inv[idx], qty: (inv[idx].qty || 1) + 1 };
      else inv.push({ id: npcData.resource, qty: 1 });
      updates.inventory = inv;
    }

    if (Object.keys(updates).length > 0) {
      await base44.entities.Character.update(character.id, updates);
    }

    setOutcome({ npc: true, msg: npcData.msg, updates });
    setPhase("outcome");
    setLoading(false);
    onResult(updates);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-amber-800 rounded-2xl p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black text-amber-400">
            {zone?.emoji} {encounter.label}
          </h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>
        </div>

        {phase === "intro" && (
          <div>
            <p className="text-gray-300 text-sm mb-4">
              {encounter.type === "combat"
                ? `A ${encounter.monster} blocks your path in ${zone?.name || "the wilderness"}!`
                : encounter.type === "npc"
                ? `You encounter ${encounter.label} in ${zone?.name || "the wilderness"}.`
                : `Something is happening nearby!`}
            </p>
            {encounter.type === "combat" && (
              <div className="flex gap-2">
                <Button onClick={handleFight} className="flex-1 bg-red-700 hover:bg-red-600 gap-1 font-bold">
                  <Sword className="w-4 h-4" /> Fight!
                </Button>
                <Button onClick={handleFlee} variant="outline" className="border-gray-600 text-gray-300">
                  Flee
                </Button>
              </div>
            )}
            {encounter.type === "npc" && (
              <Button onClick={handleNPC} className="w-full bg-blue-700 hover:bg-blue-600 gap-1 font-bold">
                <MessageCircle className="w-4 h-4" /> Interact
              </Button>
            )}
            {encounter.type === "event" && (
              <Button onClick={handleNPC} className="w-full bg-amber-600 hover:bg-amber-500 font-bold">
                🎉 Participate!
              </Button>
            )}
          </div>
        )}

        {phase === "combat" && (
          <div>
            {loading && <p className="text-amber-400 animate-pulse">⚔️ Combat in progress...</p>}
            <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-xs text-gray-300 bg-gray-800 rounded-lg p-2">
              {combatLog.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}

        {phase === "outcome" && outcome && (
          <div className="text-center space-y-3">
            {outcome.won && (
              <>
                <div className="text-4xl">🏆</div>
                <p className="text-green-400 font-bold">Victory!</p>
                <p className="text-sm text-gray-300">+{outcome.xp} XP &nbsp;|&nbsp; +{outcome.gold} gold</p>
                {outcome.levelUp && <p className="text-amber-400 font-bold text-lg">🎉 LEVEL UP!</p>}
              </>
            )}
            {outcome.fled && (
              <>
                <div className="text-4xl">💨</div>
                <p className="text-gray-400 font-medium">You escaped safely.</p>
              </>
            )}
            {outcome.npc && (
              <>
                <div className="text-4xl">💬</div>
                <p className="text-gray-300 text-sm">{outcome.msg}</p>
                {outcome.updates?.xp && <p className="text-purple-400 text-xs">+{(outcome.updates.xp - (character.xp || 0))} XP</p>}
                {outcome.updates?.gold && <p className="text-amber-400 text-xs">+gold</p>}
                {outcome.updates?.inventory && <p className="text-green-400 text-xs"><Package className="w-3 h-3 inline" /> Resource found!</p>}
              </>
            )}
            <Button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600">Continue</Button>
          </div>
        )}
      </div>
    </div>
  );
}