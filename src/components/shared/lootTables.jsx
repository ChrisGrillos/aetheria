import { ZONES } from "@/components/shared/worldZones";

const COMMON_DROPS = [
  { id: "herb",      name: "Forest Herb",     emoji: "🌿", category: "resource" },
  { id: "wood",      name: "Wood",             emoji: "🪵", category: "resource" },
  { id: "stone",     name: "Stone",            emoji: "🪨", category: "resource" },
  { id: "leather",   name: "Leather Scrap",   emoji: "🟫", category: "resource" },
  { id: "bone",      name: "Bone Fragment",   emoji: "🦴", category: "resource" },
  { id: "iron_ore",  name: "Iron Ore",        emoji: "⚫", category: "resource" },
];

const UNCOMMON_DROPS = [
  { id: "health_potion",  name: "Health Potion",     emoji: "🧪", category: "consumable", heals: 40 },
  { id: "energy_potion",  name: "Energy Draught",    emoji: "⚗️", category: "consumable", restores_energy: 30 },
  { id: "iron_ingot",     name: "Iron Ingot",        emoji: "🔩", category: "material" },
  { id: "magic_dust",     name: "Magic Dust",        emoji: "✨", category: "material" },
  { id: "wolf_pelt",      name: "Wolf Pelt",         emoji: "🐾", category: "material" },
];

const RARE_DROPS = [
  { id: "short_sword",  name: "Iron Short Sword",   emoji: "🗡️",  category: "weapon",  rarity: "rare",  stats: { attack_power: 8 } },
  { id: "chain_helm",   name: "Chain Helm",          emoji: "⛑️",  category: "armor",   rarity: "rare",  stats: { defense: 6 } },
  { id: "hunters_bow",  name: "Hunter's Bow",        emoji: "🏹",  category: "weapon",  rarity: "rare",  stats: { attack_power: 7, evasion: 3 } },
  { id: "mage_robe",    name: "Mage's Robe",         emoji: "🥻",  category: "armor",   rarity: "rare",  stats: { magic_power: 10, defense: 2 } },
  { id: "shield_oak",   name: "Oak Shield",          emoji: "🛡️",  category: "armor",   rarity: "rare",  stats: { defense: 12 } },
];

const LEGENDARY_DROPS = [
  { id: "flame_blade",    name: "Flamebrand",        emoji: "🔥", category: "weapon", rarity: "legendary", stats: { attack_power: 25 }, description: "A sword wreathed in eternal flame." },
  { id: "shadow_cloak",   name: "Shadow Cloak",      emoji: "🌑", category: "armor",  rarity: "legendary", stats: { evasion: 25, defense: 8 }, description: "Renders the wearer a ghost." },
  { id: "dragon_heart",   name: "Dragon Heartstone", emoji: "💎", category: "trinket",rarity: "legendary", stats: { max_hp: 50, attack_power: 15 }, description: "Pulses with draconic power." },
  { id: "elder_staff",    name: "Elder Staff",       emoji: "🪄", category: "weapon", rarity: "legendary", stats: { magic_power: 35 }, description: "Wielded by an archmage of old." },
];

export function rollLoot(monster, zone) {
  const roll = Math.random();
  const level = monster?.level || 1;

  if (roll < 0.03) {
    // Legendary
    const item = LEGENDARY_DROPS[Math.floor(Math.random() * LEGENDARY_DROPS.length)];
    return { ...item, rarity: "legendary", qty: 1 };
  } else if (roll < 0.13) {
    // Rare
    const item = RARE_DROPS[Math.floor(Math.random() * RARE_DROPS.length)];
    return { ...item, rarity: "rare", qty: 1 };
  } else if (roll < 0.38) {
    // Uncommon
    const item = UNCOMMON_DROPS[Math.floor(Math.random() * UNCOMMON_DROPS.length)];
    return { ...item, rarity: "uncommon", qty: 1 };
  } else if (roll < 0.97) {
    // Common — 1-3 resources
    const item = COMMON_DROPS[Math.floor(Math.random() * COMMON_DROPS.length)];
    const qty = 1 + Math.floor(Math.random() * 2 + Math.floor(level / 5));
    return { ...item, rarity: "common", qty };
  }
  return null; // 3% nothing
}