/**
 * World zones, points of interest, and terrain generation.
 * Single source of truth for map layout used by both WorldMap canvas and travel logic.
 */

export const MAP_W = 60;
export const MAP_H = 50;
export const TILE_SIZE = 20;

// ─── ZONES ────────────────────────────────────────────────────────────────────
// Each zone is a rect: { x, y, w, h, id, name, danger, emoji, color, description, resources }
export const ZONES = [
  {
    id: "town_center",
    name: "Agentica — The First Safehold",
    emoji: "🏘️",
    x: 22, y: 18, w: 16, h: 14,
    danger: 0,
    color: "#3d5c2e",
    description: "The oldest chartered safehold in the known realm. Its walls were raised after the Sundering, when the old order shattered. Forge-smoke and market-bells echo day and night.",
    resources: ["wood", "stone", "herb"],
    encounter_types: ["npc_merchant", "npc_quest_giver", "festival"],
    zone_type: "safehold",
    structures: ["forge", "market", "temple", "inn", "barracks", "guild_hall", "gate_north", "gate_south", "walls"],
  },
  {
    id: "dark_forest",
    name: "The Thornwood",
    emoji: "🌲",
    x: 3, y: 3, w: 14, h: 20,
    danger: 3,
    color: "#1a2e1a",
    description: "An ancient forest that remembers the age before the Sundering. Old shrines to forgotten gods stand half-swallowed by roots. No writ of peace holds here.",
    resources: ["wood", "herb", "mushroom", "bone"],
    encounter_types: ["goblin", "werewolf", "wolf", "herbalist_npc"],
    zone_type: "frontier",
    structures: ["ancient_shrine", "ruined_outpost", "hollow_tree_cache"],
  },
  {
    id: "iron_hills",
    name: "The Ironspine Range",
    emoji: "⛰️",
    x: 42, y: 3, w: 15, h: 18,
    danger: 4,
    color: "#3d3d3d",
    description: "War-scarred ridgelines and deep mines that fed a dozen armies before the order fell. Trolls and broken soldier-clans hold the passes. Iron still flows — at a price.",
    resources: ["iron_ore", "coal", "stone", "gold_ore"],
    encounter_types: ["troll", "orc", "mine_npc"],
    zone_type: "frontier",
    structures: ["mine_entrance", "collapsed_barracks", "ore_smelter"],
  },
  {
    id: "cursed_swamp",
    name: "The Greyfen",
    emoji: "🌿",
    x: 3, y: 30, w: 14, h: 17,
    danger: 5,
    color: "#2a3d1a",
    description: "Mist-choked marshland where the dead do not stay dead. The old road south once ran through here — now the causeways are broken and claimed by wraiths.",
    resources: ["poison_herb", "slime", "mushroom", "bone"],
    encounter_types: ["skeleton", "wraith", "vampire", "witch_npc"],
    zone_type: "frontier",
    structures: ["sunken_temple", "broken_causeway", "witch_hut"],
  },
  {
    id: "golden_plains",
    name: "The Sunreach Plains",
    emoji: "🌾",
    x: 18, y: 3, w: 18, h: 14,
    danger: 1,
    color: "#4a5a20",
    description: "Breadbasket of the realm. Farmsteads and old lord-roads cross this land, but the fields are contested — no lord holds all of it for long.",
    resources: ["wheat", "wood", "herb", "leather"],
    encounter_types: ["bandit", "farmer_npc", "wandering_trader"],
    zone_type: "frontier",
    structures: ["waystation", "farmstead", "lord_road"],
  },
  {
    id: "volcanic_badlands",
    name: "The Ashgate Wastes",
    emoji: "🌋",
    x: 42, y: 28, w: 15, h: 19,
    danger: 7,
    color: "#5c1a00",
    description: "Where a sky-wyrm died at the end of the First War. Its bones burned the land for a generation. Only the most desperate or most powerful dare linger here.",
    resources: ["fire_crystal", "obsidian", "sulfur", "dragon_scale"],
    encounter_types: ["dragon", "basilisk", "fire_elemental_npc"],
    zone_type: "frontier",
    structures: ["wyrm_bone_crater", "obsidian_spire", "ash_camp"],
  },
  {
    id: "coastal_ruins",
    name: "The Tideworn Ruins",
    emoji: "🏛️",
    x: 22, y: 38, w: 16, h: 9,
    danger: 4,
    color: "#4a5a6e",
    description: "Remnants of an old port-city, swallowed by the sea after the Sundering. Vaults and archives lie beneath the waterline. Treasure hunters, scavenger guilds, and sea-dead haunt the half-collapsed halls.",
    resources: ["ancient_relic", "sea_salt", "pearl", "stone"],
    encounter_types: ["kraken", "skeleton", "treasure_hunter_npc"],
    zone_type: "frontier",
    structures: ["sunken_vault", "ruined_lighthouse", "old_harbor_gate"],
  },
];

