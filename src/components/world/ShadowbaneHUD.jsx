import { Coins, Heart, Mic, MicOff, Package, Zap, AlertTriangle } from "lucide-react";

function Bar({ label, value, max, tone = "red" }) {
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  const barColor =
    tone === "red"
      ? "from-red-700 to-red-400"
      : tone === "blue"
        ? "from-sky-700 to-sky-400"
        : "from-emerald-700 to-emerald-400";

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="w-8 text-[#bba978] font-semibold">{label}</span>
      <div className="flex-1 h-2 rounded-sm bg-black/60 border border-[#3f3a2d] overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[#9fa4ba] tabular-nums">{Math.round(value || 0)}</span>
    </div>
  );
}

export default function ShadowbaneHUD({
  character,
  runEnergy = 100,
  isSprinting = false,
  combatStatus = "idle",
  targetName = "",
  voiceStatus = "idle",
  pushToTalk = true,
  speaking = false,
  onInventory,
  inline = false,
  combatSession = null,
  combatError = "",
}) {
  if (!character) return null;

  const hp = character.hp ?? character.max_hp ?? 1;
  const maxHp = character.max_hp ?? 100;
  const maxEnergy = 50 + ((character.stats?.wisdom || 10) * 2);
  const energy = character.energy ?? maxEnergy;
  const combatLabel = combatStatus === "active" ? "COMBAT" : combatStatus === "starting" ? "ENGAGING" : "PEACE";
  const combatTone = combatStatus === "active" ? "text-red-300 border-red-800 bg-red-950/50" : "text-emerald-300 border-emerald-800 bg-emerald-950/45";

  const panel = (
    <div className="w-full h-full pointer-events-auto rounded-md border border-[#4e4532] bg-[#100f0f]/94 shadow-[0_10px_28px_rgba(0,0,0,0.65)]">
        <div className="px-3 py-1.5 border-b border-[#3b3428] flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[#e4d3aa] font-semibold text-sm truncate">{character.name}</div>
            <div className="text-[10px] tracking-wide uppercase text-[#917d52]">
              Lv.{character.level || 1} {character.base_class || character.class || "adventurer"}
            </div>
          </div>
          <button
            onClick={onInventory}
            className="text-[#bda46f] hover:text-[#f1dfb1] transition-colors"
            title="Inventory (I)"
          >
            <Package className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 space-y-1.5">
          <div className="flex items-center gap-1 text-[10px] text-red-200">
            <Heart className="w-3 h-3" />
            <Bar label="HP" value={hp} max={maxHp} tone="red" />
          </div>

          <div className="flex items-center gap-1 text-[10px] text-sky-200">
            <Zap className="w-3 h-3" />
            <Bar label="EN" value={energy} max={maxEnergy} tone="blue" />
          </div>

          <Bar label="RUN" value={runEnergy} max={100} tone="green" />

          <div className="flex items-center justify-between text-[10px] pt-1">
            <div className="flex items-center gap-1 text-[#cfb37f]">
              <Coins className="w-3 h-3" />
              <span>{character.gold || 0}g</span>
            </div>
            <span className={`px-2 py-0.5 rounded-sm border font-semibold tracking-wide ${combatTone}`}>{combatLabel}</span>
          </div>

          {targetName && (
            <div className="text-[10px] text-[#d7c9a1] truncate">Target: <span className="text-[#f0e1b8]">{targetName}</span></div>
          )}

          {/* Inline combat session info */}
          {combatSession && combatStatus === "active" && (
            <div className="space-y-1 pt-1 border-t border-[#3b3428]">
              {combatSession.next_monster_swing_side && (
                <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Telegraph: {String(combatSession.next_monster_swing_side).toUpperCase()}
                </div>
              )}
              <div className="flex items-center gap-2 text-[10px]">
                <span className={combatSession.in_range ? "text-emerald-300" : "text-orange-300"}>
                  {combatSession.in_range ? "● In Range" : "● Out of Range"}
                </span>
              </div>
            </div>
          )}

          {combatError && (
            <div className="text-[10px] text-red-400 truncate">{combatError}</div>
          )}

          <div className="flex items-center justify-between text-[10px] text-gray-300">
            <span className="flex items-center gap-1">
              {speaking ? <Mic className="w-3 h-3 text-emerald-300" /> : <MicOff className="w-3 h-3 text-gray-400" />}
              {voiceStatus}
            </span>
            <span className="text-[#8f91a6]">{pushToTalk ? "PTT V" : "Open Mic"}</span>
          </div>

          <div className="text-[9px] text-[#8e815f]">{isSprinting ? "Sprinting" : "Walking"}</div>
        </div>
      </div>
  );

  if (inline) return panel;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <div className="absolute top-2 left-2 w-[278px]">
        {panel}
      </div>
    </div>
  );
}