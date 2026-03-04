/**
 * World zones, points of interest, and terrain generation.
 * Single source of truth for map layout used by both WorldMap canvas and travel logic.
 * Vaelrath lore — post-Sundering era.
 */

export const MAP_W = 60;
export const MAP_H = 50;
export const TILE_SIZE = 20;

// ─── ZONES ────────────────────────────────────────────────────────────────────
export const ZONES = [
  {
    id: "high_bastion",
    name: "High Bastion — The Accord Safehold",
    emoji: "🏘️",
    x: 22, y: 18, w: 16, h: 14,
    danger: 0,
    color: "#3d5c2e",
    description: "The oldest chartered safehold in Vaelrath. Its walls were raised in the years after the Sundering, when the old dominion shattered into dust and memory. Forge-smoke and market-bells echo day and night beneath the Accord banner.",
    resources: ["wood", "stone", "herb"],
    encounter_types: ["npc_merchant", "npc_quest_giver", "festival"],
    zone_type: "safehold",
    pvp: false,
    faction: "accord_wardens",
    structures: ["forge", "market", "temple", "inn", "barracks", "guild_hall", "gate_north", "gate_south", "walls"],
  },
  {
    id: "the_thornwild",
    name: "The Thornwild",
    emoji: "🌲",
    x: 3, y: 3, w: 14, h: 20,
    danger: 3,
    color: "#1a2e1a",
    description: "A primordial forest that predates the Accord itself. Old wardstones from a forgotten age stand half-swallowed by roots and rot. The Thornwild suffers no writ of peace — only those who understand its silence survive long.",
    resources: ["wood", "herb", "mushroom", "bone"],
    encounter_types: ["goblin", "werewolf", "wolf", "herbalist_npc"],
    zone_type: "frontier",
    pvp: true,
    faction: "verdant_remnant",
    structures: ["ancient_wardstone", "ruined_outpost", "hollow_tree_cache"],
  },
  {
    id: "kharum_deep",
    name: "The Kharum Deep",
    emoji: "⛰️",
    x: 42, y: 3, w: 15, h: 18,
    danger: 4,
    color: "#3d3d3d",
    description: "War-scarred ridgelines and deep shafts that fed the dominion's war-forges before the Sundering. Broken soldier-clans and ironbound spirits haunt the passes. The Kharum still yields iron — at a steep price in blood.",
    resources: ["iron_ore", "coal", "stone", "gold_ore"],
    encounter_types: ["troll", "orc", "mine_npc"],
    zone_type: "frontier",
    pvp: true,
    faction: "ironbound_compact",
    structures: ["deep_shaft_entrance", "collapsed_barracks", "ore_smelter"],
  },
  {
    id: "greyfen_reach",
    name: "The Greyfen Reach",
    emoji: "🌿",
    x: 3, y: 30, w: 14, h: 17,
    danger: 5,
    color: "#2a3d1a",
    description: "Mist-choked marshland where the dead rise with the tide. The old road south once crossed these fens — now the causeways are broken and claimed by the Unquiet. Even the Accord's patrols turn back at the Greyfen's edge.",
    resources: ["poison_herb", "slime", "mushroom", "bone"],
    encounter_types: ["skeleton", "wraith", "vampire", "witch_npc"],
    zone_type: "frontier",
    pvp: true,
    faction: "grey_conclave",
    structures: ["sunken_reliquary", "broken_causeway", "conclave_hollow"],
  },
  {
    id: "the_ashen_march",
    name: "The Ashen March",
    emoji: "🌾",
    x: 18, y: 3, w: 18, h: 14,
    danger: 1,
    color: "#4a5a20",
    description: "Breadbasket of the fractured realm. Farmsteads and old lord-roads cross this land, but no single power holds the March for long. The soil remembers abundance — the people remember war.",
    resources: ["wheat", "wood", "herb", "leather"],
    encounter_types: ["bandit", "farmer_npc", "wandering_trader"],
    zone_type: "frontier",
    pvp: false,
    faction: null,
    structures: ["waystation", "farmstead", "lord_road"],
  },
  {
    id: "vale_of_cinders",
    name: "The Vale of Cinders",
    emoji: "🌋",
    x: 42, y: 28, w: 15, h: 19,
    danger: 7,
    color: "#5c1a00",
    description: "Where a ruin-serpent of the First Age burned itself into the earth at the Sundering's close. Its bones still radiate heat. Only the most desperate or the most powerful dare make camp here — and most do not leave.",
    resources: ["fire_crystal", "obsidian", "sulfur", "dragon_scale"],
    encounter_types: ["dragon", "basilisk", "fire_elemental_npc"],
    zone_type: "frontier",
    pvp: true,
    faction: null,
    structures: ["serpent_bone_crater", "obsidian_spire", "ash_camp"],
  },
  {
    id: "the_sunken_crown",
    name: "The Sunken Crown",
    emoji: "🏛️",
    x: 22, y: 38, w: 16, h: 9,
    danger: 4,
    color: "#4a5a6e",
    description: "Remnants of Vaelrath's old capital, swallowed by the sea when the dominion fell. Vaults and archives lie beneath the waterline. Scavenger guilds, Crown-bound wraiths, and sea-dead now contest what remains of the old world's knowledge.",
    resources: ["ancient_relic", "sea_salt", "pearl", "stone"],
    encounter_types: ["kraken", "skeleton", "treasure_hunter_npc"],
    zone_type: "frontier",
    pvp: true,
    faction: "archive_seekers",
    structures: ["sunken_vault", "ruined_lighthouse", "old_harbor_gate"],
  },
];

