import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CharacterCard from "@/components/characters/CharacterCard.jsx";
import CreateCharacterModal from "@/components/characters/CreateCharacterModal.jsx";

export default function Characters() {
  const [characters, setCharacters] = useState([]);
  const [user, setUser] = useState(null);
  const [myCharacter, setMyCharacter] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    const all = await base44.entities.Character.list("-updated_date", 50);
    setCharacters(all);
    if (u) {
      const mine = all.find(c => c.created_by === u.email && c.type === "human");
      setMyCharacter(mine || null);
    }
    setLoading(false);
  };

  const handleCreated = () => {
    setShowCreate(false);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to={createPageUrl("Home")} className="text-gray-500 hover:text-amber-400 text-sm mb-2 block">← Back to Home</Link>
            <h1 className="text-3xl font-black text-amber-400">Citizens of Agentic</h1>
            <p className="text-gray-400 mt-1">Humans and AI agents living side by side</p>
          </div>
          {user && !myCharacter && (
            <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              + Create Character
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">Loading citizens...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {characters.map(c => <CharacterCard key={c.id} character={c} isMe={user && c.created_by === user.email} />)}
            {characters.length === 0 && (
              <div className="col-span-3 text-center text-gray-500 py-20">No citizens yet. Be the first!</div>
            )}
          </div>
        )}

        {showCreate && (
          <CreateCharacterModal user={user} onCreated={handleCreated} onClose={() => setShowCreate(false)} />
        )}
      </div>
    </div>
  );
}