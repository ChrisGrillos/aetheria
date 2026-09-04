import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";
import { calcAttackDamage, monsterCombatStats, playerCombatStats, xpReward, goldReward } from "./_combatCore.ts";
import {
  assertAllowedKeys,
  createSecurityLog,
  findIdempotentResult,
  getClientIp,
  json,
  mustString,
  pickCombatAbility,
  readJson,
  requireAuth,
} from "./_common.ts";

const VALID_ACTIONS = new Set(["start", "intent", "tick", "sync", "retreat"]);
const VALID_INTENTS = new Set([
  "swing_left",
  "swing_right",
  "guard_left",
  "guard_right",
  "feint",
  "ability_cast",
  "attack",
  "retreat",
]);

const MONSTER_SWING_COOLDOWN_MS = 1200;

type CombatEvent = {
  id: string;
  ts: number;
  actorId: string;
  targetId?: string | null;
  source: "player" | "monster" | "system";
  type: "intent" | "cast_start" | "hit" | "miss" | "hurt" | "death" | "cooldown_started" | "cooldown_ready" | "range_fail";
  payload?: Record<string, unknown>;
};

type CooldownMap = Record<string, number>;

function normalizeVec(input: any) {
  const x = Number(input?.x || 0);
  const y = Number(input?.y || 0);
  const mag = Math.sqrt((x * x) + (y * y));
  if (!Number.isFinite(mag) || mag <= 0.0001) return { x: 0, y: 0 };
  return { x: x / mag, y: y / mag };
}

function sideFromIntent(intent: string) {
  if (intent.includes("left")) return "left";
  if (intent.includes("right")) return "right";
  return null;
}

