/**
 * RACE DEFINITIONS — Phase 2
 * 
 * Six playable races with stat ranges, flavor, and class fit logic.
 * type="human" on Character entity remains the human PLAYER flag (vs ai_agent).
 * The separate optional `race` field holds the chosen race.
 */

export const RACES = {
  human: {
    id: "human",
    name: "Human",
    emoji: "🧑",
    portrait: "🧑‍⚔️",
    color: "amber",
    borderClass: "border-amber-600",
    bgClass: "bg-amber-900/20",
    description: "Adaptable and versatile. No peak strengths, no glaring weaknesses.",
    flavor: "Humanity's greatest strength is its boundless potential.",
    statRanges: {
      strength:     [8, 14],
      dexterity:    [8, 14],
      intelligence: [8, 14],
      wisdom:       [8, 14],
      constitution: [8, 14],
      charisma:     [8, 14],
    },
    racialTrait: "Adaptable: Balanced stats, no penalties",
    traitEmoji: "⚖️",
    classSuggestions: ["warrior", "hunter", "wizard", "merchant", "healer", "craftsman"],
  },
  elf: {
    id: "elf",
    name: "Elf",
    emoji: "🧝",
    portrait: "🧝‍♀️",
    color: "cyan",
    borderClass: "border-cyan-600",
    bgClass: "bg-cyan-900/20",
    description: "Nimble and perceptive. Born archers and mages, fragile in raw combat.",
    flavor: "The forest remembers what the cities forgot.",
    statRanges: {
      strength:     [6, 11],
      dexterity:    [11, 16],
      intelligence: [10, 15],
      wisdom:       [9, 14],
      constitution: [6, 11],
      charisma:     [8, 14],
    },
    racialTrait: "Keen Senses: +DEX, +INT lean; lighter build",
    traitEmoji: "🏹",
    classSuggestions: ["hunter", "wizard", "healer"],
  },
  dwarf: {
    id: "dwarf",
    name: "Dwarf",
    emoji: "⛏️",
    portrait: "🪨",
    color: "orange",
    borderClass: "border-orange-700",
    bgClass: "bg-orange-900/20",
    description: "Stocky and resilient. Exceptional soldiers and craftsmen.",
    flavor: "Stone endures. So do we.",
    statRanges: {
      strength:     [11, 16],
      dexterity:    [7, 12],
      intelligence: [7, 12],
      wisdom:       [8, 13],
      constitution: [12, 17],
      charisma:     [6, 11],
    },
    racialTrait: "Stout: +STR, +CON; slow but resilient",
    traitEmoji: "🛡️",
    classSuggestions: ["warrior", "craftsman", "fighter"],
  },
  halfling: {
    id: "halfling",
    name: "Halfling",
    emoji: "🍀",
    portrait: "🧙",
    color: "green",
    borderClass: "border-green-600",
    bgClass: "bg-green-900/20",
    description: "Small but surprisingly quick and lucky. Natural rogues and traders.",
    flavor: "Small feet, swift hands, and a quicker tongue.",
    statRanges: {
      strength:     [5, 10],
      dexterity:    [12, 17],
      intelligence: [8, 13],
      wisdom:       [9, 14],
      constitution: [8, 13],
      charisma:     [10, 15],
    },
    racialTrait: "Nimble: +DEX, +CHA lean; light evasion bonus",
    traitEmoji: "💨",
    classSuggestions: ["hunter", "merchant", "healer"],
  },
  orc: {
    id: "orc",
    name: "Orc",
    emoji: "💪",
    portrait: "👹",
    color: "red",
    borderClass: "border-red-700",
    bgClass: "bg-red-900/20",
    description: "Fearsome warriors with raw strength. Limited in subtlety and magic.",
    flavor: "The mountain does not step aside.",
    statRanges: {
      strength:     [12, 17],
      dexterity:    [7, 12],
      intelligence: [5, 10],
      wisdom:       [6, 11],
      constitution: [11, 16],
      charisma:     [4, 9],
    },
    racialTrait: "Brutish: +STR, +CON; weak in diplomacy and magic",
    traitEmoji: "⚔️",
    classSuggestions: ["warrior", "fighter"],
  },
  half_giant: {
    id: "half_giant",
    name: "Half Giant",
    emoji: "🏔️",
    portrait: "🗿",
    color: "purple",
    borderClass: "border-purple-700",
    bgClass: "bg-purple-900/20",
    description: "Enormous physical power and endurance. Poor social skills and magic.",
    flavor: "The earth shakes beneath their stride.",
    statRanges: {
      strength:     [14, 18],
      dexterity:    [5, 10],
      intelligence: [4, 9],
      wisdom:       [5, 10],
      constitution: [13, 18],
      charisma:     [4, 8],
    },
    racialTrait: "Colossal: Peak STR+CON; very limited INT/CHA/DEX",
    traitEmoji: "💥",
    classSuggestions: ["warrior", "fighter"],
  },
};

