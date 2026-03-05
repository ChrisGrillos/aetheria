import { getMovementCollisionSnapshot } from "./movementAuthority";

/**
 * EngineAdapterIntent
 * @typedef {{
 *   move?: { from: {x:number,y:number}, to: {x:number,y:number} },
 *   sprint?: { active: boolean, runEnergy: number },
 *   target?: { id: string, type: "monster"|"npc"|"player"|null },
 *   combatIntent?: { hand: "left"|"right", intentType: "swing"|"shield_bash"|"ability_cast", mouseVector: {x:number,y:number}, abilityId?: string },
 *   hotbarUse?: { slot: number, abilityId?: string }
 * }} EngineAdapterIntent
 */

/**
 * EngineAdapterState
 * @typedef {{
 *   actorStates: Array<{ id: string, type: string, x: number, y: number, hp?: number, energy?: number }>,
 *   targetState: { id: string|null, type: string|null },
 *   combatState: { active: boolean, sessionId?: string|null, inRange?: boolean, distanceToTarget?: number },
 *   worldCollisionVersion: { staticVersion: string, dynamicVersion: number }
 * }} EngineAdapterState
 */

export function createEngineAdapterState({
  myCharacter,
  allCharacters = [],
  monsters = [],
  activeTarget = null,
  combatSession = null,
}) {
  const collision = getMovementCollisionSnapshot();
  const actorStates = [
    ...allCharacters.map((c) => ({
      id: c.id,
      type: c.type || "character",
      x: Number(c.x || 0),
      y: Number(c.y || 0),
      hp: c.hp,
      energy: c.energy,
    })),
    ...monsters.map((m) => ({
      id: m.id,
      type: "monster",
      x: Number(m.x || 0),
      y: Number(m.y || 0),
      hp: m.hp,
      energy: m.energy,
    })),
  ];

  if (myCharacter?.id && !actorStates.find((a) => a.id === myCharacter.id)) {
    actorStates.push({
      id: myCharacter.id,
      type: myCharacter.type || "character",
      x: Number(myCharacter.x || 0),
      y: Number(myCharacter.y || 0),
      hp: myCharacter.hp,
      energy: myCharacter.energy,
    });
  }

  return {
    actorStates,
    targetState: {
      id: activeTarget?.entity?.id || null,
      type: activeTarget?.type || null,
    },
    combatState: {
      active: !!combatSession?.active || combatSession?.status === "active",
      sessionId: combatSession?.id || null,
      inRange: combatSession?.in_range,
      distanceToTarget: combatSession?.distance_to_target,
    },
    worldCollisionVersion: {
      staticVersion: collision.staticVersion,
      dynamicVersion: collision.dynamicVersion,
    },
  };
}

export function pushReplayFrame(replay, frame) {
  const next = [...(Array.isArray(replay) ? replay : []), frame];
  return next.slice(-300);
}
