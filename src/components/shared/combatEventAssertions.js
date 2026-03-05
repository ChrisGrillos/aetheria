/**
 * ReplayAssertionResult
 * { pass: boolean, failures: string[], stats: object }
 */
export function validateCombatEventSequence(events = [], options = {}) {
  const failures = [];
  const arr = Array.isArray(events) ? events : [];
  const expectedFlow = Array.isArray(options.expectedFlow) ? options.expectedFlow : null;

  const ids = new Set();
  let lastTs = -Infinity;
  let duplicates = 0;
  let nonMonotonicTs = 0;

  arr.forEach((ev, idx) => {
    const id = String(ev?.id || "");
    const ts = Number(ev?.ts || 0);
    if (!id) failures.push(`missing id at index ${idx}`);
    if (id && ids.has(id)) duplicates += 1;
    if (id) ids.add(id);
    if (Number.isFinite(ts) && ts < lastTs) nonMonotonicTs += 1;
    if (Number.isFinite(ts)) lastTs = ts;
  });

  if (duplicates > 0) failures.push(`duplicate event ids: ${duplicates}`);
  if (nonMonotonicTs > 0) failures.push(`non-monotonic timestamps: ${nonMonotonicTs}`);

  if (expectedFlow && expectedFlow.length > 0) {
    const actual = arr.map((e) => String(e?.type || ""));
    let cursor = 0;
    expectedFlow.forEach((need) => {
      while (cursor < actual.length && actual[cursor] !== need) cursor += 1;
      if (cursor >= actual.length) {
        failures.push(`expected event type not found in order: ${need}`);
      } else {
        cursor += 1;
      }
    });
  }

  const cooldownStarts = arr.filter((e) => String(e?.type || "") === "cooldown_started");
  const cooldownReady = arr.filter((e) => String(e?.type || "") === "cooldown_ready");
  const startsByAbility = {};
  const readyByAbility = {};
  cooldownStarts.forEach((ev) => {
    const aid = String(ev?.payload?.abilityId || "unknown");
    startsByAbility[aid] = (startsByAbility[aid] || 0) + 1;
  });
  cooldownReady.forEach((ev) => {
    const aid = String(ev?.payload?.abilityId || "unknown");
    readyByAbility[aid] = (readyByAbility[aid] || 0) + 1;
  });

  Object.keys(readyByAbility).forEach((aid) => {
    if (!startsByAbility[aid]) {
      failures.push(`cooldown_ready without cooldown_started for ability ${aid}`);
    }
  });

  return {
    pass: failures.length === 0,
    failures,
    stats: {
      total: arr.length,
      duplicates,
      nonMonotonicTs,
      cooldownStarted: cooldownStarts.length,
      cooldownReady: cooldownReady.length,
      byType: arr.reduce((acc, ev) => {
        const t = String(ev?.type || "unknown");
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