// ─── POINTS OF INTEREST ───────────────────────────────────────────────────────
export const POINTS_OF_INTEREST = [
  { id: "blacksmith",   x: 27, y: 22, emoji: "⚒️",  name: "Blacksmith",      zone: "town_center",   type: "crafting_station", station: "forge" },
  { id: "alchemy_lab",  x: 32, y: 24, emoji: "⚗️",  name: "Alchemy Lab",     zone: "town_center",   type: "crafting_station", station: "alchemy" },
  { id: "woodshop",     x: 29, y: 29, emoji: "🪵",  name: "Carpenter's Shop",zone: "town_center",   type: "crafting_station", station: "workbench" },
  { id: "market",       x: 34, y: 20, emoji: "🏪",  name: "Market Square",   zone: "town_center",   type: "shop" },
  { id: "tavern",       x: 24, y: 26, emoji: "🍺",  name: "The Rusty Flagon",zone: "town_center",   type: "rest", hp_restore: 30 },
  { id: "temple",       x: 36, y: 28, emoji: "⛪",  name: "Temple of Light", zone: "town_center",   type: "heal_station" },
  { id: "forest_shrine",x: 7,  y: 14, emoji: "🗿",  name: "Ancient Shrine",  zone: "dark_forest",   type: "mystery", xp_bonus: 50 },
  { id: "mine_entrance",x: 47, y: 8,  emoji: "⛏️",  name: "Mine Entrance",   zone: "iron_hills",    type: "resource_node", resource: "iron_ore" },
  { id: "dragon_lair",  x: 50, y: 38, emoji: "🐉",  name: "Dragon's Lair",   zone: "volcanic_badlands", type: "boss_encounter" },
  { id: "ruined_temple",x: 28, y: 41, emoji: "🏛️",  name: "Lost Temple",     zone: "coastal_ruins", type: "dungeon", xp_bonus: 200 },
  { id: "farm",         x: 24, y: 7,  emoji: "🌾",  name: "Sunhaven Farm",   zone: "golden_plains", type: "resource_node", resource: "wheat" },
  { id: "swamp_hut",    x: 8,  y: 38, emoji: "🛖",  name: "Witch's Hut",     zone: "cursed_swamp",  type: "mystery", xp_bonus: 75 },
];

// ─── TERRAIN ──────────────────────────────────────────────────────────────────
export const TERRAIN_COLORS = {
  grass:  "#2d5a27",
  forest: "#1a3d1a",
  water:  "#1a3d6e",
  stone:  "#4a4a4a",
  sand:   "#8b7355",
  lava:   "#8b2500",
  swamp:  "#2a3d1a",
  plains: "#4a5a20",
};

export function getTile(x, y) {
  if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) return "water";

  // Zone-based terrain
  const zone = getZoneAt(x, y);
  if (zone) {
    if (zone.id === "dark_forest")      return "forest";
    if (zone.id === "iron_hills")       return "stone";
    if (zone.id === "cursed_swamp")     return "swamp";
    if (zone.id === "golden_plains")    return "plains";
    if (zone.id === "volcanic_badlands")return "lava";
    if (zone.id === "coastal_ruins")    return "sand";
    return "grass";
  }

  const hash = (x * 73 + y * 31 + x * y * 7) % 100;
  if (hash < 5) return "water";
  if (hash < 12) return "forest";
  if (hash < 17) return "stone";
  if (hash < 22) return "sand";
  return "grass";
}

