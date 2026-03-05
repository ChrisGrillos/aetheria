/**
 * AbilityHotbar
 *
 * Shadowbane-style compact hotbar: 9 slots with cooldown sweeps.
 */

import { Crosshair, Heart, Shield, Swords, Zap } from "lucide-react";

const EFFECT_COLORS = {
  damage: "border-red-700/80 bg-red-950/45",
  heal: "border-green-700/80 bg-green-950/45",
  buff: "border-blue-700/80 bg-blue-950/45",
  debuff: "border-orange-700/80 bg-orange-950/45",
  utility: "border-amber-700/80 bg-amber-950/45",
};

const EFFECT_ICONS = {
  damage: <Swords className="w-4 h-4" />,
  heal: <Heart className="w-4 h-4" />,
  buff: <Shield className="w-4 h-4" />,
  debuff: <Zap className="w-4 h-4" />,
  utility: <Crosshair className="w-4 h-4" />,
};

function AbilitySlot({ ability, slot, cooldownMs, onClick }) {
  const color = EFFECT_COLORS[ability?.effect_type] || "border-gray-700 bg-gray-900/60";
  const icon = EFFECT_ICONS[ability?.effect_type] || <Swords className="w-4 h-4" />;
  const onCooldown = cooldownMs > 0;
  const totalCd = (ability?.cooldown_rounds || 0) * 1500;
  const cdPct = totalCd > 0 ? cooldownMs / totalCd : 0;
  const cdSec = Math.ceil(cooldownMs / 1000);

  return (
    <button
      onClick={() => onClick?.(slot)}
      title={ability ? `${ability.name}\n${ability.description || ""}` : `Slot ${slot + 1}`}
      className={`relative w-11 h-11 rounded-sm border flex items-center justify-center transition-all
        ${ability ? color : "border-gray-800 bg-gray-900/30 opacity-40"}
        ${onCooldown ? "opacity-65" : "hover:brightness-125 active:scale-[0.97]"}
      `}
    >
      {onCooldown && totalCd > 0 && (
        <div
          className="absolute inset-0 rounded-sm bg-black/70 flex items-center justify-center z-10"
          style={{ background: `conic-gradient(rgba(0,0,0,0.78) ${cdPct * 360}deg, transparent 0deg)` }}
        >
          <span className="text-white text-[10px] font-bold z-20">{cdSec}</span>
        </div>
      )}

      {ability ? <span className="text-base leading-none">{ability.emoji || icon}</span> : <span className="text-gray-700">-</span>}
      <span className="absolute top-0.5 left-1 text-[8px] text-gray-500 font-mono">{slot + 1}</span>
    </button>
  );
}

export default function AbilityHotbar({ abilities = [], cooldowns = {}, onUseAbility, autoAttacking }) {
  const slots = Array.from({ length: 9 }, (_, i) => abilities[i] || null);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="flex gap-1 bg-[#0f0f14]/92 border border-[#4d4636] rounded-md px-1.5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
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
      {autoAttacking && (
        <div className="text-[9px] text-red-400 font-mono tracking-wide animate-pulse">AUTO ATTACK</div>
      )}
    </div>
  );
}
