/**
 * Quest system helpers for in-world NPC interactions.
 *
 * Runtime interfaces:
 * InteractionTarget = { id, type: "monster"|"npc"|"player", x, y, poiId? }
 * QuestOffer = { questId, sourceNpcId, title, summary, objectives[], rewards[] }
 * CharacterQuestState = { questId, status, objectivesProgress, acceptedAt, completedAt }
 */

export const NPC_INTERACTION_PROFILES = {
  trader: {
    name: "Free Spears Trader",
    greeting: "Got wares and rumors. Trade fairly and we both leave richer.",
    followUp: "Ask for prices or local rumors.",
  },
  merchant: {
    name: "Traveling Merchant",
    greeting: "Welcome, traveler. Supplies are fresh and cheap if you're polite.",
    followUp: "I can sell basics or point you toward work.",
  },
  herbalist: {
    name: "Lantern Herbalist",
    greeting: "The marsh and woods are alive tonight. Herb bundles are ready.",
    followUp: "Bring me wild herbs and I will reward you.",
  },
  healer: {
    name: "Shrine Healer",
    greeting: "You look battle-worn. The Creed heals those who still stand.",
    followUp: "Need aid or a blessing?",
  },
  quest_giver: {
    name: "Town Elder",
    greeting: "You look capable. I have urgent work that needs doing.",
    followUp: "Hear the details and decide if you'll take it.",
  },
  miner: {
    name: "Iron Oath Miner",
    greeting: "Ore veins are unstable. We need hands that can fight and haul.",
    followUp: "I pay in coin and iron.",
  },
  farmer: {
    name: "Ashfield Farmer",
    greeting: "Fields are under pressure and bandits keep circling.",
    followUp: "Help secure the harvest and you'll be paid.",
  },
  witch: {
    name: "Fen Witch",
    greeting: "The fen whispers your name. Nothing is free, including truth.",
    followUp: "Do a task, and I will share what the spirits showed me.",
  },
  spirit: {
    name: "Cinder Spirit",
    greeting: "Embers remember every oath. Speak yours.",
    followUp: "Feed the flame with action, not words.",
  },
};

export const HANDCRAFTED_QUEST_TEMPLATES = [
  {
    questId: "hb_supply_run_v1",
    sourceNpcType: "quest_giver",
    zoneId: "high_bastion",
    title: "Lantern Supply Run",
    summary: "Deliver emergency supplies and report back before nightfall.",
    objectives: [
      { id: "o1", type: "travel_steps", count: 12, description: "Travel through the district." },
      { id: "o2", type: "talk_npc", targetNpcType: "merchant", count: 1, description: "Speak with the merchant quartermaster." },
      { id: "o3", type: "talk_npc", targetNpcType: "quest_giver", count: 1, description: "Return to the Town Elder." },
    ],
    rewards: [
      { type: "xp", amount: 120 },
      { type: "gold", amount: 45 },
    ],
  },
  {
    questId: "ashen_wheat_guard_v1",
    sourceNpcType: "farmer",
    zoneId: "the_ashen_march",
    title: "Guard the Ashfield Harvest",
    summary: "Protect the grain routes and secure wheat for the town stores.",
    objectives: [
      { id: "o1", type: "gather_resource", targetResource: "wheat", count: 4, description: "Collect 4 wheat bundles." },
      { id: "o2", type: "travel_steps", count: 10, description: "Escort the route back." },
      { id: "o3", type: "talk_npc", targetNpcType: "farmer", count: 1, description: "Report to the farmer." },
    ],
    rewards: [
      { type: "xp", amount: 90 },
      { type: "gold", amount: 35 },
    ],
  },
  {
    questId: "deep_ore_contract_v1",
    sourceNpcType: "miner",
    zoneId: "kharum_deep",
    title: "Iron Oath Contract",
    summary: "Mine ore and clear threats near the mountain pass.",
    objectives: [
      { id: "o1", type: "gather_resource", targetResource: "iron_ore", count: 3, description: "Gather 3 iron ore." },
      { id: "o2", type: "kill_monster", targetSpecies: "troll", count: 1, description: "Defeat a pass troll." },
      { id: "o3", type: "talk_npc", targetNpcType: "miner", count: 1, description: "Return to the miner." },
    ],
    rewards: [
      { type: "xp", amount: 150 },
      { type: "gold", amount: 60 },
    ],
  },
];

export function pickHandcraftedQuest({ npcType, zoneId, completedQuestIds = [] }) {
  return HANDCRAFTED_QUEST_TEMPLATES.find((q) => {
    const sourceMatch = q.sourceNpcType === npcType;
    const zoneMatch = !q.zoneId || q.zoneId === zoneId;
    const notDone = !completedQuestIds.includes(q.questId);
    return sourceMatch && zoneMatch && notDone;
  }) || null;
}

function fallbackDynamicQuest({ npcType, zoneName = "the frontier" }) {
  const profile = NPC_INTERACTION_PROFILES[npcType] || NPC_INTERACTION_PROFILES.merchant;
  const key = `${npcType}_${Date.now()}`;

  return {
    questId: `side_${key}`,
    sourceNpcType: npcType,
    title: `${profile.name} Request`,
    summary: `Help ${profile.name} resolve a local issue around ${zoneName}.`,
    objectives: [
      { id: "o1", type: "travel_steps", count: 8, description: "Scout nearby routes." },
      { id: "o2", type: "talk_npc", targetNpcType: npcType, count: 1, description: `Report back to ${profile.name}.` },
    ],
    rewards: [
      { type: "xp", amount: 70 },
      { type: "gold", amount: 28 },
    ],
    isDynamic: true,
  };
}