// ─── POINTS OF INTEREST ───────────────────────────────────────────────────────
export const POINTS_OF_INTEREST = [
  // ─── High Bastion (safehold) ─────────────────────────────────────────
  { id: "forge",        x: 27, y: 22, emoji: "⚒️",  name: "The Ironmark Forge",          zone: "high_bastion",      type: "crafting_station", station: "forge",     npcType: "blacksmith" },
  { id: "alchemy_lab",  x: 32, y: 24, emoji: "⚗️",  name: "The Alembic Order",           zone: "high_bastion",      type: "crafting_station", station: "alchemy",   npcType: "alchemist" },
  { id: "woodshop",     x: 29, y: 29, emoji: "🪵",  name: "Carpenter's Muster",          zone: "high_bastion",      type: "crafting_station", station: "workbench", npcType: "merchant" },
  { id: "market",       x: 34, y: 20, emoji: "🏪",  name: "The Accord Bazaar",           zone: "high_bastion",      type: "shop",             npcType: "trader" },
  { id: "tavern",       x: 24, y: 26, emoji: "🍺",  name: "The Shattered Crown Inn",     zone: "high_bastion",      type: "rest",             hp_restore: 30, npcType: "merchant" },
  { id: "temple",       x: 36, y: 28, emoji: "⛪",  name: "Shrine of the First Compact", zone: "high_bastion",      type: "heal_station",     npcType: "healer" },
  { id: "barracks",     x: 26, y: 19, emoji: "🛡️",  name: "The Warden Barracks",         zone: "high_bastion",      type: "npc",              npcType: "guard" },
  { id: "guild_hall",   x: 33, y: 28, emoji: "🏰",  name: "Hall of Guilds",              zone: "high_bastion",      type: "npc",              npcType: "quest_giver" },
  { id: "gate_north",   x: 30, y: 18, emoji: "🚪",  name: "North Gate",                  zone: "high_bastion",      type: "npc",              npcType: "guard" },
  // ─── Frontier landmarks ────────────────────────────────────────────────────
  { id: "thornwild_wardstone", x: 7,  y: 14, emoji: "🗿", name: "Wardstone of the Forgotten", zone: "the_thornwild",    type: "mystery",       xp_bonus: 50,  npcType: "witch" },
  { id: "kharum_shaft",        x: 47, y: 8,  emoji: "⛏️", name: "The Kharum Deeping Shaft",   zone: "kharum_deep",      type: "resource_node", resource: "iron_ore" },
  { id: "cinders_crater",      x: 50, y: 38, emoji: "🐉", name: "Serpent Bone Crater",        zone: "vale_of_cinders",  type: "boss_encounter" },
  { id: "crown_vault",         x: 28, y: 41, emoji: "🏛️", name: "The Sunken Crown Vault",     zone: "the_sunken_crown", type: "dungeon",       xp_bonus: 200 },
  { id: "march_waystation",    x: 24, y: 7,  emoji: "🌾", name: "March Road Waystation",      zone: "the_ashen_march",  type: "resource_node", resource: "wheat" },
  { id: "greyfen_hollow",      x: 8,  y: 38, emoji: "🛖", name: "The Conclave Hollow",        zone: "greyfen_reach",    type: "mystery",       xp_bonus: 75,  npcType: "witch" },
];