function expectedSideVec(side: string) {
  return side === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

function angleBonus(side: string, vec: { x: number; y: number }) {
  if (!side) return 0;
  const expected = expectedSideVec(side);
  const dot = (vec.x * expected.x) + (vec.y * expected.y);
  if (dot >= 0.8) return 0.2;
  if (dot >= 0.5) return 0.1;
  if (dot <= -0.2) return -0.12;
  return 0;
}

function distanceInfo(character: any, monster: any) {
  const dx = Math.abs(Number(character?.x || 0) - Number(monster?.x || 0));
  const dy = Math.abs(Number(character?.y || 0) - Number(monster?.y || 0));
  const distance = Math.sqrt((dx * dx) + (dy * dy));
  return { inRange: distance <= 1.45, distance: Number(distance.toFixed(3)) };
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

function toCooldownMap(raw: any): CooldownMap {
  if (!raw || typeof raw !== "object") return {};
  const out: CooldownMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

function pruneCooldownsAndEmitReady(
  map: CooldownMap,
  nowMs: number,
  events: CombatEvent[],
  source: "player" | "monster",
  ownerId: string,
) {
  const next: CooldownMap = {};
  for (const [key, readyAt] of Object.entries(map)) {
    if (readyAt > nowMs) {
      next[key] = readyAt;
      continue;
    }
    const abilityId = key.includes(":") ? key.split(":").slice(1).join(":") : key;
    events.push(
      makeEvent("system", "cooldown_ready", ownerId, null, {
        source,
        abilityId,
      }),
    );
  }
  return next;
}

function cooldownRemaining(map: CooldownMap, nowMs: number, prefix: string) {
  const out: Record<string, number> = {};
  for (const [key, readyAt] of Object.entries(map)) {
    if (!key.startsWith(prefix) || readyAt <= nowMs) continue;
    const abilityId = key.slice(prefix.length);
    out[abilityId] = Math.max(0, Math.floor(readyAt - nowMs));
  }
  return out;
}

function bumpTelemetry(base: any, events: CombatEvent[]) {
  const nowMs = Date.now();
  const prevAt = Number(base?.last_event_at_ms || 0);
  const dtMs = prevAt > 0 ? Math.max(1, nowMs - prevAt) : 1000;
  const telemetry = {
    total_events: Number(base?.total_events || 0),
    hits: Number(base?.hits || 0),
    misses: Number(base?.misses || 0),
    deaths: Number(base?.deaths || 0),
    out_of_range_intents: Number(base?.out_of_range_intents || 0),
    cooldown_blocks: Number(base?.cooldown_blocks || 0),
    events_per_sec: Number(base?.events_per_sec || 0),
    last_event_at_ms: nowMs,
  };
  events.forEach((ev) => {
    telemetry.total_events += 1;
    if (ev.type === "hit") telemetry.hits += 1;
    if (ev.type === "miss") telemetry.misses += 1;
    if (ev.type === "death") telemetry.deaths += 1;
    if (ev.type === "range_fail") telemetry.out_of_range_intents += 1;
    if (ev.type === "miss" && String(ev.payload?.reason || "") === "cooldown") telemetry.cooldown_blocks += 1;
  });
  telemetry.events_per_sec = Number((events.length * (1000 / dtMs)).toFixed(3));
  return telemetry;
}

function buildSessionPayload(character: any, monster: any, events: CombatEvent[]) {
  const nextSide = Math.random() < 0.5 ? "left" : "right";
  const range = distanceInfo(character, monster);
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
    effects: [],
    combat_log: ["Combat engaged."],
    next_monster_swing_side: nextSide,
    next_monster_windup_at: new Date(Date.now() + 1200).toISOString(),
    guard_state: null,
    guard_vector: null,
    guard_at: null,
    in_range: range.inRange,
    distance_to_target: range.distance,
    last_intent_at: null,
    last_tick_at: null,
    actor_runtime_cooldowns: {},
    monster_runtime_cooldowns: {},
    actor_ability_cooldowns: {},
    monster_ability_cooldowns: {},
    pending_events: events,
    last_events: events,
    telemetry: bumpTelemetry({}, events),
    nonce: crypto.randomUUID(),
  };
}

function isShieldOffhand(character: any) {
  return !!character?.equipment?.shield;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const ip = getClientIp(req);

  try {
    const user = await requireAuth(base44);
    const payload = await readJson(req) as Record<string, unknown>;
    assertAllowedKeys(payload, [
      "action",
      "session_id",
      "character_id",
      "monster_id",
      "ability_id",
      "intent",
      "hand",
      "intent_type",
      "mouse_vector",
      "guard_vector",
      "timestamp",
      "idempotency_key",
    ]);

    const action = mustString(payload.action, "action");
    if (!VALID_ACTIONS.has(action)) throw new Error("Invalid action");

    const idempotencyKey = typeof payload.idempotency_key === "string" ? payload.idempotency_key : undefined;
    const previous = await findIdempotentResult(base44, user.id, "combat_action_success", idempotencyKey);
    if (previous?.result_json) return json({ ok: true, replay: true, ...previous.result_json });

    if (action === "start") {
      const characterId = mustString(payload.character_id, "character_id");
      const monsterId = mustString(payload.monster_id, "monster_id");
      const [character, monster] = await Promise.all([
        base44.asServiceRole.entities.Character.get(characterId),
        base44.asServiceRole.entities.Monster.get(monsterId),
      ]);
      if (!character || character.created_by !== user.email) throw new Error("Character ownership mismatch");
      if (!monster || !monster.is_alive) throw new Error("Monster unavailable");

      const range = distanceInfo(character, monster);
      if (!range.inRange) throw new Error("Target out of range");

      const events = [
        makeEvent("system", "intent", character.id, monster.id, { action: "start" }),
      ];
      const session = await base44.asServiceRole.entities.CombatSession.create(buildSessionPayload(character, monster, events));
      const result = {
        session,
        phase: "active",
        status: "active",
        events,
        telemetry: session.telemetry || bumpTelemetry({}, events),
        in_range: true,
        distance_to_target: range.distance,
      };

      await createSecurityLog(base44, {
        action: "combat_action_success",
        actor_user_id: user.id,
        actor_email: user.email,
        ip,
        idempotency_key: idempotencyKey,
        result_json: result,
      });
      return json({ ok: true, ...result });
    }

    const sessionId = mustString(payload.session_id, "session_id");
    const session = await base44.asServiceRole.entities.CombatSession.get(sessionId);
    if (!session) throw new Error("Combat session missing");

    const [character, monster] = await Promise.all([
      base44.asServiceRole.entities.Character.get(session.actor_character_id),
      base44.asServiceRole.entities.Monster.get(session.monster_id),
    ]);
    if (!character || character.created_by !== user.email) throw new Error("Character ownership mismatch");
    if (!monster) throw new Error("Monster missing");

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const range = distanceInfo(character, monster);

    if (action === "sync") {
      const events = Array.isArray(session.pending_events) ? [...session.pending_events] : [];
      const actorRuntime = pruneCooldownsAndEmitReady(
        toCooldownMap(session.actor_runtime_cooldowns),
        nowMs,
        events,
        "player",
        character.id,
      );
      const monsterRuntime = pruneCooldownsAndEmitReady(
        toCooldownMap(session.monster_runtime_cooldowns),
        nowMs,
        events,
        "monster",
        monster.id,
      );

      const telemetry = bumpTelemetry(session.telemetry || {}, events);
      const updated = await base44.asServiceRole.entities.CombatSession.update(sessionId, {
        in_range: range.inRange,
        distance_to_target: range.distance,
        active: session.status === "active",
        pending_events: [],
        last_events: events.slice(-40),
        actor_runtime_cooldowns: actorRuntime,
        monster_runtime_cooldowns: monsterRuntime,
        actor_ability_cooldowns: cooldownRemaining(actorRuntime, nowMs, "a:"),
        monster_ability_cooldowns: cooldownRemaining(monsterRuntime, nowMs, "m:"),
        telemetry,
      });
      return json({
        ok: true,
        session: updated,
        status: updated.status || "active",
        events,
        telemetry,
        in_range: range.inRange,
        distance_to_target: range.distance,
      });
    }

    if (action === "retreat") {
      const events = [
        makeEvent("system", "intent", character.id, monster.id, { action: "retreat" }),
      ];
      const telemetry = bumpTelemetry(session.telemetry || {}, events);
      const updated = await base44.asServiceRole.entities.CombatSession.update(sessionId, {
        status: "retreated",
        active: false,
        in_range: range.inRange,
        distance_to_target: range.distance,
        combat_log: [...(session.combat_log || []), "Player retreated."].slice(-80),
        last_intent: "retreat",
        last_intent_at: nowIso,
        pending_events: events,
        last_events: events,
        telemetry,
      });
      return json({ ok: true, session: updated, status: "retreated", events, telemetry });
    }

    if (session.status !== "active") throw new Error("Combat session is not active");

    const ts = Number(payload.timestamp || nowMs);
    if (Math.abs(nowMs - ts) > 8000) throw new Error("Invalid timing");

    const events: CombatEvent[] = [];
    const actorRuntime = pruneCooldownsAndEmitReady(
      toCooldownMap(session.actor_runtime_cooldowns),
      nowMs,
      events,
      "player",
      character.id,
    );
    const monsterRuntime = pruneCooldownsAndEmitReady(
      toCooldownMap(session.monster_runtime_cooldowns),
      nowMs,
      events,
      "monster",
      monster.id,
    );

    let actorHp = Number(session.actor_hp || character.hp || 1);
    let actorEnergy = Number(session.actor_energy || character.energy || 50);
    let monsterHp = Number(session.monster_hp || monster.hp || 1);
    const combatLog = Array.isArray(session.combat_log) ? [...session.combat_log] : [];

    let guardState = session.guard_state || null;
    let guardAt = session.guard_at || null;
    let guardVector = session.guard_vector || null;
    let status = "active";
    let reward: Record<string, number> = { xp: 0, gold: 0 };
    let didPlayerAttack = false;

    const playerStats = playerCombatStats(character);
    const monsterStats = monsterCombatStats(monster);

    if (action === "intent") {
      const intentRaw = String(payload.intent || "");
      if (!VALID_INTENTS.has(intentRaw)) throw new Error("Invalid intent");
      events.push(makeEvent("player", "intent", character.id, monster.id, { intent: intentRaw }));

      const lastIntentAt = new Date(session.last_intent_at || 0).getTime();
      if (Number.isFinite(lastIntentAt) && nowMs - lastIntentAt < 120) throw new Error("Action throttled");

      const mouseVec = normalizeVec(payload.mouse_vector);
      const guardVec = normalizeVec(payload.guard_vector || payload.mouse_vector);

      if (intentRaw === "guard_left" || intentRaw === "guard_right") {
        guardState = sideFromIntent(intentRaw);
        guardAt = nowIso;
        guardVector = guardVec;
        combatLog.push(`${character.name} holds ${guardState} guard.`);
      } else if (!range.inRange) {
        combatLog.push(`${character.name}'s attack missed: target out of range.`);
        events.push(makeEvent("system", "range_fail", character.id, monster.id, { reason: "out_of_range" }));
      } else {
        let ability = pickCombatAbility(character, typeof payload.ability_id === "string" ? payload.ability_id : undefined) || {
          id: "basic_attack",
          name: "Basic Attack",
          effect_type: "damage",
          effect_magnitude: 100,
          energy_cost: 0,
          cooldown_rounds: 0,
        };

        const intentType = String(payload.intent_type || "");
        const hand = String(payload.hand || "");
        const shouldShieldBash = intentRaw === "swing_left" && hand === "left" && (intentType === "shield_bash" || isShieldOffhand(character));
        if (shouldShieldBash) {
          ability = {
            ...ability,
            id: "shield_bash",
            name: "Shield Bash",
            effect_magnitude: 72,
            energy_cost: Math.max(0, Number(ability.energy_cost || 0) - 2),
            cooldown_rounds: 2,
          };
        }

        const abilityId = String(ability.id || "basic_attack");
        const cooldownKey = `a:${abilityId}`;
        const readyAt = Number(actorRuntime[cooldownKey] || 0);
        if (readyAt > nowMs) {
          const remainingMs = readyAt - nowMs;
          combatLog.push(`${ability.name} is cooling down (${Math.ceil(remainingMs / 1000)}s).`);
          events.push(makeEvent("system", "miss", character.id, monster.id, {
            reason: "cooldown",
            abilityId,
            remainingMs,
          }));
        } else {
          const cost = Number(ability.energy_cost || 0);
          if (actorEnergy < cost) throw new Error("Not enough energy");
          actorEnergy -= cost;

          const abilityCooldownMs = Math.max(0, Number(ability.cooldown_rounds || 0) * 1500);
          if (abilityCooldownMs > 0) {
            actorRuntime[cooldownKey] = nowMs + abilityCooldownMs;
            events.push(makeEvent("system", "cooldown_started", character.id, null, {
              abilityId,
              cooldownMs: abilityCooldownMs,
            }));
          }

          if (intentType === "ability_cast") {
            events.push(makeEvent("player", "cast_start", character.id, monster.id, { abilityId }));
          }

          if (intentRaw === "feint") {
            const feintDamage = Math.max(1, Math.floor((ability.effect_magnitude || 40) * 0.35));
            monsterHp = Math.max(0, monsterHp - feintDamage);
            combatLog.push(`${character.name} feinted and chipped ${monster.name} for ${feintDamage}.`);
            events.push(makeEvent("player", "hit", character.id, monster.id, { damage: feintDamage, abilityId, intent: intentRaw }));
            events.push(makeEvent("player", "hurt", character.id, monster.id, { damage: feintDamage }));
            didPlayerAttack = true;
          } else {
            const swingSide = sideFromIntent(intentRaw);
            const sideMult = swingSide ? (1 + angleBonus(swingSide, mouseVec)) : 1;
            const tuned = { ...ability, effect_magnitude: Math.max(1, Math.floor((ability.effect_magnitude || 100) * sideMult)) };
            const pHit = calcAttackDamage(playerStats, { ...monsterStats, hp: monsterHp }, tuned);
            if (pHit.evaded) {
              combatLog.push(`${monster.name} evaded ${ability.name}.`);
              events.push(makeEvent("player", "miss", character.id, monster.id, { reason: "evaded", abilityId, intent: intentRaw }));
            } else {
              monsterHp = Math.max(0, monsterHp - pHit.damage);
              const tag = shouldShieldBash ? " (Shield Bash)" : "";
              combatLog.push(`${character.name} ${intentRaw.replace("_", " ")} hit for ${pHit.damage}${pHit.isCrit ? " (CRIT)" : ""}${tag}.`);
              events.push(makeEvent("player", "hit", character.id, monster.id, {
                damage: pHit.damage,
                abilityId,
                intent: intentRaw,
                isCrit: !!pHit.isCrit,
              }));
              events.push(makeEvent("player", "hurt", character.id, monster.id, { damage: pHit.damage }));
              didPlayerAttack = true;
            }
          }
        }
      }
    }

    if (monsterHp <= 0) {
      status = "victory";
      reward = { xp: xpReward(monster), gold: goldReward(monster) };
      events.push(makeEvent("player", "death", character.id, monster.id, { reason: "monster_defeated" }));

      await base44.asServiceRole.entities.Monster.update(monster.id, {
        is_alive: false,
        hp: 0,
        respawn_at: new Date(nowMs + 15 * 60 * 1000).toISOString(),
        ai_state: "dead",
        ai_target_character_id: null,
      });
      await base44.asServiceRole.entities.Character.update(character.id, {
        xp: Number(character.xp || 0) + reward.xp,
        gold: Number(character.gold || 0) + reward.gold,
        energy: actorEnergy,
        hp: actorHp,
      });
      const spawn = await base44.asServiceRole.entities.MonsterSpawn.filter({ active_monster_id: monster.id }, "-updated_date", 1).catch(() => []);
      if (spawn[0]) {
        await base44.asServiceRole.entities.MonsterSpawn.update(spawn[0].id, {
          active_monster_id: null,
          next_respawn_at: new Date(nowMs + Number(spawn[0].respawn_seconds || 900) * 1000).toISOString(),
        });
      }
    } else if (action === "tick") {
      events.push(makeEvent("monster", "intent", monster.id, character.id, {
        side: session.next_monster_swing_side || "left",
      }));

      if (!range.inRange) {
        combatLog.push(`${monster.name} cannot connect: target out of range.`);
        events.push(makeEvent("system", "range_fail", monster.id, character.id, { reason: "out_of_range" }));
      } else {
        const monsterCdKey = "m:monster_basic";
        if ((monsterRuntime[monsterCdKey] || 0) > nowMs) {
          combatLog.push(`${monster.name} repositions for next swing.`);
        } else {
          const telegraphSide = session.next_monster_swing_side || (Math.random() < 0.5 ? "left" : "right");
          const windupAt = new Date(session.next_monster_windup_at || nowIso).getTime();
          const guardTs = guardAt ? new Date(guardAt).getTime() : 0;
          const parryTiming = guardTs > 0 && Math.abs(guardTs - windupAt) <= 700;
          const parrySide = guardState && guardState === telegraphSide;

          let mitigation = 0;
          if (parrySide && parryTiming) {
            const exp = expectedSideVec(telegraphSide);
            const gv = normalizeVec(guardVector);
            const dot = (gv.x * exp.x) + (gv.y * exp.y);
            mitigation = dot > 0.8 ? 0.85 : dot > 0.5 ? 0.65 : 0.45;
            combatLog.push(`${character.name} parried ${telegraphSide} swing.`);
          }

          const mAbility = { id: "monster_basic", name: `${telegraphSide} slash`, effect_magnitude: 95, effect_type: "damage" };
          const mHit = calcAttackDamage({ ...monsterStats, hp: monsterHp }, playerStats, mAbility);
          monsterRuntime[monsterCdKey] = nowMs + MONSTER_SWING_COOLDOWN_MS;
          events.push(makeEvent("system", "cooldown_started", monster.id, null, {
            abilityId: "monster_basic",
            cooldownMs: MONSTER_SWING_COOLDOWN_MS,
          }));

          if (mHit.evaded) {
            combatLog.push(`${character.name} evaded retaliation.`);
            events.push(makeEvent("monster", "miss", monster.id, character.id, { reason: "evaded" }));
          } else {
            const finalDamage = Math.max(0, Math.floor(mHit.damage * (1 - mitigation)));
            actorHp = Math.max(0, actorHp - finalDamage);
            combatLog.push(`${monster.name} telegraphed ${telegraphSide} strike for ${finalDamage}${mitigation > 0 ? " (mitigated)" : ""}.`);
            events.push(makeEvent("monster", "hit", monster.id, character.id, { damage: finalDamage, side: telegraphSide }));
            events.push(makeEvent("monster", "hurt", monster.id, character.id, { damage: finalDamage }));
          }
        }
      }

      if (actorHp <= 0) {
        status = "defeat";
        events.push(makeEvent("monster", "death", monster.id, character.id, { reason: "player_defeated" }));
        const penaltyGold = Math.floor(Number(character.gold || 0) * 0.05);
        await base44.asServiceRole.entities.Character.update(character.id, {
          hp: Math.max(1, Math.floor(Number(character.max_hp || 100) * 0.5)),
          x: 30,
          y: 25,
          gold: Math.max(0, Number(character.gold || 0) - penaltyGold),
          energy: Math.max(10, actorEnergy),
        });
      } else {
        await base44.asServiceRole.entities.Character.update(character.id, {
          hp: actorHp,
          energy: actorEnergy,
        });
      }
    }

    const nextTelegraph = Math.random() < 0.5 ? "left" : "right";
    const telemetry = bumpTelemetry(session.telemetry || {}, events);
    const updates: Record<string, unknown> = {
      actor_hp: actorHp,
      actor_energy: actorEnergy,
      monster_hp: monsterHp,
      round: Number(session.round || 1) + 1,
      status: status === "active" ? "active" : "resolved",
      active: status === "active",
      resolution: status,
      reward,
      in_range: range.inRange,
      distance_to_target: range.distance,
      combat_log: combatLog.slice(-90),
      guard_state: guardState,
      guard_vector: guardVector,
      guard_at: guardAt,
      next_monster_swing_side: nextTelegraph,
      next_monster_windup_at: new Date(nowMs + 1200).toISOString(),
      last_tick_at: action === "tick" ? nowIso : session.last_tick_at || null,
      did_player_attack: didPlayerAttack,
      actor_runtime_cooldowns: actorRuntime,
      monster_runtime_cooldowns: monsterRuntime,
      actor_ability_cooldowns: cooldownRemaining(actorRuntime, nowMs, "a:"),
      monster_ability_cooldowns: cooldownRemaining(monsterRuntime, nowMs, "m:"),
      pending_events: events.slice(-40),
      last_events: events.slice(-40),
      telemetry,
    };
    if (action === "intent") {
      updates.last_intent = String(payload.intent || "attack");
      updates.last_intent_at = nowIso;
      updates.last_mouse_vector = normalizeVec(payload.mouse_vector);
      updates.last_guard_vector = normalizeVec(payload.guard_vector || payload.mouse_vector);
    }

    const updatedSession = await base44.asServiceRole.entities.CombatSession.update(sessionId, updates);
    const result = {
      session: updatedSession,
      status,
      reward,
      events,
      telemetry,
      in_range: range.inRange,
      distance_to_target: range.distance,
    };

    await createSecurityLog(base44, {
      action: "combat_action_success",
      actor_user_id: user.id,
      actor_email: user.email,
      ip,
      idempotency_key: idempotencyKey,
      result_json: result,
    });

    return json({ ok: true, ...result });
  } catch (error) {
    await createSecurityLog(base44, {
      action: "combat_action_error",
      ip,
      reason: String((error as any)?.message || error),
    });
    return json({ ok: false, error: String((error as any)?.message || error) }, 400);
  }
});
