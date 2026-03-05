/**
 * useInputController
 * Focus-aware input controller inspired by EverQuest + RuneScape.
 * - WASD / arrow key movement (held or tapped)
 * - Shift + movement sprint with run-energy drain/regeneration
 * - Numpad 1-9 -> ability hotkeys with cooldown tracking
 * - Target locking (click monster -> locked target)
 * - Auto-attack loop against locked target
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { isPassable } from "@/components/shared/movementAuthority";

const WALK_INTERVAL_MS = 180;
const SPRINT_INTERVAL_MS = 120;
const RUN_ENERGY_MAX = 100;
const RUN_DRAIN_PER_STEP = 0.4;
const RUN_REGEN_IDLE = 0.9;
const RUN_REGEN_MOVING = 0.35;

const WASD_DIRS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1],  arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0],  arrowright: [1, 0],
};

export default function useInputController({
  myCharacter,
  monsters,
  onMove,
  onStartCombat,
  onInteractIntent,
  onMovementBlocked,
  abilities = [],
  enabled = true,
}) {
  const [lockedTarget, setLockedTarget] = useState(null);
  const [autoAttacking, setAutoAttacking] = useState(false);
  const [cooldowns, setCooldowns] = useState({});
  const [runEnergy, setRunEnergy] = useState(RUN_ENERGY_MAX);
  const [isSprinting, setIsSprinting] = useState(false);

  const charRef = useRef(myCharacter);
  const monstersRef = useRef(monsters);
  const heldKeys = useRef(new Set());
  const moveTimerRef = useRef();
  const lockedRef = useRef(null);
  const autoAtkRef = useRef(false);
  const enabledRef = useRef(enabled);
  const shiftHeldRef = useRef(false);
  const runEnergyRef = useRef(RUN_ENERGY_MAX);
  const loopActiveRef = useRef(false);
  const onMoveRef = useRef(onMove);
  const onStartCombatRef = useRef(onStartCombat);
  const onInteractIntentRef = useRef(onInteractIntent);
  const onMovementBlockedRef = useRef(onMovementBlocked);

  charRef.current = myCharacter;
  monstersRef.current = monsters;
  enabledRef.current = enabled;
  onMoveRef.current = onMove;
  onStartCombatRef.current = onStartCombat;
  onInteractIntentRef.current = onInteractIntent;
  onMovementBlockedRef.current = onMovementBlocked;

  const lockTarget = useCallback((monster) => {
    lockedRef.current = monster;
    setLockedTarget(monster);
  }, []);

  const stopAutoAttack = useCallback(() => {
    autoAtkRef.current = false;
    setAutoAttacking(false);
  }, []);

  const setRunEnergySafe = useCallback((next) => {
    const clamped = Math.max(0, Math.min(RUN_ENERGY_MAX, next));
    runEnergyRef.current = clamped;
    setRunEnergy(clamped);
    return clamped;
  }, []);

  const setInteractIntent = useCallback(() => {
    onInteractIntentRef.current?.();
  }, []);

  const clearTarget = useCallback(() => {
    lockedRef.current = null;
    setLockedTarget(null);
    stopAutoAttack();
  }, [stopAutoAttack]);

  const startAutoAttack = useCallback(() => {
    if (!lockedRef.current) return;
    if (autoAtkRef.current) {
      stopAutoAttack();
      return;
    }
    autoAtkRef.current = true;
    setAutoAttacking(true);
    onStartCombatRef.current?.(lockedRef.current);
  }, [stopAutoAttack]);

  const getMoveInterval = useCallback(() => {
    const sprinting = shiftHeldRef.current && runEnergyRef.current > 0;
    return sprinting ? SPRINT_INTERVAL_MS : WALK_INTERVAL_MS;
  }, []);

  const doStep = useCallback(() => {
    if (!enabledRef.current) return;
    const char = charRef.current;
    if (!char) return;

    const hasMovementInput = heldKeys.current.size > 0;
    if (!hasMovementInput) {
      setIsSprinting(false);
      setRunEnergySafe(runEnergyRef.current + RUN_REGEN_IDLE);
      return;
    }

    const canSprint = shiftHeldRef.current && runEnergyRef.current > 0;
    setIsSprinting(canSprint);
    if (canSprint) {
      setRunEnergySafe(runEnergyRef.current - RUN_DRAIN_PER_STEP);
    } else {
      setRunEnergySafe(runEnergyRef.current + RUN_REGEN_MOVING);
    }

    for (const key of heldKeys.current) {
      const dir = WASD_DIRS[key];
      if (!dir) continue;

      const nx = char.x + dir[0];
      const ny = char.y + dir[1];
      if (!isPassable(nx, ny)) continue;

      const mon = monstersRef.current.find((m) => m.is_alive && m.x === nx && m.y === ny);
      if (mon) {
        lockTarget(mon);
        onMovementBlockedRef.current?.("monster", { monster: mon, x: nx, y: ny });
        return;
      }

      onMoveRef.current?.(nx, ny);
      return;
    }
  }, [lockTarget, setRunEnergySafe]);

  const startMoveLoop = useCallback(() => {
    if (loopActiveRef.current) return;
    loopActiveRef.current = true;

    const tick = () => {
      if (!loopActiveRef.current) return;
      doStep();
      moveTimerRef.current = setTimeout(tick, getMoveInterval());
    };

    tick();
  }, [doStep, getMoveInterval]);

  const stopMoveLoop = useCallback(() => {
    loopActiveRef.current = false;
    if (moveTimerRef.current) {
      clearTimeout(moveTimerRef.current);
      moveTimerRef.current = undefined;
    }
    setIsSprinting(false);
  }, []);

  const fireAbility = useCallback((slotIndex) => {
    const ability = abilities[slotIndex];
    if (!ability) return;
    if ((cooldowns[ability.id] || 0) > 0) return;
    const cdMs = (ability.cooldown_rounds || 0) * 1500;
    if (cdMs > 0) setCooldowns((prev) => ({ ...prev, [ability.id]: cdMs }));
    if (lockedRef.current) onStartCombatRef.current?.(lockedRef.current, ability);
  }, [abilities, cooldowns]);

  useEffect(() => {
    const id = setInterval(() => {
      setCooldowns((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [aid, ms] of Object.entries(next)) {
          if (ms > 0) {
            next[aid] = Math.max(0, ms - 100);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!enabledRef.current) return;

      const key = e.key.toLowerCase();
      if (key === "i") return;

      if (key === "escape") {
        clearTarget();
        return;
      }

      if (key === "tab") {
        e.preventDefault();
        const char = charRef.current;
        if (!char) return;
        const alive = monstersRef.current.filter((m) => m.is_alive);
        if (!alive.length) return;
        alive.sort(
          (a, b) =>
            Math.abs(a.x - char.x) + Math.abs(a.y - char.y) -
            (Math.abs(b.x - char.x) + Math.abs(b.y - char.y))
        );
        const curIdx = lockedRef.current ? alive.findIndex((m) => m.id === lockedRef.current.id) : -1;
        lockTarget(alive[(curIdx + 1) % alive.length]);
        return;
      }

      if (key === "enter" || key === " ") {
        e.preventDefault();
        startAutoAttack();
        return;
      }

      if (key === "e") {
        e.preventDefault();
        setInteractIntent();
        return;
      }

      if (key === "shift") {
        shiftHeldRef.current = true;
        return;
      }

      const numpad = key.match(/^numpad(\d)$/);
      const digit = !numpad && key.match(/^(\d)$/);
      const slot = numpad ? parseInt(numpad[1], 10) - 1 : digit ? parseInt(digit[1], 10) - 1 : -1;
      if (slot >= 0 && slot <= 8) {
        e.preventDefault();
        fireAbility(slot);
        return;
      }

      if (WASD_DIRS[key]) {
        e.preventDefault();
        heldKeys.current.add(key);
        startMoveLoop();
      }
    };

    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === "shift") {
        shiftHeldRef.current = false;
        setIsSprinting(false);
        return;
      }
      if (WASD_DIRS[key]) {
        heldKeys.current.delete(key);
        if (heldKeys.current.size === 0) stopMoveLoop();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      stopMoveLoop();
      stopAutoAttack();
    };
  }, [fireAbility, lockTarget, clearTarget, startAutoAttack, startMoveLoop, stopMoveLoop, stopAutoAttack, setInteractIntent]);

  useEffect(() => {
    if (!lockedRef.current) return;
    const fresh = monsters.find((m) => m.id === lockedRef.current.id);
    if (!fresh || !fresh.is_alive) clearTarget();
    else {
      lockedRef.current = fresh;
      setLockedTarget(fresh);
    }
  }, [monsters, clearTarget]);

  return {
    lockedTarget,
    lockTarget,
    clearTarget,
    autoAttacking,
    startAutoAttack,
    cooldowns,
    runEnergy,
    isSprinting,
    setInteractIntent,
  };
}
