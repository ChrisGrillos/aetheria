/**
 * AbilityHotbar
 * 
 * EQ-style ability bar: 9 slots (numpad 1-9 / keyboard 1-9).
 * Shows ability icon, name, keybind, and cooldown overlay.
 * Also displays the locked target frame (RuneScape-style) when a target is selected.
 */

import { Swords, Zap, Shield, Heart, Crosshair, X } from "lucide-react";

const EFFECT_COLORS = {
  damage:  "border-red-600 bg-red-950/60",
  heal:    "border-green-600 bg-green-950/60",
  buff:    "border-blue-600 bg-blue-950/60",
  debuff:  "border-purple-600 bg-purple-950/60",
  utility: "border-yellow-600 bg-yellow-950/60",
};

const EFFECT_ICONS = {
  damage:  <Swords className="w-4 h-4" />,
  heal:    <Heart className="w-4 h-4" />,
  buff:    <Shield className="w-4 h-4" />,
  debuff:  <Zap className="w-4 h-4" />,
  utility: <Crosshair className="w-4 h-4" />,
};

function AbilitySlot({ ability, slot, cooldownMs, onClick }) {
  const color = EFFECT_COLORS[ability?.effect_type] || "border-gray-700 bg-gray-900/60";
  const icon  = EFFECT_ICONS[ability?.effect_type]  || <Swords className="w-4 h-4" />;

  const onCooldown = cooldownMs > 0;
  const totalCd = (ability?.cooldown_rounds || 0) * 1500;
  const cdPct  = totalCd > 0 ? cooldownMs / totalCd : 0;
  const cdSec  = Math.ceil(cooldownMs / 1000);

  return (
    <button
      onClick={() => onClick && onClick(slot)}
      title={ability ? `${ability.name}\n${ability.description || ""}` : "Empty slot"}
      className={`relative w-12 h-12 rounded border-2 flex flex-col items-center justify-center text-xs transition-all
        ${ability ? color : "border-gray-800 bg-gray-900/30 opacity-40"}
        ${onCooldown ? "opacity-60" : "hover:brightness-125 active:scale-95"}
      `}
    >
      {/* Cooldown sweep overlay */}
      {onCooldown && totalCd > 0 && (
        <div
          className="absolute inset-0 rounded bg-black/70 flex items-center justify-center z-10"
          style={{
            background: `conic-gradient(rgba(0,0,0,0.75) ${cdPct * 360}deg, transparent 0deg)`,
          }}
        >
          <span className="text-white text-xs font-bold z-20 relative">{cdSec}s</span>
        </div>
      )}

      {ability ? (
        <>
          <span className="text-base leading-none">{ability.emoji || icon}</span>
          <span className="text-gray-400 text-[9px] mt-0.5 truncate max-w-full px-0.5 leading-none">{ability.name?.slice(0, 6)}</span>
        </>
      ) : (
        <span className="text-gray-700 text-base">—</span>
      )}

      {/* Slot number */}
      <span className="absolute top-0.5 left-1 text-[8px] text-gray-600 font-mono">{slot + 1}</span>
    </button>
  );
}

function TargetFrame({ target, onClear, autoAttacking }) {
  if (!target) return null;
  const hpPct = Math.max(0, Math.min(100, (target.hp / target.max_hp) * 100));
  const hpColor = hpPct > 60 ? "bg-green-500" : hpPct > 30 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 bg-gray-900/90 border border-red-800/70 rounded-lg px-3 py-2 mb-1 min-w-48">
      <Crosshair className={`w-4 h-4 shrink-0 ${autoAttacking ? "text-red-400 animate-pulse" : "text-red-600"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-red-300 font-bold text-xs truncate">{target.name}</span>
          <span className="text-gray-500 text-[10px] shrink-0">Lv.{target.level}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
          <div className={`${hpColor} h-1.5 rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
        </div>
        <div className="text-[9px] text-gray-500 mt-0.5">{target.hp}/{target.max_hp} HP{autoAttacking ? " · ⚔ Auto" : ""}</div>
      </div>
      <button onClick={onClear} className="text-gray-600 hover:text-red-400 shrink-0 ml-1">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function AbilityHotbar({ abilities = [], cooldowns = {}, onUseAbility, autoAttacking }) {
  // Show up to 9 slots. Target is displayed by the authoritative TargetFrame overlay in World.
  const slots = Array.from({ length: 9 }, (_, i) => abilities[i] || null);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="flex gap-1 bg-gray-950/80 border border-gray-800 rounded-lg px-2 py-1.5">
        {slots.map((ab, i) => (
          <AbilitySlot
            key={i}
            ability={ab}
            slot={i}
            cooldownMs={ab ? (cooldowns[ab.id] || 0) : 0}
            onClick={onUseAbility}
          />
        ))}
      </div>
      <div className="text-[9px] text-gray-700 font-mono">
        1-9 abilities · Tab target · Enter auto-atk · Esc clear
      </div>
    </div>
  );
}