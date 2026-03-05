export type MonsterAIStatus = "idle" | "aggro" | "chase" | "engage" | "leash" | "dead";

export type AIActor = {
  id: string;
  x: number;
  y: number;
  is_online?: boolean;
};

export type MonsterAIStateInput = {
  nowMs: number;
  aggroRadius: number;
  leashRadius: number;
  aggroTtlMs: number;
  monster: {
    id: string;
    x: number;
    y: number;
    ai_state?: string;
    ai_target_character_id?: string | null;
    aggro_until_ms?: number;
  };
  leashOrigin: { x: number; y: number };
  players: AIActor[];
};

export type MonsterAIStateOutput = {
  state: MonsterAIStatus;
  targetCharacterId: string | null;
  aggroUntilMs: number;
  nextPos: { x: number; y: number };
  transition: boolean;
  chaseStep: boolean;
  engage: boolean;
};

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

export function stepMonsterAI(input: MonsterAIStateInput): MonsterAIStateOutput {
  const now = Number(input.nowMs || Date.now());
  const aggroRadius = Math.max(1, Number(input.aggroRadius || 6));
  const leashRadius = Math.max(1, Number(input.leashRadius || 14));
  const aggroTtlMs = Math.max(1000, Number(input.aggroTtlMs || 12000));

  const curPos = {
    x: Number(input.monster?.x || 0),
    y: Number(input.monster?.y || 0),
  };
  const leashOrigin = {
    x: Number(input.leashOrigin?.x ?? curPos.x),
    y: Number(input.leashOrigin?.y ?? curPos.y),
  };

  let state = String(input.monster?.ai_state || "idle") as MonsterAIStatus;
  let targetId = input.monster?.ai_target_character_id ? String(input.monster.ai_target_character_id) : null;
  let aggroUntil = Number(input.monster?.aggro_until_ms || 0);
  const prevState = state;
  let nextPos = { ...curPos };
  let chaseStep = false;
  let engage = false;

  if (state === "dead") {
    return {
      state: "dead",
      targetCharacterId: null,
      aggroUntilMs: 0,
      nextPos: curPos,
      transition: prevState !== "dead",
      chaseStep: false,
      engage: false,
    };
  }

  const candidates = (Array.isArray(input.players) ? input.players : [])
    .filter((p) => p?.id && p.is_online !== false)
    .map((p) => ({
      id: String(p.id),
      pos: { x: Number(p.x || 0), y: Number(p.y || 0) },
      d: manhattan(curPos, { x: Number(p.x || 0), y: Number(p.y || 0) }),
    }))
    .sort((a, b) => a.d - b.d);

  const currentTarget = targetId ? candidates.find((c) => c.id === targetId) : null;
  const nearest = candidates[0] || null;
  const nearestInAggro = nearest && nearest.d <= aggroRadius ? nearest : null;

  if (state === "idle") {
    if (nearestInAggro) {
      state = "aggro";
      targetId = nearestInAggro.id;
      aggroUntil = now + aggroTtlMs;
    }
  }

  if (state === "aggro" || state === "chase") {
    let target = currentTarget;
    if (!target && targetId) target = candidates.find((c) => c.id === targetId) || null;
    if (!target && nearestInAggro) {
      target = nearestInAggro;
      targetId = nearestInAggro.id;
      aggroUntil = now + aggroTtlMs;
    }
    if (!target) {
      state = "idle";
      targetId = null;
      aggroUntil = 0;
    } else {
      const dist = target.d;
      if (dist <= 1) {
        state = "engage";
      } else if (dist > leashRadius || now > aggroUntil) {
        state = "leash";
        targetId = null;
      } else {
        state = "chase";
        nextPos = stepToward(curPos, target.pos);
        chaseStep = true;
        aggroUntil = now + aggroTtlMs;
      }
    }
  }

  if (state === "engage") {
    const target = targetId ? candidates.find((c) => c.id === targetId) : null;
    if (!target) {
      state = "idle";
      targetId = null;
      aggroUntil = 0;
    } else {
      const dist = target.d;
      if (dist > leashRadius || now > aggroUntil) {
        state = "leash";
        targetId = null;
      } else if (dist > 1) {
        state = "chase";
        nextPos = stepToward(curPos, target.pos);
        chaseStep = true;
      } else {
        engage = true;
        aggroUntil = now + aggroTtlMs;
      }
    }
  }

  if (state === "leash") {
    const homeDist = manhattan(curPos, leashOrigin);
    if (homeDist <= 0) {
      state = "idle";
      targetId = null;
      aggroUntil = 0;
    } else {
      nextPos = stepToward(curPos, leashOrigin);
      chaseStep = true;
    }
  }

  return {
    state,
    targetCharacterId: targetId,
    aggroUntilMs: aggroUntil,
    nextPos,
    transition: state !== prevState,
    chaseStep,
    engage,
  };
}

