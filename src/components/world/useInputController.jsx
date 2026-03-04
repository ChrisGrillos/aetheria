/**
 * useInputController
 * 
 * Focus-aware input controller inspired by EverQuest + RuneScape.
 * - WASD / arrow key movement (held or tapped)
 * - Numpad 1-9 → ability hotkeys with cooldown tracking
 * - Target locking (click monster → locked target)
 * - Auto-attack loop against locked target
 * - Exposes state: lockedTarget, cooldowns, autoAttacking
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getTile, MAP_W, MAP_H } from "@/components/shared/worldZones";

const MOVE_INTERVAL_MS = 180; // ms between steps when key held

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
  abilities = [],
  enabled = true,
}) {
  const [lockedTarget, setLockedTarget] = useState(null);
  const [autoAttacking, setAutoAttacking] = useState(false);
  const [cooldowns, setCooldowns] = useState({}); // abilityId → ms remaining

  // Internal refs (avoid stale closures)
  const charRef        = useRef(myCharacter);
  const monstersRef    = useRef(monsters);
  const heldKeys       = useRef(new Set());
  const moveTimerRef   = useRef(null);
  const autoAtkTimer   = useRef(null);
  const cdIntervRef    = useRef(null);
  const lockedRef      = useRef(null);
  const autoAtkRef     = useRef(false);
  const enabledRef     = useRef(enabled);

  charRef.current     = myCharacter;
  monstersRef.current = monsters;
  enabledRef.current  = enabled;

  // ─── TARGET LOCKING ───────────────────────────────────────────────────────

  const lockTarget = useCallback((monster) => {
    lockedRef.current = monster;
    setLockedTarget(monster);
  }, []);

  const clearTarget = useCallback(() => {
    lockedRef.current = null;
    setLockedTarget(null);
    stopAutoAttack();
  }, []);

  // ─── AUTO-ATTACK ──────────────────────────────────────────────────────────

  const stopAutoAttack = useCallback(() => {
    autoAtkRef.current = false;
    setAutoAttacking(false);
    if (autoAtkTimer.current) { clearInterval(autoAtkTimer.current); autoAtkTimer.current = null; }
  }, []);

  const startAutoAttack = useCallback(() => {
    if (!lockedRef.current) return;
    if (autoAtkRef.current) { stopAutoAttack(); return; } // toggle off

    autoAtkRef.current = true;
    setAutoAttacking(true);

    // Immediately trigger first attack then every 2s
    if (onStartCombat) onStartCombat(lockedRef.current);

    autoAtkTimer.current = setInterval(() => {
      const target = lockedRef.current;
      if (!target || !target.is_alive) { stopAutoAttack(); return; }
      if (onStartCombat) onStartCombat(target);
    }, 2000);
  }, [onStartCombat, stopAutoAttack]);

  // ─── WASD MOVEMENT ────────────────────────────────────────────────────────

  const doStep = useCallback(() => {
    if (!enabledRef.current) return;
    const char = charRef.current;
    if (!char) return;

    for (const key of heldKeys.current) {
      const dir = WASD_DIRS[key];
      if (!dir) continue;
      const nx = char.x + dir[0];
      const ny = char.y + dir[1];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (getTile(nx, ny) === "water") continue;

      // Check if stepping onto a monster
      const mon = monstersRef.current.find(m => m.is_alive && m.x === nx && m.y === ny);
      if (mon) {
        lockTarget(mon);
        startAutoAttack();
        return;
      }

      if (onMove) onMove(nx, ny);
      return; // one direction per tick
    }
  }, [onMove, lockTarget, startAutoAttack]);

  const startMoveLoop = useCallback(() => {
    if (moveTimerRef.current) return;
    doStep();
    moveTimerRef.current = setInterval(doStep, MOVE_INTERVAL_MS);
  }, [doStep]);

  const stopMoveLoop = useCallback(() => {
    if (moveTimerRef.current) { clearInterval(moveTimerRef.current); moveTimerRef.current = null; }
  }, []);

  // ─── ABILITY HOTKEYS (Numpad 1-9) ────────────────────────────────────────

  const fireAbility = useCallback((slotIndex) => {
    const ability = abilities[slotIndex];
    if (!ability) return;
    if ((cooldowns[ability.id] || 0) > 0) return; // on cooldown

    const cdMs = (ability.cooldown_rounds || 0) * 1500;

    if (cdMs > 0) {
      setCooldowns(prev => ({ ...prev, [ability.id]: cdMs }));
    }

    // If there's a locked target, pass both; otherwise just fire
    if (onStartCombat && lockedRef.current) {
      onStartCombat(lockedRef.current, ability);
    }
  }, [abilities, cooldowns, onStartCombat]);

  // Cooldown tick-down every 100ms
  useEffect(() => {
    cdIntervRef.current = setInterval(() => {
      setCooldowns(prev => {
        const next = { ...prev };
        let changed = false;
        for (const [id, ms] of Object.entries(next)) {
          if (ms > 0) { next[id] = Math.max(0, ms - 100); changed = true; }
        }
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(cdIntervRef.current);
  }, []);

  // ─── KEYBOARD LISTENERS ───────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e) => {
      // Don't steal focus from inputs/textareas
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (!enabledRef.current) return;

      const key = e.key.toLowerCase();

      // Inventory toggle — keep existing behaviour
      if (key === "i") return;

      // Escape → clear target
      if (key === "escape") { clearTarget(); return; }

      // Tab → cycle nearest monster as target
      if (key === "tab") {
        e.preventDefault();
        const char = charRef.current;
        if (!char) return;
        const alive = monstersRef.current.filter(m => m.is_alive);
        if (!alive.length) return;
        alive.sort((a, b) => {
          const da = Math.abs(a.x - char.x) + Math.abs(a.y - char.y);
          const db = Math.abs(b.x - char.x) + Math.abs(b.y - char.y);
          return da - db;
        });
        const curIdx = lockedRef.current ? alive.findIndex(m => m.id === lockedRef.current.id) : -1;
        const next = alive[(curIdx + 1) % alive.length];
        if (next) lockTarget(next);
        return;
      }

      // Enter / spacebar → start/stop auto-attack on locked target
      if (key === "enter" || key === " ") {
        e.preventDefault();
        startAutoAttack();
        return;
      }

      // Numpad 1-9 → ability slots
      const numpadMatch = key.match(/^numpad(\d)$/);
      const digitMatch  = !numpadMatch && key.match(/^(\d)$/);
      const slot = numpadMatch ? parseInt(numpadMatch[1]) - 1
                 : digitMatch  ? parseInt(digitMatch[1]) - 1
                 : -1;
      if (slot >= 0 && slot <= 8) { e.preventDefault(); fireAbility(slot); return; }

      // WASD / arrow movement
      if (WASD_DIRS[key]) {
        e.preventDefault();
        heldKeys.current.add(key);
        startMoveLoop();
      }
    };

    const onKeyUp = (e) => {
      const key = e.key.toLowerCase();
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
  }, [fireAbility, lockTarget, clearTarget, startAutoAttack, startMoveLoop, stopMoveLoop, stopAutoAttack]);

  // Sync locked target HP from live monsters list
  useEffect(() => {
    if (!lockedRef.current) return;
    const fresh = monsters.find(m => m.id === lockedRef.current.id);
    if (!fresh || !fresh.is_alive) {
      clearTarget();
    } else {
      lockedRef.current = fresh;
      setLockedTarget(fresh);
    }
  }, [monsters, clearTarget]);

  return { lockedTarget, lockTarget, clearTarget, autoAttacking, startAutoAttack, cooldowns };
}