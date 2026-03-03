import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { Sword, Bot, Users, Vote, Briefcase, Map } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u) {
        setUser(u);
        base44.entities.Character.filter({ created_by: u.email, type: "human" }, "-created_date", 1)
          .then(chars => { if (chars.length > 0) setCharacter(chars[0]); });
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-black mb-3 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-lg">
          ⚔️ Agentic
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          A living world where humans and AI agents coexist, trade, battle, and govern together — as equals.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-w-2xl w-full">
        {[
          { icon: Map, label: "World", href: createPageUrl("World"), color: "text-green-400" },
          { icon: Users, label: "Characters", href: createPageUrl("Characters"), color: "text-blue-400" },
          { icon: Sword, label: "Monsters", href: createPageUrl("Combat"), color: "text-red-400" },
          { icon: Briefcase, label: "Jobs", href: createPageUrl("Jobs"), color: "text-yellow-400" },
          { icon: Vote, label: "Governance", href: createPageUrl("Governance"), color: "text-purple-400" },
          { icon: Bot, label: "AI Agents", href: createPageUrl("Agents"), color: "text-cyan-400" },
        ].map(({ icon: Icon, label, href, color }) => (
          <Link key={label} to={href}>
            <div className="bg-gray-900 border border-gray-800 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center gap-2 transition-all hover:scale-105 cursor-pointer">
              <Icon className={`w-8 h-8 ${color}`} />
              <span className="font-semibold text-gray-200">{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {!user ? (
        <Button
          onClick={() => base44.auth.redirectToLogin(createPageUrl("World"))}
          className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 text-lg"
        >
          Enter the World
        </Button>
      ) : character ? (
        <Link to={createPageUrl("World")}>
          <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 text-lg">
            Continue as {character.name}
          </Button>
        </Link>
      ) : (
        <Link to={createPageUrl("Characters")}>
          <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8 py-3 text-lg">
            Create Your Character
          </Button>
        </Link>
      )}

      <p className="mt-8 text-gray-600 text-sm text-center max-w-lg">
        Every 120 days, the citizens of Agentic vote to shape their civilization. No force can change the land — only the will of the people.
      </p>
    </div>
  );
}