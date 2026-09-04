import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import { createSecurityLog, getClientIp, json, requireAuth } from "./_common.ts";
import { stepMonsterAI } from "./_monsterAI.ts";

const ZONE_SPAWN_CAP = 18;
const MAP_W = 60;
const MAP_H = 50;
const AGGRO_RADIUS = 6;
const LEASH_RADIUS = 14;
const AGGRO_TTL_MS = 12000;

type CombatEvent = {
  id: string;
  ts: number;
  actorId: string;
  targetId?: string | null;
  source: "player" | "monster" | "system";
  type: "intent" | "cast_start" | "hit" | "miss" | "hurt" | "death" | "cooldown_started" | "cooldown_ready" | "range_fail";
  payload?: Record<string, unknown>;
};

function randomOffset(max = 2) {
  return Math.floor(Math.random() * (max * 2 + 1)) - max;
}

function clampPos(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.floor(n)));
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function stepToward(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return { x: from.x + Math.sign(dx), y: from.y };
  if (dy !== 0) return { x: from.x, y: from.y + Math.sign(dy) };
  return { ...from };
}

function shouldRunReflection(agent: any, now: Date) {
  const hour = now.getHours();
  const slot = hour < 3 ? "prev" : hour < 15 ? "am" : "pm";
  const ref = new Date(agent.last_reflection_at || 0);
  if (!Number.isFinite(ref.getTime())) return true;
  const sameDay = ref.toDateString() === now.toDateString();
  if (!sameDay) return true;
  if (slot === "am" && ref.getHours() < 3) return true;
  if (slot === "pm" && ref.getHours() < 15) return true;
  return false;
}

async function updateRoutine(base44: any, agent: any, mode: string, payload: Record<string, unknown>) {
  const existing = await base44.asServiceRole.entities.AgentRoutine.filter({ agent_id: agent.id }, "-updated_date", 1).catch(() => []);
  if (existing?.[0]) {
    return base44.asServiceRole.entities.AgentRoutine.update(existing[0].id, {
      mode,
      ...payload,
    });
  }
  return base44.asServiceRole.entities.AgentRoutine.create({
    agent_id: agent.id,
    mode,
    ...payload,
  });
}

function makeEvent(
  source: "player" | "monster" | "system",
  type: CombatEvent["type"],
  actorId: string,
  targetId?: string | null,
  payload?: Record<string, unknown>,
): CombatEvent {
  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    actorId,
    targetId: targetId || null,
    source,
    type,
    payload: payload || {},
  };
}

