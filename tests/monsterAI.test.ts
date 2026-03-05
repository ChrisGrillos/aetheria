import { describe, expect, it } from "vitest";
import { stepMonsterAI } from "../functions/_monsterAI";

const baseInput = {
  nowMs: 10_000,
  aggroRadius: 6,
  leashRadius: 14,
  aggroTtlMs: 12_000,
  leashOrigin: { x: 10, y: 10 },
};

describe("monster AI step", () => {
  it("transitions idle -> aggro/chase when player enters aggro radius", () => {
    const out = stepMonsterAI({
      ...baseInput,
      monster: { id: "m1", x: 10, y: 10, ai_state: "idle", ai_target_character_id: null, aggro_until_ms: 0 },
      players: [{ id: "p1", x: 13, y: 10, is_online: true }],
    });
    expect(["aggro", "chase", "engage"]).toContain(out.state);
    expect(out.targetCharacterId).toBe("p1");
  });

  it("enters engage state in melee range and emits engage=true", () => {
    const out = stepMonsterAI({
      ...baseInput,
      monster: { id: "m1", x: 10, y: 10, ai_state: "chase", ai_target_character_id: "p1", aggro_until_ms: 20_000 },
      players: [{ id: "p1", x: 11, y: 10, is_online: true }],
    });
    expect(out.state).toBe("engage");
    expect(out.engage).toBe(true);
  });

  it("leashes when target exceeds leash radius", () => {
    const out = stepMonsterAI({
      ...baseInput,
      monster: { id: "m1", x: 10, y: 10, ai_state: "engage", ai_target_character_id: "p1", aggro_until_ms: 20_000 },
      players: [{ id: "p1", x: 40, y: 40, is_online: true }],
    });
    expect(["leash", "idle"]).toContain(out.state);
    expect(out.targetCharacterId).toBeNull();
  });

  it("stabilizes lock to current target without rapid thrash", () => {
    const out = stepMonsterAI({
      ...baseInput,
      monster: { id: "m1", x: 10, y: 10, ai_state: "chase", ai_target_character_id: "p1", aggro_until_ms: 20_000 },
      players: [
        { id: "p1", x: 12, y: 10, is_online: true },
        { id: "p2", x: 11, y: 10, is_online: true },
      ],
    });
    expect(["p1", "p2"]).toContain(out.targetCharacterId);
    if (out.state === "chase" || out.state === "engage") {
      expect(out.targetCharacterId).toBe("p1");
    }
  });
});
