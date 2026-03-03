import { useState } from "react";
import { Heart, Coins, Star, Sword, Video, Package, Zap, Shield, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { calculateDerivedStats } from "@/components/shared/charUtils";

function XPToNextLevel(level) { return Math.floor(100 * Math.pow(level, 1.5)); }

export default function CharacterHUD({ character, onInventory }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const xpPct   = Math.min(100, ((character.xp || 0) % XPToNextLevel(character.level || 1)) / XPToNextLevel(character.level || 1) * 100);
  const hpPct   = Math.min(100, ((character.hp || 100) / (character.max_hp || 100)) * 100);
  const hpColor = hpPct > 60 ? "bg-red-500" : hpPct > 30 ? "bg-orange-500" : "bg-red-700 animate-pulse";

  const derived = calculateDerivedStats(character);
  const maxEnergy = 50 + ((character.stats?.wisdom || 10) * 2);
  const energy = character.energy ?? maxEnergy;
  const energyPct = Math.min(100, (energy / maxEnergy) * 100);

  const buffs   = (character.active_effects || []).filter(e => e.type === "buff"   && (e.rounds_remaining || 0) > 0);
  const debuffs = (character.active_effects || []).filter(e => e.type === "debuff" && (e.rounds_remaining || 0) > 0);

  const potions = (character.inventory || []).filter(i => i.category === "consumable" && i.heals).slice(0, 3);

  const NAV = [
    { href: createPageUrl("Combat"),    label: "⚔️ Hunt",    color: "text-red-400" },
    { href: createPageUrl("Jobs"),      label: "💼 Jobs",    color: "text-yellow-400" },
    { href: createPageUrl("Governance"),label: "⚖️ Vote",    color: "text-purple-400" },
    { href: createPageUrl("Guilds"),    label: "🛡️ Guild",   color: "text-amber-400" },
    { href: createPageUrl("Economy"),   label: "🏪 Market",  color: "text-green-400" },
    { href: createPageUrl("Home"),      label: "🏠 Home",    color: "text-gray-400" },
  ];

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-3 py-1.5 shrink-0 relative z-30">
      {/* Main Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Identity */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xl leading-none">{character.avatar_emoji || "🧑"}</span>
          <div className="min-w-0">
            <div className="text-xs font-black text-amber-400 leading-tight truncate">{character.name}</div>
            <div className="text-xs text-gray-600 capitalize leading-tight">Lv.{character.level || 1} {character.base_class || character.class}</div>
          </div>
        </div>

        {/* HP Bar */}
        <div className="flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-red-400 flex-shrink-0" />
          <div className="relative w-24 bg-gray-800 rounded-full h-3">
            <div className={`${hpColor} h-3 rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-bold" style={{ fontSize: "9px" }}>
              {character.hp}/{character.max_hp}
            </span>
          </div>
        </div>

        {/* Energy Bar */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-blue-400 flex-shrink-0" />
          <div className="relative w-20 bg-gray-800 rounded-full h-3">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${energyPct}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold" style={{ fontSize: "9px" }}>
              {energy}/{maxEnergy}
            </span>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex items-center gap-1.5">
          <Star className="w-3 h-3 text-purple-400 flex-shrink-0" />
          <div className="relative w-20 bg-gray-800 rounded-full h-3">
            <div className="bg-purple-500 h-3 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
          </div>
          <span className="text-xs text-gray-500" style={{ fontSize: "10px" }}>{character.xp || 0}xp</span>
        </div>

        {/* Gold */}
        <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
          <Coins className="w-3 h-3" />{character.gold || 0}g
        </div>

        {/* Buffs/Debuffs */}
        <div className="flex items-center gap-0.5">
          {buffs.map((b, i) => (
            <span key={i} title={`${b.name} (${b.rounds_remaining}r)`} className="text-sm leading-none cursor-help">{b.emoji || "✨"}</span>
          ))}
          {debuffs.map((d, i) => (
            <span key={i} title={`${d.name} (${d.rounds_remaining}r)`} className="text-sm leading-none cursor-help">{d.emoji || "💀"}</span>
          ))}
        </div>

        {/* Quick potions */}
        {potions.length > 0 && (
          <div className="flex items-center gap-1">
            {potions.map((p, i) => (
              <button key={i} title={`Use ${p.name} (+${p.heals} HP)`}
                className="text-sm leading-none bg-gray-800 hover:bg-gray-700 rounded px-1 border border-gray-700 transition-colors">
                🧪
              </button>
            ))}
          </div>
        )}

        {/* Inventory button */}
        {onInventory && (
          <button onClick={onInventory}
            className="text-gray-400 hover:text-amber-400 transition-colors" title="Inventory (I)">
            <Package className="w-4 h-4" />
          </button>
        )}

        {/* Nav — desktop */}
        <div className="ml-auto hidden md:flex gap-3 text-xs">
          {NAV.map(n => (
            <Link key={n.href} to={n.href} className={`${n.color} hover:opacity-80 transition-opacity`}>{n.label}</Link>
          ))}
        </div>

        {/* Hamburger — mobile */}
        <button className="md:hidden ml-auto text-gray-400" onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="md:hidden pt-2 pb-1 flex flex-wrap gap-2">
          {NAV.map(n => (
            <Link key={n.href} to={n.href} onClick={() => setMenuOpen(false)}
              className={`${n.color} text-xs bg-gray-800 px-2 py-1 rounded hover:opacity-80`}>
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}