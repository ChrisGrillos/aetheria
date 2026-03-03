import { useEffect, useRef, useCallback } from "react";
import { drawEventOverlays } from "./EventOverlay.jsx";
import { ZONES, POINTS_OF_INTEREST, TERRAIN_COLORS, getTile, MAP_W, MAP_H, TILE_SIZE } from "@/components/shared/worldZones";

const MONSTER_EMOJI = {
  goblin: "👺", orc: "👹", dragon: "🐉", skeleton: "💀",
  troll: "🧌", vampire: "🧛", werewolf: "🐺", wraith: "👻",
  basilisk: "🦎", kraken: "🦑"
};

const CLASS_EMOJI = {
  warrior: "⚔️", hunter: "🏹", healer: "💚", wizard: "🧙",
  merchant: "💰", craftsman: "🔨", fighter: "🥊", magician: "✨"
};

export default function WorldMap({ myCharacter, allCharacters, monsters, worldObjects, onMove, activeEvents = [] }) {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Draw terrain
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const tile = getTile(tx, ty);
        ctx.fillStyle = TERRAIN_COLORS[tile] || "#2d5a27";
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw zone name overlays (translucent banners)
    ZONES.forEach(zone => {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(zone.x * TILE_SIZE, zone.y * TILE_SIZE, zone.w * TILE_SIZE, 14);
      ctx.font = "bold 9px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`${zone.emoji} ${zone.name}`, zone.x * TILE_SIZE + 3, zone.y * TILE_SIZE + 2);
    });

    // Draw event overlays
    drawEventOverlays(ctx, activeEvents, TILE_SIZE);

    // Draw Points of Interest
    POINTS_OF_INTEREST.forEach(poi => {
      ctx.font = `${TILE_SIZE - 2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(poi.emoji, poi.x * TILE_SIZE + TILE_SIZE / 2, poi.y * TILE_SIZE + TILE_SIZE / 2);
      // POI name on hover-like small label
      ctx.font = "7px sans-serif";
      ctx.fillStyle = "#ffffffaa";
      ctx.fillText(poi.name, poi.x * TILE_SIZE + TILE_SIZE / 2, poi.y * TILE_SIZE + TILE_SIZE + 4);
    });

    // Draw world objects (from DB)
    worldObjects.forEach(obj => {
      ctx.font = `${TILE_SIZE - 2}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.emoji || "🏠", obj.x * TILE_SIZE + TILE_SIZE / 2, obj.y * TILE_SIZE + TILE_SIZE / 2);
    });

    // Draw monsters
    monsters.filter(m => m.is_alive).forEach(m => {
      ctx.font = `${TILE_SIZE - 4}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(MONSTER_EMOJI[m.species] || "👾", m.x * TILE_SIZE + TILE_SIZE / 2, m.y * TILE_SIZE + TILE_SIZE / 2);
    });

    // Draw other characters
    allCharacters.forEach(c => {
      if (!myCharacter || c.id === myCharacter.id) return;
      const px = c.x * TILE_SIZE + TILE_SIZE / 2;
      const py = c.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.font = `${TILE_SIZE - 4}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.avatar_emoji || (c.type === "ai_agent" ? "🤖" : "🧑"), px, py);
      ctx.font = "8px sans-serif";
      ctx.fillStyle = c.type === "ai_agent" ? "#67e8f9" : "#fbbf24";
      ctx.fillText(c.name, px, py + TILE_SIZE);
    });

    // Draw my character (highlighted)
    if (myCharacter) {
      const px = myCharacter.x * TILE_SIZE + TILE_SIZE / 2;
      const py = myCharacter.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, TILE_SIZE / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.font = `${TILE_SIZE}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(myCharacter.avatar_emoji || CLASS_EMOJI[myCharacter.class] || "🧑", px, py);
    }
  }, [myCharacter, allCharacters, monsters, worldObjects, activeEvents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = MAP_W * TILE_SIZE;
    canvas.height = MAP_H * TILE_SIZE;
    draw();
  }, [draw]);

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !onMove) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tileX = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
    const tileY = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);
    if (tileX >= 0 && tileX < MAP_W && tileY >= 0 && tileY < MAP_H) {
      const tile = getTile(tileX, tileY);
      if (tile !== "water") onMove(tileX, tileY);
    }
  };

  return (
    <div className="w-full h-full overflow-auto bg-gray-950 relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="cursor-pointer"
        style={{ imageRendering: "pixelated", maxWidth: "100%" }}
      />
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-gray-900/80 px-2 py-1 rounded">
        Click anywhere to move
      </div>
    </div>
  );
}