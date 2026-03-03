import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import WorldMap from "@/components/world/WorldMap";
import ChatPanel from "@/components/world/ChatPanel";
import CharacterHUD from "@/components/world/CharacterHUD";

export default function World() {
  const [user, setUser] = useState(null);
  const [myCharacter, setMyCharacter] = useState(null);
  const [allCharacters, setAllCharacters] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [worldObjects, setWorldObjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorld();
    const interval = setInterval(loadCharacters, 5000);
    return () => clearInterval(interval);
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

    const [chars, mons, objs, msgs] = await Promise.all([
      base44.entities.Character.list("-updated_date", 100),
      base44.entities.Monster.filter({ is_alive: true }),
      base44.entities.WorldObject.list(),
      base44.entities.ChatMessage.list("-created_date", 40),
    ]);

    setAllCharacters(chars);
    setMonsters(mons);
    setWorldObjects(objs);
    setMessages(msgs.reverse());

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
    const updated = { ...myCharacter, x: newX, y: newY };
    setMyCharacter(updated);
    setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? updated : c));
    await base44.entities.Character.update(myCharacter.id, { x: newX, y: newY });
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
      <CharacterHUD character={myCharacter} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <WorldMap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            worldObjects={worldObjects}
            onMove={handleMove}
          />
        </div>
        <ChatPanel messages={messages} onSend={handleSendMessage} myCharacter={myCharacter} />
      </div>
    </div>
  );
}