export const RACE_LIST = Object.values(RACES);

// ─── STAT ROLLING ─────────────────────────────────────────────────────────────

/**
 * Roll a single stat value within a min/max range.
 * Uses 3d6-drop-lowest style: rolls 4 values, drops the lowest, sums top 3,
 * then clamps to the race's range.
 */
function rollInRange(min, max) {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  rolls.sort((a, b) => a - b);
  const sum = rolls[1] + rolls[2] + rolls[3]; // Drop lowest
  // Map 3-18 range to race min-max
  const normalized = (sum - 3) / 15; // 0.0 to 1.0
  return Math.round(min + normalized * (max - min));
}

/**
 * Roll a full stat set for a given race ID.
 * Returns { strength, dexterity, intelligence, wisdom, constitution, charisma }
 */
export function rollStatsForRace(raceId) {
  const race = RACES[raceId];
  if (!race) return rollStatsForRace("human");

  const result = {};
  for (const [stat, [min, max]] of Object.entries(race.statRanges)) {
    result[stat] = rollInRange(min, max);
  }
  return result;
}

// ─── CLASS FIT ────────────────────────────────────────────────────────────────

const CLASS_STAT_WEIGHTS = {
  warrior:   { strength: 2.0, constitution: 1.5, dexterity: 0.5 },
  hunter:    { dexterity: 2.0, wisdom: 1.5, strength: 0.5 },
  healer:    { wisdom: 2.0, intelligence: 1.5, charisma: 0.5 },
  wizard:    { intelligence: 2.0, wisdom: 1.5 },
  magician:  { intelligence: 1.5, charisma: 2.0 },
  merchant:  { charisma: 2.0, intelligence: 1.5, wisdom: 0.5 },
  craftsman: { dexterity: 2.0, strength: 1.5, wisdom: 0.5 },
  fighter:   { strength: 1.5, constitution: 2.0, dexterity: 0.5 },
};

/** Returns "strong" | "viable" | "weak" */
export function getClassFit(stats, classId) {
  const weights = CLASS_STAT_WEIGHTS[classId] || {};
  let score = 0, maxScore = 0;
  for (const [stat, weight] of Object.entries(weights)) {
    score    += (stats[stat] || 10) * weight;
    maxScore += 16 * weight;
  }
  const pct = score / maxScore;
  if (pct >= 0.72) return "strong";
  if (pct >= 0.58) return "viable";
  return "weak";
}

/** Returns classes sorted by fit with fit label */
export function getAllClassFits(stats) {
  const classes = ["warrior", "hunter", "healer", "wizard", "magician", "merchant", "craftsman", "fighter"];
  return classes.map(id => ({ id, fit: getClassFit(stats, id) }));
}

// ─── RACE DEFAULTS ────────────────────────────────────────────────────────────

/** Safe lookup with fallback to human */
export function getRace(raceId) {
  return RACES[raceId] || RACES.human;
}