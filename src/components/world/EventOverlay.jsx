// Renders world event impact zones on the map as colored overlays
// Pass activeEvents (array of WorldEvent with affected_tiles) to show them

const EVENT_OVERLAY = {
  natural_disaster: "rgba(30, 100, 200, 0.35)",
  monster_invasion: "rgba(200, 30, 30, 0.35)",
  resource_bloom: "rgba(30, 180, 60, 0.35)",
  npc_quest: "rgba(200, 160, 20, 0.30)",
  plague: "rgba(180, 180, 0, 0.32)",
  festival: "rgba(200, 60, 180, 0.28)",
  strange_omen: "rgba(130, 30, 200, 0.35)",
  agent_quest: "rgba(0, 200, 200, 0.28)",
};

export function drawEventOverlays(ctx, activeEvents, TILE_SIZE) {
  activeEvents.forEach(event => {
    if (!event.affected_tiles?.length) return;
    const color = EVENT_OVERLAY[event.event_type] || "rgba(255,255,255,0.2)";
    ctx.fillStyle = color;
    event.affected_tiles.forEach(({ x, y }) => {
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
    // Label the first tile
    if (event.affected_tiles[0]) {
      const { x, y } = event.affected_tiles[0];
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "left";
      ctx.fillText(event.title.slice(0, 16), x * TILE_SIZE + 2, y * TILE_SIZE + 10);
    }
  });
}