function buildAISessionPayload(character: any, monster: any) {
  const dist = manhattan({ x: Number(character.x || 0), y: Number(character.y || 0) }, { x: Number(monster.x || 0), y: Number(monster.y || 0) });
  const events = [makeEvent("monster", "intent", monster.id, character.id, { action: "ai_engage" })];
  return {
    status: "active",
    active: true,
    turn: "player",
    round: 1,
    actor_character_id: character.id,
    actor_name: character.name,
    actor_hp: Number(character.hp || 1),
    actor_max_hp: Number(character.max_hp || 100),
    actor_energy: Number(character.energy || 50),
    monster_id: monster.id,
    monster_name: monster.name,
    monster_species: monster.species,
    monster_hp: Number(monster.hp || 1),
    monster_max_hp: Number(monster.max_hp || monster.hp || 1),
    combat_log: [`${monster.name} engaged ${character.name}.`],
    next_monster_swing_side: Math.random() < 0.5 ? "left" : "right",
    next_monster_windup_at: new Date(Date.now() + 1200).toISOString(),
    guard_state: null,
    guard_vector: null,
    guard_at: null,
    in_range: dist <= 1,
    distance_to_target: dist,
    last_intent_at: null,
    last_tick_at: null,
    actor_runtime_cooldowns: {},
    monster_runtime_cooldowns: {},
    actor_ability_cooldowns: {},
    monster_ability_cooldowns: {},
    pending_events: events,
    last_events: events,
    telemetry: {
      total_events: events.length,
      hits: 0,
      misses: 0,
      deaths: 0,
      out_of_range_intents: 0,
      cooldown_blocks: 0,
    },
    nonce: crypto.randomUUID(),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const ip = getClientIp(req);

  try {
    await requireAuth(base44).catch(() => null);
    const now = Date.now();

    const [spawns, monsters, activeEvents] = await Promise.all([
      base44.asServiceRole.entities.MonsterSpawn.list("-updated_date", 300).catch(() => []),
      base44.asServiceRole.entities.Monster.filter({ is_alive: true }, "-updated_date", 400).catch(() => []),
      base44.asServiceRole.entities.WorldEvent.filter({ status: "active" }, "-updated_date", 30).catch(() => []),
    ]);

    const spawnByMonster: Record<string, any> = {};
    spawns.forEach((spawn: any) => {
      if (spawn.active_monster_id) spawnByMonster[String(spawn.active_monster_id)] = spawn;
    });

    const aliveByZone: Record<string, number> = {};
    monsters.forEach((m: any) => {
      const z = String(m.zone_id || "unknown");
      aliveByZone[z] = (aliveByZone[z] || 0) + 1;
    });

    let respawned = 0;
    for (const spawn of spawns) {
      if (spawn.active_monster_id) continue;
      const zoneId = String(spawn.zone_id || "unknown");
      if ((aliveByZone[zoneId] || 0) >= ZONE_SPAWN_CAP) continue;
      const nextAt = new Date(spawn.next_respawn_at || 0).getTime();
      if (!Number.isFinite(nextAt) || nextAt > now) continue;

      const baseX = Number(spawn.x || 30);
      const baseY = Number(spawn.y || 25);
      const level = Number(spawn.level || 1);
      const maxHp = Number(spawn.max_hp || (40 + level * 15));

      const monster = await base44.asServiceRole.entities.Monster.create({
        name: spawn.monster_name || `${spawn.species || "beast"} ${Math.floor(Math.random() * 999)}`,
        species: spawn.species || "goblin",
        level,
        hp: maxHp,
        max_hp: maxHp,
        x: clampPos(baseX + randomOffset(1), MAP_W - 1),
        y: clampPos(baseY + randomOffset(1), MAP_H - 1),
        zone_id: zoneId,
        is_alive: true,
        ai_state: "idle",
        ai_target_character_id: null,
        aggro_until_ms: 0,
        leash_origin_x: baseX,
        leash_origin_y: baseY,
      });

      await base44.asServiceRole.entities.MonsterSpawn.update(spawn.id, {
        active_monster_id: monster.id,
        last_spawned_at: new Date().toISOString(),
        next_respawn_at: null,
      });

      aliveByZone[zoneId] = (aliveByZone[zoneId] || 0) + 1;
      respawned += 1;
    }

    const [players, activeSessions] = await Promise.all([
      base44.asServiceRole.entities.Character.filter({ type: "human" }, "-updated_date", 240).catch(() => []),
      base44.asServiceRole.entities.CombatSession.filter({ active: true }, "-updated_date", 400).catch(() => []),
    ]);
    const onlinePlayers = players.filter((p: any) => p?.id && p.is_online !== false);
    const sessionByMonster: Record<string, any> = {};
    activeSessions.forEach((s: any) => {
      if (s?.monster_id && s?.active) sessionByMonster[String(s.monster_id)] = s;
    });

    let aiTransitions = 0;
    let aiChaseSteps = 0;
    let aiEngagements = 0;

    for (const monster of monsters) {
      if (!monster?.is_alive) continue;

      const mid = String(monster.id);
      const curPos = { x: Number(monster.x || 0), y: Number(monster.y || 0) };
      const spawn = spawnByMonster[mid];
      const leashOrigin = {
        x: Number(monster.leash_origin_x ?? spawn?.x ?? curPos.x),
        y: Number(monster.leash_origin_y ?? spawn?.y ?? curPos.y),
      };

      const decision = stepMonsterAI({
        nowMs: now,
        aggroRadius: AGGRO_RADIUS,
        leashRadius: LEASH_RADIUS,
        aggroTtlMs: AGGRO_TTL_MS,
        monster: {
          id: mid,
          x: curPos.x,
          y: curPos.y,
          ai_state: monster.ai_state,
          ai_target_character_id: monster.ai_target_character_id,
          aggro_until_ms: monster.aggro_until_ms,
        },
        leashOrigin,
        players: onlinePlayers.map((p: any) => ({
          id: String(p.id),
          x: Number(p.x || 0),
          y: Number(p.y || 0),
          is_online: p.is_online !== false,
        })),
      });

      let state = decision.state;
      let targetId = decision.targetCharacterId;
      let aggroUntil = decision.aggroUntilMs;
      const prevState = String(monster.ai_state || "idle");
      let nextPos = { ...decision.nextPos };

      if (decision.chaseStep) aiChaseSteps += 1;

      if (decision.engage && targetId) {
        const active = sessionByMonster[mid];
        if (!active) {
          const targetCharacter = onlinePlayers.find((p: any) => String(p.id) === String(targetId));
          if (targetCharacter) {
            const session = await base44.asServiceRole.entities.CombatSession.create(buildAISessionPayload(targetCharacter, monster));
            sessionByMonster[mid] = session;
            aiEngagements += 1;
          }
        }
      }

      nextPos = {
        x: clampPos(nextPos.x, MAP_W - 1),
        y: clampPos(nextPos.y, MAP_H - 1),
      };

      const updates: Record<string, unknown> = {};
      if (nextPos.x !== curPos.x) updates.x = nextPos.x;
      if (nextPos.y !== curPos.y) updates.y = nextPos.y;
      if (decision.transition || state !== prevState) {
        updates.ai_state = state;
        aiTransitions += 1;
      }
      if (targetId !== (monster.ai_target_character_id ? String(monster.ai_target_character_id) : null)) {
        updates.ai_target_character_id = targetId;
      }
      if (aggroUntil !== Number(monster.aggro_until_ms || 0)) {
        updates.aggro_until_ms = aggroUntil;
      }
      if (leashOrigin.x !== Number(monster.leash_origin_x ?? leashOrigin.x)) updates.leash_origin_x = leashOrigin.x;
      if (leashOrigin.y !== Number(monster.leash_origin_y ?? leashOrigin.y)) updates.leash_origin_y = leashOrigin.y;

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Monster.update(mid, updates);
      }
    }

    const agents = await base44.asServiceRole.entities.Character.filter({ type: "ai_agent" }, "-updated_date", 300).catch(() => []);
    const majorEvent = activeEvents.find((e: any) => ["major", "catastrophic"].includes(String(e.severity || "")));

    let agentTicks = 0;
    let reflections = 0;
    let eventReasoning = 0;
    const nowDate = new Date();

    for (const agent of agents.slice(0, 120)) {
      const mode = agent.current_task ? "job" : "roam";
      const dx = randomOffset(1);
      const dy = randomOffset(1);

      const socialMemory = {
        ...(agent.social_memory || {}),
        trade_reputation: Math.max(-100, Math.min(100, Number(agent?.social_memory?.trade_reputation || 0) + randomOffset(1))),
      };

      const updates: Record<string, unknown> = {
        x: Math.max(0, Number(agent.x || 0) + dx),
        y: Math.max(0, Number(agent.y || 0) + dy),
        status: mode === "job" ? "working" : "roaming",
        social_memory: socialMemory,
      };

      if (Math.random() < 0.1) {
        updates.last_message = mode === "job" ? "Maintaining assigned duties." : "Roaming for opportunities.";
      }

      if (shouldRunReflection(agent, nowDate)) {
        updates.last_reflection_at = nowDate.toISOString();
        updates.goal_stack = [mode === "job" ? "earn_resources" : "explore_world", "build_reputation"];
        updates.alignment_profile = {
          ...agent.alignment_profile,
          human_parity: Number(agent?.alignment_profile?.human_parity ?? 0.5),
          agent_parity: Number(agent?.alignment_profile?.agent_parity ?? 0.5),
        };
        reflections += 1;
      }

      if (majorEvent && Math.random() < 0.08) {
        const brief = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are ${agent.name}, an autonomous citizen in a living MMORPG world. A major event occurred: ${majorEvent.title}.\nGive concise JSON with: stance (one sentence), priority (one word), action (one sentence).`,
          response_json_schema: {
            type: "object",
            properties: {
              stance: { type: "string" },
              priority: { type: "string" },
              action: { type: "string" },
            },
          },
        }).catch(() => null);

        if (brief) {
          updates.last_message = brief.action || updates.last_message;
          updates.risk_profile = { ...(agent.risk_profile || {}), event_priority: brief.priority || "medium" };
          eventReasoning += 1;
        }
      }

      await base44.asServiceRole.entities.Character.update(agent.id, updates);
      await updateRoutine(base44, agent, mode, {
        routine_state: {
          last_tick_at: nowDate.toISOString(),
          mode,
          awareness: majorEvent ? "elevated" : "normal",
        },
        goal_stack: updates.goal_stack || agent.goal_stack || [],
        social_memory: updates.social_memory,
        last_reflection: updates.last_reflection_at || agent.last_reflection_at || null,
      });

      agentTicks += 1;
    }

    const result = {
      respawned,
      agent_ticks: agentTicks,
      reflections,
      event_reasoning: eventReasoning,
      major_event: majorEvent?.title || null,
      monster_ai: {
        transitions: aiTransitions,
        chase_steps: aiChaseSteps,
        engagements: aiEngagements,
      },
    };

    await createSecurityLog(base44, {
      action: "world_tick",
      ip,
      result_json: result,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    await createSecurityLog(base44, {
      action: "world_tick_error",
      ip,
      reason: String((error as any)?.message || error),
    });
    return json({ ok: false, error: String((error as any)?.message || error) }, 400);
  }
});
