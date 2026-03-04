import { useState, useEffect, useCallback, useRef } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import WorldMap from "@/components/world/WorldMap.jsx";
import WorldScene3D from "@/components/world/WorldScene3D.jsx";
import ViewToggle from "@/components/world/ViewToggle.jsx";
import ChatDock from "@/components/chat/ChatDock.jsx";
import CharacterHUD from "@/components/world/CharacterHUD.jsx";
import NPCDialogue from "@/components/world/NPCDialogue.jsx";
import GroupWindow from "@/components/world/GroupWindow.jsx";
import TravelEncounterModal from "@/components/world/TravelEncounterModal.jsx";
import ZoneInfoPanel from "@/components/world/ZoneInfoPanel.jsx";
import CombatOverlay from "@/components/combat/CombatOverlay.jsx";
import Minimap from "@/components/world/Minimap.jsx";
import TargetFrame from "@/components/world/TargetFrame.jsx";
import CombatModeIndicator from "@/components/world/CombatModeIndicator.jsx";
import { getZoneAt, getPOIAt, getTile, rollEncounter } from "@/components/shared/worldZones";
import { isPassable, movementEnergyRegen } from "@/components/shared/movementAuthority";
import { handleDeath, initiateCombat } from "@/components/combat/authorizedCombatEngine";
import { RESOURCES } from "@/components/shared/craftingData";
import InventoryPanel from "@/components/inventory/InventoryPanel.jsx";
import { Button } from "@/components/ui/button";
import { checkAchievements } from "@/components/shared/achievementData";
import useInputController from "@/components/world/useInputController.jsx";
import AbilityHotbar from "@/components/world/AbilityHotbar.jsx";
import { computeCombatMode, COMBAT_MODE } from "@/components/shared/combatMode";
import { canEngage } from "@/components/shared/targetAuthority";
import { isSafeZone } from "@/components/shared/worldRules";

