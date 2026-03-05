import { describe, expect, it } from "vitest";
import { validateCombatEventSequence } from "@/components/shared/combatEventAssertions";
import { FIXED_COMBAT_EVENT_FIXTURES } from "@/components/shared/replayFixtures";

describe("combat event assertions", () => {
  it("passes expected cast -> hit -> hurt flow fixture", () => {
    const result = validateCombatEventSequence(
      FIXED_COMBAT_EVENT_FIXTURES.player_cast_hit_chain,
      { expectedFlow: ["intent", "cast_start", "hit", "hurt"] },
    );
    expect(result.pass).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("fails duplicate ids and non-monotonic timestamps", () => {
    const bad = [
      { id: "x1", ts: 10, type: "intent" },
      { id: "x1", ts: 9, type: "hit" },
    ];
    const result = validateCombatEventSequence(bad, { expectedFlow: ["intent", "hit"] });
    expect(result.pass).toBe(false);
    expect(result.failures.join(" ")).toContain("duplicate");
    expect(result.failures.join(" ")).toContain("non-monotonic");
  });

  it("flags cooldown_ready without cooldown_started", () => {
    const result = validateCombatEventSequence([
      { id: "a1", ts: 1, type: "cooldown_ready", payload: { abilityId: "ghost_ability" } },
    ]);
    expect(result.pass).toBe(false);
    expect(result.failures.join(" ")).toContain("cooldown_ready without cooldown_started");
  });
});

