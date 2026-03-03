import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import WorldMap from "@/components/world/WorldMap.jsx";
import ChatPanel from "@/components/world/ChatPanel.jsx";
import CharacterHUD from "@/components/world/CharacterHUD.jsx";
import TravelEncounterModal from "@/components/world/TravelEncounterModal.jsx";
import ZoneInfoPanel from "@/components/world/ZoneInfoPanel.jsx";
import CombatOverlay from "@/components/combat/CombatOverlay.jsx";
import Minimap from "@/components/world/Minimap.jsx";
import { getZoneAt, getPOIAt, rollEncounter, calcTravelSteps } from "@/components/shared/worldZones";
import { RESOURCES } from "@/components/shared/craftingData";
import InventoryPanel from "@/components/inventory/InventoryPanel.jsx";

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
  const [combatMonster, setCombatMonster] = useState(null);
  const [showInventory, setShowInventory] = useState(false);

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

  const handleMove = useCallback(async (newX, newY) => {
    if (!myCharacter) return;

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

    // POI rest/heal
    let hpUpdate = null;
    if (poi?.type === "rest" && poi.hp_restore) {
      hpUpdate = Math.min(myCharacter.max_hp || 100, (myCharacter.hp || 100) + poi.hp_restore);
    }
    if (poi?.type === "heal_station") {
      hpUpdate = myCharacter.max_hp || 100;
    }

    const updates = { x: newX, y: newY };
    if (inventoryUpdates) updates.inventory = inventoryUpdates;
    if (hpUpdate !== null) updates.hp = hpUpdate;

    const updated = { ...myCharacter, ...updates };
    setMyCharacter(updated);
    setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? updated : c));
    await base44.entities.Character.update(myCharacter.id, updates);

    // Roll for random encounter after moving
    const enc = rollEncounter(zone);
    if (enc) {
      setEncounter(enc);
      setEncounterZone(zone);
    }
  }, [myCharacter]);

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
          <WorldMap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            worldObjects={worldObjects}
            onMove={handleMove}
            activeEvents={activeEvents}
            onMonsterClick={(monster) => setCombatMonster(monster)}
          />
          <Minimap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            onFastTravel={(tx, ty) => handleMove(tx, ty)}
          />
          {/* Zone info overlay bottom-left */}
          {viewPos && (
            <div className="absolute bottom-8 left-2 w-56">
              <ZoneInfoPanel x={viewPos.x} y={viewPos.y} />
            </div>
          )}
        </div>
        <ChatPanel messages={messages} onSend={handleSendMessage} myCharacter={myCharacter} />
      </div>

      {combatMonster && myCharacter && (
        <CombatOverlay
          character={myCharacter}
          monster={combatMonster}
          onClose={() => setCombatMonster(null)}
          onVictory={(updates) => {
            const updated = { ...myCharacter, ...updates };
            setMyCharacter(updated);
            setMonsters(prev => prev.map(m => m.id === combatMonster.id ? { ...m, is_alive: false } : m));
            setCombatMonster(null);
          }}
          onDefeat={() => {
            const respawned = { ...myCharacter, x: 30, y: 25, hp: Math.floor((myCharacter.max_hp || 100) * 0.5), gold: Math.floor((myCharacter.gold || 0) * 0.9) };
            setMyCharacter(respawned);
            base44.entities.Character.update(myCharacter.id, { x: 30, y: 25, hp: respawned.hp, gold: respawned.gold });
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