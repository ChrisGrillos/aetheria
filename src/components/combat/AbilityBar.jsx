const TYPE_COLOR = {
  active:   "border-blue-700 hover:border-blue-400",
  ultimate: "border-purple-700 hover:border-purple-400",
};
const EFFECT_EMOJI = {
  damage: "⚔️", heal: "💚", buff: "✨", debuff: "🌀", utility: "🔧",
};

export default function AbilityBar({ abilities, cooldowns, disabled, onUse }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-800 px-3 py-2 flex gap-2 overflow-x-auto">
      {abilities.map(ability => {
        const cd = cooldowns[ability.id] || 0;
        const onCD = cd > 0;
        const isDisabled = disabled || onCD;
        return (
          <button
            key={ability.id}
            onClick={() => !isDisabled && onUse(ability)}
            title={`${ability.name}: ${ability.description}`}
            className={`relative flex-shrink-0 w-14 h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5
              transition-all text-xs
              ${isDisabled ? "border-gray-800 text-gray-700 cursor-not-allowed opacity-50" : `${TYPE_COLOR[ability.type] || "border-gray-600"} text-white cursor-pointer`}`}
          >
            <span className="text-lg">{EFFECT_EMOJI[ability.effect_type] || "⚡"}</span>
            <span className="text-xs leading-tight text-center px-1 truncate w-full text-center">{ability.name.split(" ")[0]}</span>
            {onCD && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                <span className="text-red-400 font-black text-base">{cd}</span>
              </div>
            )}
            {ability.type === "ultimate" && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full text-white" style={{ fontSize: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>U</div>
            )}
          </button>
        );
      })}
    </div>
  );
}