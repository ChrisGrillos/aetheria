import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Sword, Bot, Users, Vote, Briefcase, Map, Zap, Hammer, Video, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [user, setUser] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    if (u) {
      const chars = await base44.entities.Character.filter({ created_by: u.email, type: "human" }, "-updated_date", 10);
      setCharacters(chars);
    }
    setLoading(false);
  };

  const handleSelectCharacter = async (charId) => {
    if (user) {
      await base44.auth.updateMe({ active_character_id: charId }).catch(() => {});
      // Redirect to World
      window.location.href = createPageUrl("World");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
            ⚔️ Agentic
          </h1>
          <p className="text-gray-400">A world of Humans and AI, at war, at peace, building together.</p>
        </div>
        <Button
          onClick={() => base44.auth.redirectToLogin(createPageUrl("Home"))}
          className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 text-lg"
        >
          Enter the World
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
          ⚔️ Agentic
        </h1>
        <p className="text-gray-400 text-sm">Welcome back, {user.full_name}</p>
      </div>

      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading your characters...</div>
        ) : characters.length === 0 ? (
          <div className="text-center space-y-4">
            <p className="text-gray-400">You don't have a character yet.</p>
            <Link to={createPageUrl("Characters")}>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-2">
                + Create Character
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-amber-400 mb-4">Select Your Character</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {characters.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCharacter(c.id)}
                  className="bg-gray-900 border border-gray-800 hover:border-amber-500 rounded-xl p-4 text-left transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="text-4xl mb-2">{c.avatar_emoji || "🧑"}</div>
                  <div className="font-bold text-white text-lg">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{c.race || "human"} · Lv. {c.level || 1}</div>
                  <div className="text-xs text-gray-600 mt-1">{c.base_class || "—"}</div>
                  {c.hp && (
                    <div className="mt-2 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-green-500 h-2" style={{ width: `${Math.min(100, ((c.hp || 0) / (c.max_hp || 100)) * 100)}%` }} />
                    </div>
                  )}
                </button>
              ))}

              {characters.length < 6 && (
                <Link to={createPageUrl("Characters")} className="contents">
                  <button className="bg-gray-900/50 border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all hover:scale-105 cursor-pointer">
                    <div className="text-3xl mb-2">+</div>
                    <div className="font-bold text-gray-400">Create Character</div>
                    <div className="text-xs text-gray-600 mt-1">{6 - characters.length} slot{6 - characters.length !== 1 ? 's' : ''} available</div>
                  </button>
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 border-t border-gray-800 pt-6">
          <Link to={createPageUrl("Characters")}>
            <Button variant="outline" className="border-gray-700 text-gray-400 hover:text-white w-full">
              ↓ Manage Roster
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}