// ─── PVP ZONE RULES ───────────────────────────────────────────────────────────
export function getZonePvpRule(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone) return { pvp: false, label: "Unknown", description: "Zone not found." };
  if (zone.pvp) {
    return { pvp: true, label: "Contested", description: "PvP is permitted in this zone. No Accord protection applies." };
  }
  return { pvp: false, label: "Protected", description: "Accord writ of peace holds here. Unprovoked attacks are forbidden." };
}

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

  const zone = getZoneAt(x, y);
  if (zone) {
    if (zone.id === "the_thornwild")    return "forest";
    if (zone.id === "kharum_deep")      return "stone";
    if (zone.id === "greyfen_reach")    return "swamp";
    if (zone.id === "the_ashen_march")  return "plains";
    if (zone.id === "vale_of_cinders")  return "lava";
    if (zone.id === "the_sunken_crown") return "sand";
    return "grass";
  }

  const hash = (x * 73 + y * 31 + x * y * 7) % 100;
  if (hash < 5)  return "water";
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

export function moveCost(x, y) {
  const tile = getTile(x, y);
  if (tile === "forest" || tile === "swamp") return 2;
  if (tile === "stone"  || tile === "lava")  return 3;
  return 1;
}

// ─── RANDOM ENCOUNTERS ────────────────────────────────────────────────────────
const ENCOUNTER_TEMPLATES = {
  goblin:              { type: "combat",  label: "Thornwild Scavengers!",      monster: "goblin",   xp: 30,  gold: 8   },
  orc:                 { type: "combat",  label: "Ironbound War-Band!",         monster: "orc",      xp: 60,  gold: 20  },
  troll:               { type: "combat",  label: "Kharum Ridge-Troll!",         monster: "troll",    xp: 90,  gold: 30  },
  skeleton:            { type: "combat",  label: "The Unquiet Rise!",           monster: "skeleton", xp: 45,  gold: 12  },
  dragon:              { type: "combat",  label: "Ruin-Serpent Sighted!",       monster: "dragon",   xp: 250, gold: 100 },
  wraith:              { type: "combat",  label: "Greyfen Wraith!",             monster: "wraith",   xp: 75,  gold: 25  },
  werewolf:            { type: "combat",  label: "Thornwild Shapechanged!",     monster: "werewolf", xp: 80,  gold: 20  },
  wolf:                { type: "combat",  label: "Pack of Thornwild Wolves!",   monster: "goblin",   xp: 20,  gold: 5   },
  bandit:              { type: "combat",  label: "March Road Ambush!",          monster: "orc",      xp: 40,  gold: 15  },
  basilisk:            { type: "combat",  label: "Cinder Basilisk!",            monster: "basilisk", xp: 120, gold: 40  },
  vampire:             { type: "combat",  label: "Greyfen Nightbound!",         monster: "vampire",  xp: 100, gold: 35  },
  kraken:              { type: "combat",  label: "Crown Depths Stirred!",       monster: "kraken",   xp: 180, gold: 60  },
  npc_merchant:        { type: "npc",     label: "Accord Trader on the Road",   npc: "merchant",     gold_range: [10, 50] },
  npc_quest_giver:     { type: "npc",     label: "A Bastion Messenger",         npc: "quest_giver",  xp: 80  },
  herbalist_npc:       { type: "npc",     label: "Remnant Herbalist",           npc: "herbalist",    resource: "herb" },
  mine_npc:            { type: "npc",     label: "Kharum Deep Delver",          npc: "miner",        resource: "iron_ore" },
  wandering_trader:    { type: "npc",     label: "March Road Pedlar",           npc: "trader",       gold_range: [5, 30] },
  farmer_npc:          { type: "npc",     label: "Ashen March Farmer",          npc: "farmer",       resource: "wheat" },
  festival:            { type: "event",   label: "Accord Rest-Day!",            xp: 40,  gold: 20 },
  treasure_hunter_npc: { type: "npc",     label: "Crown Vault Scavenger",       npc: "hunter",       xp: 50  },
  witch_npc:           { type: "npc",     label: "Conclave Hollow-Keeper",      npc: "witch",        xp: 100 },
  fire_elemental_npc:  { type: "npc",     label: "Cinder Vale Spirit",          npc: "spirit",       xp: 120 },
};

export function rollEncounter(zone) {
  if (!zone) return null;
  const roll = Math.random();
  if (roll > 0.35) return null;

  const types = zone.encounter_types || [];
  if (types.length === 0) return null;
  const picked = types[Math.floor(Math.random() * types.length)];
  return ENCOUNTER_TEMPLATES[picked] || null;
}