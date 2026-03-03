/**
 * Achievement system for tracking player accomplishments.
 * Unlocks titles and cosmetics.
 */

export const ACHIEVEMENTS = {
  first_victory: {
    id: "first_victory",
    name: "First Blood",
    description: "Win your first combat",
    emoji: "🏆",
    icon_color: "text-yellow-500",
    title_unlocked: "Novice Fighter",
  },
  level_5: {
    id: "level_5",
    name: "Rising Star",
    description: "Reach level 5",
    emoji: "⭐",
    icon_color: "text-blue-500",
    title_unlocked: "Level 5 Champion",
  },
  level_10: {
    id: "level_10",
    name: "Veteran",
    description: "Reach level 10",
    emoji: "👑",
    icon_color: "text-purple-500",
    title_unlocked: "Seasoned Warrior",
  },
  hoard_1000_gold: {
    id: "hoard_1000_gold",
    name: "Collector",
    description: "Accumulate 1000 gold",
    emoji: "💰",
    icon_color: "text-yellow-600",
    title_unlocked: "Wealthy Trader",
  },
  unlock_5_skills: {
    id: "unlock_5_skills",
    name: "Specialized",
    description: "Unlock 5 skill tree nodes",
    emoji: "🌳",
    icon_color: "text-green-500",
    title_unlocked: "Specialist",
  },
  defeat_dragon: {
    id: "defeat_dragon",
    name: "Dragon Slayer",
    description: "Defeat a dragon",
    emoji: "🐉",
    icon_color: "text-red-600",
    title_unlocked: "Dragon Slayer",
  },
  beloved_faction: {
    id: "beloved_faction",
    name: "Loved",
    description: "Reach +80 standing with any faction",
    emoji: "❤️",
    icon_color: "text-red-500",
    title_unlocked: "Honored Friend",
  },
  boss_defeated: {
    id: "boss_defeated",
    name: "Boss Hunter",
    description: "Defeat a boss-tier monster",
    emoji: "💀",
    icon_color: "text-orange-600",
    title_unlocked: "Monster Slayer",
  },
  quest_master: {
    id: "quest_master",
    name: "Quest Master",
    description: "Complete 5 quests or job postings",
    emoji: "📜",
    icon_color: "text-indigo-500",
    title_unlocked: "Quest Veteran",
  },
  master_skill: {
    id: "master_skill",
    name: "Master",
    description: "Master any skill to level 50+",
    emoji: "🎯",
    icon_color: "text-cyan-500",
    title_unlocked: "Skill Master",
  },
  explorer: {
    id: "explorer",
    name: "Explorer",
    description: "Visit all 7 zones",
    emoji: "🗺️",
    icon_color: "text-teal-500",
    title_unlocked: "World Explorer",
  },
  wealth_master: {
    id: "wealth_master",
    name: "Tycoon",
    description: "Accumulate 5000 gold",
    emoji: "💎",
    icon_color: "text-yellow-400",
    title_unlocked: "Wealthy Tycoon",
  },
};

export const TITLES = {
  "Novice Fighter": {
    id: "novice_fighter",
    name: "Novice Fighter",
    description: "Won your first combat",
  },
  "Level 5 Champion": {
    id: "level_5_champion",
    name: "Level 5 Champion",
    description: "Reached level 5",
  },
  "Seasoned Warrior": {
    id: "seasoned_warrior",
    name: "Seasoned Warrior",
    description: "Reached level 10",
  },
  "Dragon Slayer": {
    id: "dragon_slayer",
    name: "Dragon Slayer",
    description: "Defeated a mighty dragon",
  },
  "Specialist": {
    id: "specialist",
    name: "Specialist",
    description: "Specialized in skill trees",
  },
  "Wealthy Trader": {
    id: "wealthy_trader",
    name: "Wealthy Trader",
    description: "Accumulated vast wealth",
  },
  "Honored Friend": {
    id: "honored_friend",
    name: "Honored Friend",
    description: "Earned the love of a faction",
  },
  "Monster Slayer": {
    id: "monster_slayer",
    name: "Monster Slayer",
    description: "Defeated a boss-tier monster",
  },
  "Quest Veteran": {
    id: "quest_veteran",
    name: "Quest Veteran",
    description: "Completed many quests",
  },
  "Skill Master": {
    id: "skill_master",
    name: "Skill Master",
    description: "Mastered a skill to level 50+",
  },
  "World Explorer": {
    id: "world_explorer",
    name: "World Explorer",
    description: "Visited all zones of the world",
  },
  "Wealthy Tycoon": {
    id: "wealthy_tycoon",
    name: "Wealthy Tycoon",
    description: "Accumulated massive wealth",
  },
};

export function checkAchievements(character, previousCharacter = null) {
  const unlocked = character.achievements || [];
  const newAchievements = [];
  const newTitles = character.titles || [];

  // First Victory
  if (!unlocked.includes("first_victory") && character.xp > (previousCharacter?.xp || 0)) {
    const achievement = ACHIEVEMENTS.first_victory;
    newAchievements.push("first_victory");
    if (!newTitles.includes(achievement.title_unlocked)) {
      newTitles.push(achievement.title_unlocked);
    }
  }

  // Level 5
  if (!unlocked.includes("level_5") && (character.level || 1) >= 5) {
    newAchievements.push("level_5");
  }

  // Level 10
  if (!unlocked.includes("level_10") && (character.level || 1) >= 10) {
    newAchievements.push("level_10");
    if (!newTitles.includes("Seasoned Warrior")) {
      newTitles.push("Seasoned Warrior");
    }
  }

  // 1000 Gold
  if (!unlocked.includes("hoard_1000_gold") && (character.gold || 0) >= 1000) {
    newAchievements.push("hoard_1000_gold");
    if (!newTitles.includes("Wealthy Trader")) {
      newTitles.push("Wealthy Trader");
    }
  }

  // 5 Skill Unlocks
  const skillCount = (character.skill_tree_unlocked || []).length;
  if (!unlocked.includes("unlock_5_skills") && skillCount >= 5) {
    newAchievements.push("unlock_5_skills");
    if (!newTitles.includes("Specialist")) {
      newTitles.push("Specialist");
    }
  }

  // Beloved Faction
  const factionStanding = character.faction_standing || {};
  if (!unlocked.includes("beloved_faction") && Object.values(factionStanding).some(v => v >= 80)) {
    newAchievements.push("beloved_faction");
    if (!newTitles.includes("Honored Friend")) {
      newTitles.push("Honored Friend");
    }
  }

  if (newAchievements.length === 0) return null;

  return {
    achievements: [...unlocked, ...newAchievements],
    titles: newTitles,
  };
}

export function getAchievementProgress(character) {
  const unlocked = character.achievements || [];
  const total = Object.keys(ACHIEVEMENTS).length;
  return {
    unlocked: unlocked.length,
    total,
    percentage: Math.floor((unlocked.length / total) * 100),
  };
}