export default function World() {
  const [user, setUser] = useState(null);
  const [myCharacter, setMyCharacter] = useState(null);
  const [allCharacters, setAllCharacters] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [worldObjects, setWorldObjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [encounter, setEncounter] = useState(null);
  const [encounterZone, setEncounterZone] = useState(null);
  const [viewPos, setViewPos] = useState(null);
  const [showInventory, setShowInventory] = useState(false);
  const [fastTravelTarget, setFastTravelTarget] = useState(null);
  const [fastTravelProgress, setFastTravelProgress] = useState(0);
  const fastTravelRef = useRef(null);
  const [viewMode, setViewMode] = useState("3d"); // "map" | "3d"
  const [sceneSettings, setSceneSettings] = useState({ showNameplates: true, showHealthBars: true, cameraDistance: 1.0 });
  const [npcDialogue, setNpcDialogue] = useState(null); // { npcType, zoneName }

  // ─── AUTHORITATIVE TARGET STATE ─────────────────────────────────────────────
  // Single source of truth. No parallel lockedTarget / combatMonster / selectedTarget concepts.
  // { entity, type: "monster"|"player"|"ai_agent"|"npc" }
  const [activeTarget, setActiveTarget] = useState(null);
  // Combat is open when the combat overlay is visible (entity engaged)
  const [combatMonster, setCombatMonster] = useState(null);

  useEffect(() => {
    loadWorld();
    const interval = setInterval(loadCharacters, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "i" || e.key === "I") setShowInventory(v => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!myCharacter) return;
    const unsub = base44.entities.ChatMessage.subscribe(event => {
      if (event.type === "create") {
        setMessages(prev => [...prev.slice(-49), event.data]);
      }
    });
    return unsub;
  }, [myCharacter?.id]);

  const loadWorld = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);

    const [chars, mons, objs, msgs, events] = await Promise.all([
      base44.entities.Character.list("-updated_date", 100),
      base44.entities.Monster.filter({ is_alive: true }),
      base44.entities.WorldObject.list(),
      base44.entities.ChatMessage.list("-created_date", 40),
      base44.entities.WorldEvent.filter({ status: "active" }),
    ]);

    setAllCharacters(chars);
    setMonsters(mons);
    setWorldObjects(objs);
    setMessages(msgs.reverse());
    setActiveEvents(events);

    if (u) {
      const mine = chars.find(c => c.created_by === u.email && c.type === "human");
      if (mine) {
        setMyCharacter(mine);
        base44.entities.Character.update(mine.id, { is_online: true });
      }
    }
    setLoading(false);
  };

  const loadCharacters = async () => {
    const chars = await base44.entities.Character.list("-updated_date", 100);
    setAllCharacters(chars);
    if (user) {
      const mine = chars.find(c => c.created_by === user.email && c.type === "human");
      if (mine) setMyCharacter(mine);
    }
  };

  const cancelFastTravel = useCallback(() => {
    if (fastTravelRef.current) clearInterval(fastTravelRef.current);
    setFastTravelTarget(null);
    setFastTravelProgress(0);
  }, []);

  const requestFastTravel = useCallback((tx, ty) => {
    if (combatMonster || fastTravelTarget) return;
    if (getTile(tx, ty) === "water") return;

    setFastTravelTarget({ x: tx, y: ty });
    setFastTravelProgress(0);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      setFastTravelProgress(Math.min(100, (elapsed / 3000) * 100));

      if (elapsed >= 3000) {
        clearInterval(interval);
        setMyCharacter(prev => {
          if (!prev) return prev;
          const updated = { ...prev, x: tx, y: ty };
          setAllCharacters(all => all.map(c => c.id === prev.id ? updated : c));
          base44.entities.Character.update(prev.id, { x: tx, y: ty });
          return updated;
        });
        setFastTravelTarget(null);
        setFastTravelProgress(0);
      }
    }, 100);

    fastTravelRef.current = interval;
  }, [combatMonster, fastTravelTarget]);

  const handleMove = useCallback(async (newX, newY) => {
    if (!myCharacter) return;
    cancelFastTravel();

    // Authority: validate tile passability
    if (!isPassable(newX, newY)) return;

    const zone = getZoneAt(newX, newY);
    const poi  = getPOIAt(newX, newY);
    setViewPos({ x: newX, y: newY });

    // Gather resource from POI resource nodes
    let inventoryUpdates = null;
    if (poi?.type === "resource_node" && poi.resource) {
      const res = RESOURCES[poi.resource];
      if (res) {
        const inv = [...(myCharacter.inventory || [])];
        const idx = inv.findIndex(i => i.id === poi.resource);
        const qty = 1 + Math.floor(Math.random() * 2);
        if (idx >= 0) inv[idx] = { ...inv[idx], qty: (inv[idx].qty || 0) + qty };
        else inv.push({ id: poi.resource, name: res.name, emoji: res.emoji, qty });
        inventoryUpdates = inv;
      }
    }

    // NPC dialogue on POI visit
    if (poi?.type === "npc" || ["rest","shop","mystery"].includes(poi?.type)) {
      const npcTypeMap = { rest: "merchant", shop: "trader", mystery: "witch" };
      const npcType = poi.npcType || npcTypeMap[poi.type] || "merchant";
      setNpcDialogue({ npcType, zoneName: zone?.name || "Unknown" });
    }

    // POI rest/heal
    let hpUpdate = null;
    if (poi?.type === "rest" && poi.hp_restore) {
      hpUpdate = Math.min(myCharacter.max_hp || 100, (myCharacter.hp || 100) + poi.hp_restore);
    }
    if (poi?.type === "heal_station") {
      hpUpdate = myCharacter.max_hp || 100;
    }

    // Authority: energy regen on movement (out of combat)
    const { energy: newEnergy } = movementEnergyRegen(myCharacter);

    const updates = { x: newX, y: newY, energy: newEnergy };
    if (inventoryUpdates) updates.inventory = inventoryUpdates;
    if (hpUpdate !== null) updates.hp = hpUpdate;

    const updated = { ...myCharacter, ...updates };
    setMyCharacter(updated);
    setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? updated : c));
    await base44.entities.Character.update(myCharacter.id, updates);

    // Check if we walked onto a monster tile — trigger combat and stop walking
    setMonsters(currentMonsters => {
      const monsterOnTile = currentMonsters.find(m => m.is_alive && m.x === newX && m.y === newY);
      if (monsterOnTile && !combatMonster) {
        setCombatMonster(monsterOnTile);
      }
      return currentMonsters;
    });

    // Check for monster on tile using snapshot (for return value)
    const monsterOnTileCheck = monsters.find(m => m.is_alive && m.x === newX && m.y === newY);
    if (monsterOnTileCheck) return "combat";

    // Roll for random encounter after moving
    const enc = rollEncounter(zone);
    if (enc) {
      setEncounter(enc);
      setEncounterZone(zone);
    }
  }, [myCharacter, monsters, combatMonster]);

  // ─── Authoritative combat start — all paths route through here ──────────
  const startCombat = useCallback((monster) => {
    if (!monster || !myCharacter) return;
    const zone = getZoneAt(myCharacter.x, myCharacter.y);
    const validation = initiateCombat(myCharacter, monster, zone);
    if (!validation.valid) {
      console.warn("[CombatAuthority] Blocked:", validation.reason);
      return;
    }
    setActiveTarget({ entity: monster, type: "monster" });
    setCombatMonster(monster);
  }, [myCharacter]);

  // ─── Authoritative target selection ─────────────────────────────────────
  const selectTarget = useCallback((entity, type = "monster") => {
    setActiveTarget({ entity, type });
  }, []);

  const clearActiveTarget = useCallback(() => {
    setActiveTarget(null);
  }, []);

  // ─── Input controller (WASD, hotkeys, target lock, auto-attack) ─────────
  const characterAbilities = myCharacter?.abilities || [];
  const { lockedTarget, lockTarget, clearTarget, autoAttacking, startAutoAttack, cooldowns } =
    useInputController({
      myCharacter,
      monsters,
      onMove: handleMove,
      onStartCombat: startCombat,
      abilities: characterAbilities,
      enabled: !combatMonster && !showInventory && !npcDialogue && !encounter,
    });

  // Keep activeTarget in sync with lockedTarget from input controller
  useEffect(() => {
    if (lockedTarget && (!activeTarget || activeTarget.entity?.id !== lockedTarget.id)) {
      setActiveTarget({ entity: lockedTarget, type: "monster" });
    }
    if (!lockedTarget && activeTarget?.type === "monster" && !combatMonster) {
      // don't clear if combat overlay is open
    }
  }, [lockedTarget]);

  // ─── Combat mode (derived from authoritative state) ──────────────────────
  const combatMode = computeCombatMode(COMBAT_MODE.PEACEFUL, {
    hasTarget: !!(activeTarget),
    targetIsHostile: !!(activeTarget?.entity?.species || activeTarget?.entity?.is_alive !== undefined),
    inCombat: !!combatMonster,
    targetIsPlayer: activeTarget?.type === "player",
    inSafeZone: myCharacter ? isSafeZone(myCharacter.x, myCharacter.y) : false,
  });

  const handleSendMessage = async (text, channel = "global") => {
    if (!myCharacter || !text.trim()) return;
    await base44.entities.ChatMessage.create({
      character_id: myCharacter.id,
      character_name: myCharacter.name,
      character_type: myCharacter.type,
      character_class: myCharacter.class,
      message: text,
      channel,
      x: myCharacter.x,
      y: myCharacter.y
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-amber-400 text-xl font-bold">
        Loading Agentic World...
      </div>
    );
  }

  if (!myCharacter) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-gray-400">You need a character to enter the world.</p>
        <Link to={createPageUrl("Characters")}>
          <button className="bg-amber-500 text-black font-bold px-6 py-2 rounded-lg hover:bg-amber-600">
            Create Character
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <CharacterHUD
        character={myCharacter}
        onInventory={() => setShowInventory(true)}
        onUpdateCharacter={(updated) => {
          setMyCharacter(updated);
          setAllCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />
      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 relative">
        {/* View toggle overlay */}
        <ViewToggle
          mode={viewMode}
          onChange={setViewMode}
          settings={sceneSettings}
          onSettingsChange={setSceneSettings}
        />

        {/* Classic 2D map (always mounted for minimap data, hidden in 3D mode) */}
        <div className={viewMode === "map" ? "w-full h-full" : "hidden"}>
          <WorldMap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            worldObjects={worldObjects}
            onMove={handleMove}
            activeEvents={activeEvents}
            onMonsterClick={(monster) => { lockTarget(monster); selectTarget(monster, "monster"); }}
          />
        </div>

        {/* 3D model-based world scene */}
        {viewMode === "3d" && myCharacter && (
          <WorldScene3D
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            worldObjects={worldObjects}
            activeEvents={activeEvents}
            onMove={handleMove}
            onMonsterClick={(monster) => { lockTarget(monster); selectTarget(monster, "monster"); }}
              sceneSettings={sceneSettings}
          />
        )}

        <Minimap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            onFastTravel={requestFastTravel}
          />
          {fastTravelTarget && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30
              bg-gray-900/95 border border-amber-600 rounded-xl px-6 py-4 text-center pointer-events-auto"
              onClick={cancelFastTravel}>
              <p className="text-sm text-amber-400 font-bold mb-2">⚡ Fast Traveling...</p>
              <div className="w-48 bg-gray-800 rounded-full h-3 mb-2">
                <div className="bg-amber-500 h-3 rounded-full transition-all"
                  style={{ width: `${fastTravelProgress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                To ({fastTravelTarget.x}, {fastTravelTarget.y}) · Click to cancel
              </p>
              <Button size="sm" variant="outline" className="border-gray-700 text-xs"
                onClick={e => { e.stopPropagation(); cancelFastTravel(); }}>Cancel</Button>
            </div>
          )}
          {/* Ability hotbar — anchored bottom-center */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <AbilityHotbar
              abilities={characterAbilities}
              cooldowns={cooldowns}
              onUseAbility={(slot) => {
                const ab = characterAbilities[slot];
                if (ab && activeTarget?.entity) startCombat(activeTarget.entity);
              }}
              lockedTarget={activeTarget?.entity || lockedTarget}
              onClearTarget={() => { clearTarget(); clearActiveTarget(); }}
              autoAttacking={autoAttacking}
            />
          </div>

          {/* Group window (replaces PartyFollower) */}
          <GroupWindow
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            onMoveFollower={null}
          />

          {/* Target frame — authoritative: reads from activeTarget */}
          {activeTarget && myCharacter && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[25] pointer-events-auto">
              <TargetFrame
                target={activeTarget}
                myCharacter={myCharacter}
                combatMode={combatMode}
                x={myCharacter.x}
                y={myCharacter.y}
                onEngage={(entity) => startCombat(entity)}
                onInteract={null}
                onClear={() => { clearTarget(); clearActiveTarget(); }}
              />
            </div>
          )}

          {/* Zone info overlay bottom-left */}
          {viewPos && (
            <div className="absolute bottom-8 left-2 w-56">
              <ZoneInfoPanel x={viewPos.x} y={viewPos.y} />
            </div>
          )}

          {/* Combat mode indicator — bottom-right */}
          {myCharacter && (
            <div className="absolute bottom-24 right-2 z-20 pointer-events-none">
              <CombatModeIndicator
                combatMode={combatMode}
                characterX={myCharacter.x}
                characterY={myCharacter.y}
              />
            </div>
          )}
        </div>
        <ChatDock messages={messages} onSend={handleSendMessage} myCharacter={myCharacter} />
      </div>

      {combatMonster && myCharacter && (
        <CombatOverlay
          character={myCharacter}
          monster={combatMonster}
          onClose={() => setCombatMonster(null)}
          onVictory={async (updates, drop) => {
            // Check for new achievements
            const achievementUpdates = checkAchievements({ ...myCharacter, ...updates }, myCharacter);
            const finalUpdates = { ...updates, ...achievementUpdates };
            
            // Apply all updates (hp, xp, gold, energy, inventory, achievements) to local state
            const updatedChar = { ...myCharacter, ...finalUpdates };
            setMyCharacter(updatedChar);
            setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? updatedChar : c));
            
            // Persist monster death and all updates
            await base44.entities.Monster.update(combatMonster.id, {
              is_alive: false,
              hp: 0,
            });
            await base44.entities.Character.update(myCharacter.id, finalUpdates);
            
            setMonsters(prev => prev.map(m => m.id === combatMonster.id ? { ...m, is_alive: false, hp: 0 } : m));
            setCombatMonster(null);
          }}
          onDefeat={() => {
            const zone = getZoneAt(myCharacter.x, myCharacter.y);
            const { updates: deathUpdates } = handleDeath(myCharacter, zone?.id, true);
            const respawned = { ...myCharacter, ...deathUpdates };
            setMyCharacter(respawned);
            setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? respawned : c));
            base44.entities.Character.update(myCharacter.id, deathUpdates);
            setCombatMonster(null);
          }}
        />
      )}

      {showInventory && myCharacter && (
        <InventoryPanel
          open={showInventory}
          onClose={() => setShowInventory(false)}
          character={myCharacter}
          onUpdate={(updated) => {
            setMyCharacter(updated);
            setAllCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
          }}
        />
      )}

      {npcDialogue && myCharacter && (
        <NPCDialogue
          npcType={npcDialogue.npcType}
          zoneName={npcDialogue.zoneName}
          character={myCharacter}
          onClose={() => setNpcDialogue(null)}
        />
      )}

      {encounter && myCharacter && (
        <TravelEncounterModal
          encounter={encounter}
          character={myCharacter}
          zone={encounterZone}
          onClose={() => setEncounter(null)}
          onResult={(updates) => {
            if (Object.keys(updates).length > 0) {
              const updated = { ...myCharacter, ...updates };
              setMyCharacter(updated);
            }
            setEncounter(null);
          }}
        />
      )}
    </div>
  );
}