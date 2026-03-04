/**
 * VAELRATH — Expanded Skills System
 * Three skill categories: Adventuring, Combat Disciplines, World/Craft/Trade
 */

// ─── ADVENTURING / CORE SKILLS ────────────────────────────────────────────────

export const ADVENTURING_SKILLS = [
  { id: "athletics",      name: "Athletics",      linkedAttr: "strength",     desc: "Running, climbing, jumping, swimming" },
  { id: "acrobatics",     name: "Acrobatics",     linkedAttr: "dexterity",    desc: "Balance, tumbling, falling, dodging" },
  { id: "stealth",        name: "Stealth",        linkedAttr: "dexterity",    desc: "Sneaking, hiding, moving unseen" },
  { id: "sleight_of_hand",name: "Sleight of Hand",linkedAttr: "dexterity",    desc: "Picking locks, disarming traps, pickpocketing" },
  { id: "perception",     name: "Perception",     linkedAttr: "wisdom",       desc: "Spotting details, tracking, searching" },
  { id: "insight",        name: "Insight",        linkedAttr: "wisdom",       desc: "Reading intentions, detecting lies" },
  { id: "survival",       name: "Survival",       linkedAttr: "wisdom",       desc: "Tracking, finding food, weathering elements" },
  { id: "investigation",  name: "Investigation",  linkedAttr: "intelligence", desc: "Analyzing clues, deduction, research" },
  { id: "arcana",         name: "Arcana",         linkedAttr: "intelligence", desc: "Knowledge of magic, spells, magical theory" },
  { id: "history",        name: "History",        linkedAttr: "intelligence", desc: "Knowledge of past events and lore" },
  { id: "nature",         name: "Nature",         linkedAttr: "intelligence", desc: "Knowledge of beasts, plants, weather" },
  { id: "religion",       name: "Religion",       linkedAttr: "intelligence", desc: "Knowledge of faiths, theology, divine lore" },
  { id: "medicine",       name: "Medicine",       linkedAttr: "wisdom",       desc: "Healing wounds, diagnosing illness" },
  { id: "animal_handling",name: "Animal Handling",linkedAttr: "wisdom",       desc: "Calming and training animals" },
  { id: "persuasion",     name: "Persuasion",     linkedAttr: "charisma",     desc: "Convincing others, diplomacy, negotiation" },
  { id: "deception",      name: "Deception",      linkedAttr: "charisma",     desc: "Lying, disguise, bluffing" },
  { id: "intimidation",   name: "Intimidation",   linkedAttr: "charisma",     desc: "Threatening, coercing, bullying" },
  { id: "performance",    name: "Performance",    linkedAttr: "charisma",     desc: "Acting, music, dancing, entertaining" },
];

// ─── COMBAT DISCIPLINES ──────────────────────────────────────────────────────

export const COMBAT_DISCIPLINES = [
  { id: "one_handed",     name: "One-Handed Weapons", linkedAttr: "strength",  desc: "Swords, axes, maces—single hand" },
  { id: "two_handed",     name: "Two-Handed Weapons", linkedAttr: "strength",  desc: "Greatswords, halberds, mauls" },
  { id: "dual_wielding",  name: "Dual Wielding",      linkedAttr: "dexterity", desc: "Fighting with weapon in each hand" },
  { id: "polearms",       name: "Polearms",           linkedAttr: "strength",  desc: "Spears, pikes, halberds" },
  { id: "shields",        name: "Shields",            linkedAttr: "strength",  desc: "Shield use, blocking, defense" },
  { id: "archery",        name: "Archery",            linkedAttr: "dexterity", desc: "Bows, crossbows, precision ranged" },
  { id: "throwing",       name: "Throwing",           linkedAttr: "dexterity", desc: "Knives, axes, grenades, projectiles" },
  { id: "unarmed",        name: "Unarmed Combat",     linkedAttr: "dexterity", desc: "Fists, grappling, martial arts" },
  { id: "heavy_armor",    name: "Heavy Armor",        linkedAttr: "constitution", desc: "Plate, full armor—strength and endurance" },
  { id: "light_armor",    name: "Light Armor",        linkedAttr: "dexterity",    desc: "Leather, chain—mobility and protection" },
  { id: "evasion",        name: "Evasion",            linkedAttr: "dexterity",    desc: "Dodging attacks, reflexes" },
  { id: "tactics",        name: "Tactics",            linkedAttr: "intelligence", desc: "Battle strategy, positioning, coordination" },
];

