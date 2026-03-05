import { useEffect, useRef } from "react";
import { MAP_W, MAP_H, getTile } from "@/components/shared/worldZones";
import { isPassable } from "@/components/shared/movementAuthority";

const MINI_W = 150;
const MINI_H = 120;

const TERRAIN_MINI = {
  grass: "#2d5a27",
  forest: "#1a3d1a",
  water: "#1a3d6e",
  stone: "#4a4a4a",
  sand: "#8b7355",
  lava: "#8b2500",
  swamp: "#2a3d1a",
  plains: "#4a5a20",
};

export default function Minimap({
  myCharacter,
  allCharacters,
  monsters,
  onFastTravel,
  inline = false,
  width = MINI_W,
  height = MINI_H,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawW = Math.max(120, Math.round(Number(width || MINI_W)));
    const drawH = Math.max(90, Math.round(Number(height || MINI_H)));
    const txScale = drawW / MAP_W;
    const tyScale = drawH / MAP_H;

    canvas.width = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let ty = 0; ty < MAP_H; ty += 1) {
      for (let tx = 0; tx < MAP_W; tx += 1) {
        const tile = getTile(tx, ty);
        ctx.fillStyle = TERRAIN_MINI[tile] || "#2d5a27";
        ctx.fillRect(tx * txScale, ty * tyScale, Math.ceil(txScale), Math.ceil(tyScale));
      }
    }

    monsters?.filter((m) => m.is_alive).forEach((m) => {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(m.x * txScale - 1, m.y * tyScale - 1, 2.5, 2.5);
    });

    allCharacters?.forEach((c) => {
      if (c.id === myCharacter?.id) return;
      ctx.fillStyle = c.type === "ai_agent" ? "#22d3ee" : "#fbbf24";
      ctx.fillRect(c.x * txScale - 1, c.y * tyScale - 1, 2.5, 2.5);
    });

    if (myCharacter) {
      const px = myCharacter.x * txScale;
      const py = myCharacter.y * tyScale;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
  }, [allCharacters?.length, height, monsters?.length, myCharacter?.x, myCharacter?.y, width]);

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onFastTravel) return;
    const txScale = canvas.width / MAP_W;
    const tyScale = canvas.height / MAP_H;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const tx = Math.floor(mx / txScale);
    const ty = Math.floor(my / tyScale);
    if (isPassable(tx, ty)) onFastTravel(tx, ty);
  };

  return (
    <div
      className={`${inline ? "relative w-full h-full" : "absolute top-2 right-2 z-20"} border border-gray-700 rounded-lg overflow-hidden shadow-2xl`}
      style={{ width: inline ? "100%" : MINI_W, height: inline ? "100%" : MINI_H }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="cursor-crosshair block"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-xs text-gray-500 text-center py-0.5 pointer-events-none">
        minimap · click to travel
      </div>
    </div>
  );
}
