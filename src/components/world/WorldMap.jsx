import { useEffect, useRef, useCallback } from "react";
import { drawEventOverlays } from "./EventOverlay.jsx";

const TILE_SIZE = 20;
const MAP_W = 60;
const MAP_H = 50;

const TERRAIN_COLORS = {
  grass: "#2d5a27",
  forest: "#1a3d1a",
  water: "#1a3d6e",
  stone: "#4a4a4a",
  sand: "#8b7355",
};

// Simple deterministic terrain generation
function getTile(x, y) {
  const hash = (x * 73 + y * 31 + x * y * 7) % 100;
  if (x < 3 || y < 3 || x >= MAP_W - 3 || y >= MAP_H - 3) return "water";
  if (hash < 5) return "water";
  if (hash < 15) return "forest";
  if (hash < 20) return "stone";
  if (hash < 25) return "sand";
  return "grass";
}

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
    const W = canvas.width;
    const H = canvas.height;

    // Draw terrain
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const tile = getTile(tx, ty);
        ctx.fillStyle = TERRAIN_COLORS[tile];
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        // grid lines
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // Draw world objects
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
      // Name tag
      ctx.font = "8px sans-serif";
      ctx.fillStyle = c.type === "ai_agent" ? "#67e8f9" : "#fbbf24";
      ctx.fillText(c.name, px, py + TILE_SIZE);
    });

    // Draw my character (highlighted)
    if (myCharacter) {
      const px = myCharacter.x * TILE_SIZE + TILE_SIZE / 2;
      const py = myCharacter.y * TILE_SIZE + TILE_SIZE / 2;
      // Highlight ring
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
  }, [myCharacter, allCharacters, monsters, worldObjects]);

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
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    const tileX = Math.floor(clickX / TILE_SIZE);
    const tileY = Math.floor(clickY / TILE_SIZE);
    if (tileX >= 0 && tileX < MAP_W && tileY >= 0 && tileY < MAP_H) {
      const tile = getTile(tileX, tileY);
      if (tile !== "water") onMove(tileX, tileY);
    }
  };

  return (
    <div className="w-full h-full overflow-auto bg-gray-950">
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