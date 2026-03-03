import { Badge } from "@/components/ui/badge";
import { Bot, User, Sword, Heart, Coins } from "lucide-react";

const CLASS_EMOJI = {
  warrior: "⚔️", hunter: "🏹", healer: "💚", wizard: "🧙",
  merchant: "💰", craftsman: "🔨", fighter: "🥊", magician: "✨"
};

const STAT_COLOR = {
  strength: "text-red-400", dexterity: "text-green-400", intelligence: "text-blue-400",
  wisdom: "text-purple-400", constitution: "text-orange-400", charisma: "text-pink-400"
};

export default function CharacterCard({ character, isMe }) {
  const isAI = character.type === "ai_agent";
  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-all hover:scale-[1.02]
      ${isMe ? "border-amber-500" : isAI ? "border-cyan-800" : "border-gray-700"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl
            ${character.avatar_color || (isAI ? "bg-cyan-900" : "bg-gray-800")}`}>
            {character.avatar_emoji || CLASS_EMOJI[character.class] || (isAI ? "🤖" : "🧑")}
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-1">
              {character.name}
              {isMe && <span className="text-xs text-amber-400">(you)</span>}
            </div>
            <div className="text-xs text-gray-400 capitalize">{CLASS_EMOJI[character.class]} {character.class}</div>
          </div>
        </div>
        <Badge className={isAI ? "bg-cyan-900 text-cyan-300 text-xs" : "bg-gray-800 text-gray-300 text-xs"}>
          {isAI ? <><Bot className="w-3 h-3 mr-1 inline" />AI</> : <><User className="w-3 h-3 mr-1 inline" />Human</>}
        </Badge>
      </div>

      <div className="flex gap-3 text-sm mb-3">
        <span className="text-purple-400">Lv.{character.level || 1}</span>
        <span className="text-green-400 flex items-center gap-1"><Heart className="w-3 h-3" />{character.hp || 100}</span>
        <span className="text-amber-400 flex items-center gap-1"><Coins className="w-3 h-3" />{character.gold || 0}g</span>
        <span className={`capitalize text-xs px-2 py-0.5 rounded-full
          ${character.status === "idle" ? "bg-gray-800 text-gray-400" :
            character.status === "fighting" ? "bg-red-900 text-red-300" :
            "bg-blue-900 text-blue-300"}`}>
          {character.status || "idle"}
        </span>
      </div>

      {character.stats && (
        <div className="grid grid-cols-3 gap-1 text-xs mt-2">
          {Object.entries(character.stats).map(([stat, val]) => (
            <div key={stat} className="flex justify-between bg-gray-800 rounded px-1.5 py-0.5">
              <span className="text-gray-500 capitalize">{stat.slice(0, 3)}</span>
              <span className={STAT_COLOR[stat] || "text-gray-300"}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {character.last_message && (
        <div className="mt-3 text-xs text-gray-400 italic border-t border-gray-800 pt-2 truncate">
          "{character.last_message}"
        </div>
      )}
    </div>
  );
}