function sanitizeObjective(obj, idx) {
  const t = obj?.type;
  if (!["travel_steps", "talk_npc", "kill_monster", "gather_resource", "visit_zone"].includes(t)) {
    return null;
  }
  return {
    id: obj?.id || `o${idx + 1}`,
    type: t,
    count: Math.max(1, Number(obj?.count || 1)),
    targetNpcType: obj?.targetNpcType || null,
    targetSpecies: obj?.targetSpecies || null,
    targetResource: obj?.targetResource || null,
    targetZoneId: obj?.targetZoneId || null,
    description: obj?.description || "Complete objective",
  };
}

export async function buildDynamicSideQuest({ npcType, zoneName, characterName, invokeLLM }) {
  if (!invokeLLM) return fallbackDynamicQuest({ npcType, zoneName });

  const prompt = `Create one MMO side quest as JSON only.
Return keys: title, summary, objectives, rewards.
Rules:
- objectives: 2 to 3 items
- objective type must be one of: travel_steps, talk_npc, kill_monster, gather_resource, visit_zone
- each objective has: id, type, count, optional targetNpcType/targetSpecies/targetResource/targetZoneId, description
- rewards array with type (xp|gold) and amount
Context: NPC type ${npcType}, zone ${zoneName}, player ${characterName}.`; 

  try {
    const raw = await invokeLLM({ prompt });
    const text = typeof raw === "string" ? raw : raw?.text || "";
    const parsed = JSON.parse(text);
    const objectives = (parsed.objectives || []).map(sanitizeObjective).filter(Boolean).slice(0, 3);
    if (!parsed.title || !parsed.summary || objectives.length < 2) {
      return fallbackDynamicQuest({ npcType, zoneName });
    }

    const rewards = (parsed.rewards || [])
      .filter((r) => ["xp", "gold"].includes(r?.type))
      .map((r) => ({ type: r.type, amount: Math.max(1, Number(r.amount || 1)) }));

    return {
      questId: `side_${npcType}_${Date.now()}`,
      sourceNpcType: npcType,
      title: parsed.title,
      summary: parsed.summary,
      objectives,
      rewards: rewards.length ? rewards : [{ type: "xp", amount: 60 }, { type: "gold", amount: 25 }],
      isDynamic: true,
    };
  } catch {
    return fallbackDynamicQuest({ npcType, zoneName });
  }
}

export async function buildQuestOffer({
  npc,
  zoneId,
  zoneName,
  completedQuestIds = [],
  characterName,
  invokeLLM,
}) {
  const handcrafted = pickHandcraftedQuest({ npcType: npc.npcType, zoneId, completedQuestIds });
  if (handcrafted) {
    return {
      ...handcrafted,
      sourceNpcId: npc.id || npc.poiId,
      sourceNpcName: npc.name || npc.poiName,
      zoneId,
      zoneName,
      mode: "handcrafted",
    };
  }

  const dynamic = await buildDynamicSideQuest({
    npcType: npc.npcType,
    zoneName,
    characterName,
    invokeLLM,
  });

  return {
    ...dynamic,
    sourceNpcId: npc.id || npc.poiId,
    sourceNpcName: npc.name || npc.poiName,
    zoneId,
    zoneName,
    mode: "dynamic",
  };
}

export function acceptQuestFromOffer(offer) {
  const objectivesProgress = {};
  (offer.objectives || []).forEach((o) => {
    objectivesProgress[o.id] = 0;
  });

  return {
    questId: offer.questId,
    sourceNpcId: offer.sourceNpcId,
    sourceNpcType: offer.sourceNpcType,
    title: offer.title,
    summary: offer.summary,
    objectives: offer.objectives || [],
    rewards: offer.rewards || [],
    objectivesProgress,
    status: "active",
    acceptedAt: new Date().toISOString(),
    completedAt: null,
    mode: offer.mode || "handcrafted",
  };
}

function objectiveMatch(obj, event) {
  switch (obj.type) {
    case "travel_steps":
      return event.type === "travel_step";
    case "talk_npc":
      return event.type === "talk_npc" && (!obj.targetNpcType || obj.targetNpcType === event.npcType);
    case "kill_monster":
      return event.type === "kill_monster" && (!obj.targetSpecies || obj.targetSpecies === event.species);
    case "gather_resource":
      return event.type === "gather_resource" && (!obj.targetResource || obj.targetResource === event.resource);
    case "visit_zone":
      return event.type === "visit_zone" && (!obj.targetZoneId || obj.targetZoneId === event.zoneId);
    default:
      return false;
  }
}

export function applyQuestEvent(quests, event) {
  let changed = false;
  const completedNow = [];

  const next = (quests || []).map((quest) => {
    if (quest.status !== "active") return quest;

    let questChanged = false;
    const progress = { ...(quest.objectivesProgress || {}) };

    for (const obj of quest.objectives || []) {
      if (!objectiveMatch(obj, event)) continue;
      const inc = event.amount && Number.isFinite(event.amount) ? event.amount : 1;
      const cur = Number(progress[obj.id] || 0);
      const nxt = Math.min(obj.count || 1, cur + inc);
      if (nxt !== cur) {
        progress[obj.id] = nxt;
        questChanged = true;
      }
    }

    const allComplete = (quest.objectives || []).every((obj) => Number(progress[obj.id] || 0) >= Number(obj.count || 1));
    if (allComplete) {
      changed = true;
      completedNow.push({ ...quest, objectivesProgress: progress });
      return {
        ...quest,
        objectivesProgress: progress,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
    }

    if (!questChanged) return quest;
    changed = true;
    return { ...quest, objectivesProgress: progress };
  });

  return {
    changed,
    quests: changed ? next : quests,
    completedNow,
  };
}
