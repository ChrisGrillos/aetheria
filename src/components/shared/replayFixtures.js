import { createEngineAdapterState } from "./engineAdapterContracts";

export function createReplayFixture({
  myCharacter,
  allCharacters = [],
  monsters = [],
  activeTarget = null,
  combatSession = null,
}) {
  return {
    version: "adapter-v1",
    createdAt: new Date().toISOString(),
    frames: [
      {
        ts: Date.now(),
        intent: {},
        state: createEngineAdapterState({
          myCharacter,
          allCharacters,
          monsters,
          activeTarget,
          combatSession,
        }),
      },
    ],
  };
}

export const FIXED_COMBAT_EVENT_FIXTURES = {
  player_cast_hit_chain: [
    { id: "e1", ts: 1000, type: "intent", source: "player", actorId: "c1", targetId: "m1", payload: { intent: "ability_cast" } },
    { id: "e2", ts: 1010, type: "cast_start", source: "player", actorId: "c1", targetId: "m1", payload: { abilityId: "fireball" } },
    { id: "e3", ts: 1040, type: "hit", source: "player", actorId: "c1", targetId: "m1", payload: { abilityId: "fireball", damage: 24 } },
    { id: "e4", ts: 1042, type: "hurt", source: "player", actorId: "c1", targetId: "m1", payload: { damage: 24 } },
    { id: "e5", ts: 1048, type: "cooldown_started", source: "system", actorId: "c1", payload: { abilityId: "fireball", cooldownMs: 3000 } },
  ],
  cooldown_lifecycle: [
    { id: "c1", ts: 2000, type: "cooldown_started", source: "system", actorId: "c1", payload: { abilityId: "warrior_strike", cooldownMs: 1500 } },
    { id: "c2", ts: 3510, type: "cooldown_ready", source: "system", actorId: "c1", payload: { abilityId: "warrior_strike", source: "player" } },
  ],
  death_chain: [
    { id: "d1", ts: 3000, type: "hit", source: "player", actorId: "c1", targetId: "m1", payload: { damage: 30 } },
    { id: "d2", ts: 3002, type: "hurt", source: "player", actorId: "c1", targetId: "m1", payload: { damage: 30 } },
    { id: "d3", ts: 3008, type: "death", source: "player", actorId: "c1", targetId: "m1", payload: { reason: "monster_defeated" } },
  ],
};

export const FIXED_MONSTER_AI_FIXTURES = {
  engage_then_leash: {
    start: { state: "idle", x: 10, y: 10, targetId: null, aggroUntilMs: 0 },
    players: [
      { id: "p1", x: 13, y: 10, is_online: true },
      { id: "p2", x: 35, y: 35, is_online: true },
    ],
    leashOrigin: { x: 10, y: 10 },
  },
};