// ─── WORLD / CRAFT / TRADE ───────────────────────────────────────────────────

export const WORLD_CRAFT_SKILLS = [
  { id: "gathering",      name: "Gathering",      linkedAttr: "wisdom",     desc: "Harvesting plants and resources" },
  { id: "mining",         name: "Mining",         linkedAttr: "strength",   desc: "Extracting ore and stone" },
  { id: "logging",        name: "Logging",        linkedAttr: "strength",   desc: "Harvesting timber" },
  { id: "foraging",       name: "Foraging",       linkedAttr: "wisdom",     desc: "Finding food, herbs, mushrooms in the wild" },
  { id: "fishing",        name: "Fishing",        linkedAttr: "wisdom",     desc: "Catching fish and aquatic resources" },
  { id: "crafting",       name: "Crafting",       linkedAttr: "dexterity",  desc: "General crafting and item creation" },
  { id: "smithing",       name: "Smithing",       linkedAttr: "strength",   desc: "Forging weapons and armor" },
  { id: "carpentry",      name: "Carpentry",      linkedAttr: "dexterity",  desc: "Working wood into tools and furniture" },
  { id: "tailoring",      name: "Tailoring",      linkedAttr: "dexterity",  desc: "Crafting cloth and leather goods" },
  { id: "alchemy",        name: "Alchemy",        linkedAttr: "intelligence", desc: "Brewing potions and magical concoctions" },
  { id: "enchanting",     name: "Enchanting",     linkedAttr: "intelligence", desc: "Infusing magic into items" },
  { id: "trading",        name: "Trading",        linkedAttr: "charisma",   desc: "Buying low, selling high, negotiating prices" },
  { id: "appraisal",      name: "Appraisal",      linkedAttr: "intelligence", desc: "Valuing items and detecting fakes" },
  { id: "leadership",     name: "Leadership",     linkedAttr: "charisma",   desc: "Commanding followers and inspiring allies" },
  { id: "diplomacy",      name: "Diplomacy",      linkedAttr: "charisma",   desc: "Negotiation, political intrigue, alliances" },
  { id: "research",       name: "Research",       linkedAttr: "intelligence", desc: "Studying lore, books, and ancient texts" },
  { id: "healing",        name: "Healing",        linkedAttr: "wisdom",     desc: "First aid, restoring health to allies" },
  { id: "navigation",     name: "Navigation",     linkedAttr: "intelligence", desc: "Finding paths, reading maps, wayfinding" },
  { id: "tracking",       name: "Tracking",       linkedAttr: "wisdom",     desc: "Following tracks and trails" },
];

// ─── SKILL CATEGORIES ─────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = {
  adventuring: { label: "Adventuring & Core", skills: ADVENTURING_SKILLS },
  combat:      { label: "Combat Disciplines", skills: COMBAT_DISCIPLINES },
  world_craft: { label: "World / Craft / Trade", skills: WORLD_CRAFT_SKILLS },
};

// ─── UTILITY ──────────────────────────────────────────────────────────────────

export const ALL_SKILLS = [...ADVENTURING_SKILLS, ...COMBAT_DISCIPLINES, ...WORLD_CRAFT_SKILLS];

export function getSkillById(skillId) {
  return ALL_SKILLS.find(s => s.id === skillId);
}

export function getSkillsByCategory(categoryId) {
  return SKILL_CATEGORIES[categoryId]?.skills || [];
}

export function getLinkedAttribute(skillId) {
  const skill = getSkillById(skillId);
  return skill?.linkedAttr || "wisdom";
}