export function getZoneAt(x, y) {
  return ZONES.find(z => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) || null;
}

export function getPOIAt(x, y) {
  return POINTS_OF_INTEREST.find(p => p.x === x && p.y === y) || null;
}

export function getPOIsInZone(zoneId) {
  return POINTS_OF_INTEREST.filter(p => p.zone === zoneId);
}

// ─── TRAVEL ───────────────────────────────────────────────────────────────────
export function calcTravelSteps(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/** Returns AP cost of moving to a tile based on terrain */
export function moveCost(x, y) {
  const tile = getTile(x, y);
  if (tile === "forest" || tile === "swamp") return 2;
  if (tile === "stone" || tile === "lava")   return 3;
  return 1;
}

// ─── RANDOM ENCOUNTERS ────────────────────────────────────────────────────────
const ENCOUNTER_TEMPLATES = {
  goblin:              { type: "combat",  label: "Goblin Ambush!",        monster: "goblin",   xp: 30,  gold: 8  },
  orc:                 { type: "combat",  label: "Orc Patrol!",           monster: "orc",      xp: 60,  gold: 20 },
  troll:               { type: "combat",  label: "Troll Blocks the Path!",monster: "troll",    xp: 90,  gold: 30 },
  skeleton:            { type: "combat",  label: "Undead Attack!",        monster: "skeleton", xp: 45,  gold: 12 },
  dragon:              { type: "combat",  label: "Dragon Sighted!",       monster: "dragon",   xp: 250, gold: 100},
  wraith:              { type: "combat",  label: "Wraith Appears!",       monster: "wraith",   xp: 75,  gold: 25 },
  werewolf:            { type: "combat",  label: "Werewolf!",             monster: "werewolf", xp: 80,  gold: 20 },
  wolf:                { type: "combat",  label: "Wolf Pack Attacks!",    monster: "goblin",   xp: 20,  gold: 5  },
  bandit:              { type: "combat",  label: "Bandits Ambush You!",   monster: "orc",      xp: 40,  gold: 15 },
  basilisk:            { type: "combat",  label: "Basilisk!",             monster: "basilisk", xp: 120, gold: 40 },
  vampire:             { type: "combat",  label: "Vampire in the Night!", monster: "vampire",  xp: 100, gold: 35 },
  kraken:              { type: "combat",  label: "Sea Monster!",          monster: "kraken",   xp: 180, gold: 60 },
  npc_merchant:        { type: "npc",     label: "Traveling Merchant",    npc: "merchant",     gold_range: [10,50] },
  npc_quest_giver:     { type: "npc",     label: "A Villager Needs Help", npc: "quest_giver",  xp: 80   },
  herbalist_npc:       { type: "npc",     label: "Forest Herbalist",      npc: "herbalist",    resource: "herb" },
  mine_npc:            { type: "npc",     label: "Seasoned Miner",        npc: "miner",        resource: "iron_ore" },
  wandering_trader:    { type: "npc",     label: "Wandering Trader",      npc: "trader",       gold_range: [5,30] },
  farmer_npc:          { type: "npc",     label: "Local Farmer",          npc: "farmer",       resource: "wheat" },
  festival:            { type: "event",   label: "Town Festival!",        xp: 40,  gold: 20 },
  treasure_hunter_npc: { type: "npc",     label: "Treasure Hunter",       npc: "hunter",       xp: 50 },
  witch_npc:           { type: "npc",     label: "The Old Witch",         npc: "witch",        xp: 100 },
  fire_elemental_npc:  { type: "npc",     label: "Fire Spirit",           npc: "spirit",       xp: 120 },
};

export function rollEncounter(zone) {
  if (!zone) return null;
  const roll = Math.random();
  if (roll > 0.35) return null; // 65% chance of no encounter

  const types = zone.encounter_types || [];
  if (types.length === 0) return null;
  const picked = types[Math.floor(Math.random() * types.length)];
  return ENCOUNTER_TEMPLATES[picked] || null;
}