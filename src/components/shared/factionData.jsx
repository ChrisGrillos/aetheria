/**
 * Faction system for simple reputation-based interactions.
 * Affects quest availability, NPC prices, and world events.
 */

export const FACTIONS = {
  town_guards: {
    id: "town_guards",
    name: "Town Guard",
    emoji: "⚔️",
    description: "Law and order protectors",
    color: "text-blue-600",
    zone: "town_center",
    allies: ["merchants_guild"],
    enemies: ["dark_brotherhood"],
  },
  merchants_guild: {
    id: "merchants_guild",
    name: "Merchants Guild",
    emoji: "🏪",
    description: "Trade and commerce",
    color: "text-yellow-600",
    zone: "town_center",
    allies: ["town_guards"],
    enemies: ["bandits"],
  },
  forest_druids: {
    id: "forest_druids",
    name: "Forest Druids",
    emoji: "🌿",
    description: "Guardians of nature",
    color: "text-green-600",
    zone: "dark_forest",
    allies: [],
    enemies: ["dark_brotherhood"],
  },
  miners_lodge: {
    id: "miners_lodge",
    name: "Miners Lodge",
    emoji: "⛏️",
    description: "Crafters and builders",
    color: "text-gray-600",
    zone: "iron_hills",
    allies: ["merchants_guild"],
    enemies: [],
  },
  dark_brotherhood: {
    id: "dark_brotherhood",
    name: "Dark Brotherhood",
    emoji: "🗡️",
    description: "Shadows and secrets",
    color: "text-purple-700",
    zone: "cursed_swamp",
    allies: ["bandits"],
    enemies: ["town_guards", "forest_druids"],
  },
  bandits: {
    id: "bandits",
    name: "Bandit Clan",
    emoji: "💰",
    description: "Free spirits",
    color: "text-red-600",
    zone: "golden_plains",
    allies: ["dark_brotherhood"],
    enemies: ["merchants_guild", "town_guards"],
  },
};

// ─── REPUTATION SYSTEM ───────────────────────────────────────────────────────
// -100 to +100 standing per faction
// < -50: Hostile (can't trade, attacked on sight)
// -50 to 0: Disliked (higher prices)
// 0 to 50: Neutral/Liked (normal prices)
// > 50: Loved (discounts, unique quests)

export function getFactionColor(standing) {
  if (standing < -50) return "text-red-700";
  if (standing < 0) return "text-orange-600";
  if (standing <= 50) return "text-gray-400";
  return "text-green-600";
}

export function getFactionStatus(standing) {
  if (standing < -50) return "Hostile";
  if (standing < 0) return "Disliked";
  if (standing === 0) return "Neutral";
  if (standing <= 50) return "Liked";
  return "Loved";
}

export function calcPriceModifier(standing) {
  // -50 standing = 1.5x price
  // 0 standing = 1.0x price
  // 50 standing = 0.8x price
  return Math.max(0.7, 1 - standing / 200);
}

export function changeFactionReputation(character, factionId, amount) {
  const factions = character.faction_standing || {};
  const current = factions[factionId] || 0;
  const newStanding = Math.max(-100, Math.min(100, current + amount));
  return {
    faction_standing: { ...factions, [factionId]: newStanding },
  };
}

export function lockOutIfHostile(character, factionId) {
  const standing = (character.faction_standing || {})[factionId] || 0;
  return standing < -50;
}