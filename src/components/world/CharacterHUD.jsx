import { Heart, Coins, Star, Sword, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

function XPToNextLevel(level) { return level * 100; }

export default function CharacterHUD({ character }) {
  const xpPercent = Math.min(100, ((character.xp || 0) % XPToNextLevel(character.level || 1)) / XPToNextLevel(character.level || 1) * 100);
  const hpPercent = Math.min(100, ((character.hp || 100) / (character.max_hp || 100)) * 100);

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center gap-4 flex-wrap text-sm shrink-0">
      <div className="flex items-center gap-2 font-bold text-amber-400">
        <span>{character.avatar_emoji || "🧑"}</span>
        <span>{character.name}</span>
        <span className="text-gray-500 font-normal text-xs capitalize">Lv.{character.level || 1} {character.class}</span>
      </div>

      <div className="flex items-center gap-1">
        <Heart className="w-3 h-3 text-red-400" />
        <div className="w-20 bg-gray-700 rounded-full h-2">
          <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${hpPercent}%` }} />
        </div>
        <span className="text-xs text-gray-400">{character.hp}/{character.max_hp}</span>
      </div>

      <div className="flex items-center gap-1">
        <Star className="w-3 h-3 text-purple-400" />
        <div className="w-16 bg-gray-700 rounded-full h-2">
          <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${xpPercent}%` }} />
        </div>
        <span className="text-xs text-gray-400">{character.xp || 0} XP</span>
      </div>

      <div className="flex items-center gap-1 text-amber-400">
        <Coins className="w-3 h-3" /><span>{character.gold || 0}g</span>
      </div>

      <div className="ml-auto flex gap-2 text-xs">
        <Link to={createPageUrl("Combat")} className="text-red-400 hover:text-red-300 flex items-center gap-1">
          <Sword className="w-3 h-3" /> Hunt
        </Link>
        <Link to={createPageUrl("Jobs")} className="text-yellow-400 hover:text-yellow-300">💼 Jobs</Link>
        <Link to={createPageUrl("Governance")} className="text-purple-400 hover:text-purple-300">⚖️ Vote</Link>
        <Link to={createPageUrl("Recording")} className="text-teal-400 hover:text-teal-300 flex items-center gap-1">
          <Video className="w-3 h-3" /> Capture
        </Link>
        <Link to={createPageUrl("Home")} className="text-gray-400 hover:text-gray-300">🏠 Home</Link>
      </div>
    </div>
  );
}