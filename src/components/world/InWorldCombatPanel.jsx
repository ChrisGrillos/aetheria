export default function InWorldCombatPanel({
  session,
  status = "idle",
  combatError = "",
  inline = false,
}) {
  if (!session && status === "idle") return null;

  const playerHp = Number(session?.actor_hp || 0);
  const playerMaxHp = Number(session?.actor_max_hp || 1);
  const mobHp = Number(session?.monster_hp || 0);
  const mobMaxHp = Number(session?.monster_max_hp || 1);
  const inRange = !!session?.in_range;
  const pPct = Math.max(0, Math.min(100, (playerHp / Math.max(1, playerMaxHp)) * 100));
  const mPct = Math.max(0, Math.min(100, (mobHp / Math.max(1, mobMaxHp)) * 100));
  const panel = (
    <div className="rounded-md border border-[#5a2e1f]/85 bg-[#0f0b0a]/88 shadow-[0_10px_26px_rgba(0,0,0,0.55)] px-3 py-2 h-full">
        <div className="flex items-center justify-between text-[10px]">
          <span className={`uppercase tracking-[0.2em] font-bold ${status === "active" ? "text-red-300" : "text-amber-300"}`}>
            {status === "active" ? "Combat" : status}
          </span>
          <span className={`font-semibold ${inRange ? "text-emerald-300" : "text-orange-300"}`}>
            {inRange ? "In Range" : "Out of Range"}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3 text-[10px]">
          <div>
            <div className="text-[#bfb7ab] truncate">{session?.actor_name || "Player"}</div>
            <div className="h-2 bg-black/60 border border-[#36322d] rounded-sm overflow-hidden mt-1">
              <div className="h-full bg-emerald-500" style={{ width: `${pPct}%` }} />
            </div>
          </div>
          <div>
            <div className="text-[#bfb7ab] truncate text-right">{session?.monster_name || "Target"}</div>
            <div className="h-2 bg-black/60 border border-[#36322d] rounded-sm overflow-hidden mt-1">
              <div className="h-full bg-red-500" style={{ width: `${mPct}%` }} />
            </div>
          </div>
        </div>

        {session?.next_monster_swing_side && (
          <div className="mt-1.5 text-[10px] text-amber-300">
            Telegraph: {String(session.next_monster_swing_side).toUpperCase()}
          </div>
        )}

        {combatError && <div className="mt-1 text-[10px] text-red-400">{combatError}</div>}
    </div>
  );

  if (inline) {
    return <div className="w-full h-full pointer-events-none">{panel}</div>;
  }

  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 w-[340px] max-w-[84vw] pointer-events-none">
      {panel}
    </div>
  );
}
