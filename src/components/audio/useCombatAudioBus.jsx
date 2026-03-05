import { useCallback, useEffect, useMemo, useRef } from "react";
import { resolveCombatAudioEntry } from "./combatAudioManifest";

export default function useCombatAudioBus({ enabled = true } = {}) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const categoryGainRef = useRef({});
  const clipCacheRef = useRef(new Map());
  const lastPlayedRef = useRef(new Map());
  const telemetryRef = useRef({ played: 0, dropped: 0, fallbacks: 0, failedLoads: 0 });

  const ensureRouting = useCallback((ctx) => {
    if (!ctx) return null;
    if (!masterGainRef.current) {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.88, ctx.currentTime);
      master.connect(ctx.destination);
      masterGainRef.current = master;
    }
    const map = categoryGainRef.current;
    ["weapon", "impact", "cast", "hurt", "death", "ui"].forEach((cat) => {
      if (map[cat]) return;
      const gain = ctx.createGain();
      const v =
        cat === "impact" ? 0.92 :
        cat === "death" ? 1.0 :
        cat === "ui" ? 0.8 :
        0.86;
      gain.gain.setValueAtTime(v, ctx.currentTime);
      gain.connect(masterGainRef.current);
      map[cat] = gain;
    });
    return map;
  }, []);

  const ensureContext = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
      ensureRouting(ctxRef.current);
    }
    return ctxRef.current;
  }, [enabled, ensureRouting]);

  const fallbackBeep = useCallback((entry, key = "") => {
    const ctx = ensureContext();
    if (!ctx) return;
    const category = String(entry?.category || "ui");
    const categoryGain = categoryGainRef.current?.[category] || ctx.destination;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const hz =
      category === "death" ? 62 :
      category === "hurt" ? 95 :
      category === "cast" ? 500 :
      category === "impact" ? 150 :
      category === "weapon" ? 240 :
      190;
    const durMs = category === "death" ? 260 : 90;
    osc.type = category === "cast" ? "sine" : category === "weapon" ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.03, Number(entry?.volume || 0.1) * 0.24), ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (durMs / 1000));
    osc.connect(gain);
    gain.connect(categoryGain);
    osc.start();
    osc.stop(ctx.currentTime + (durMs / 1000) + 0.02);
    telemetryRef.current.fallbacks += 1;
    telemetryRef.current.played += 1;
  }, [ensureContext]);

  const loadClip = useCallback(async (url) => {
    if (!url) return null;
    const existing = clipCacheRef.current.get(url);
    if (existing instanceof AudioBuffer || existing === null) return existing;
    if (existing && typeof existing.then === "function") return existing;
    const promise = (async () => {
      try {
        const ctx = ensureContext();
        if (!ctx) return null;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr.slice(0));
        clipCacheRef.current.set(url, decoded);
        return decoded;
      } catch {
        clipCacheRef.current.set(url, null);
        telemetryRef.current.failedLoads += 1;
        return null;
      }
    })();
    clipCacheRef.current.set(url, promise);
    return promise;
  }, [ensureContext]);

  const playClip = useCallback(async (entry, event = null, key = "") => {
    if (!enabled || !entry) return;
    const now = Date.now();
    const eventType = String(entry?.eventType || event?.type || "unknown");
    const source = String(event?.source || "system");
    const cooldownMs = Number(entry?.cooldownMs || 90);
    const dedupeKey = `${eventType}:${source}:${key}`;
    const last = lastPlayedRef.current.get(dedupeKey) || 0;
    if (now - last < cooldownMs) {
      telemetryRef.current.dropped += 1;
      return;
    }
    lastPlayedRef.current.set(dedupeKey, now);

    const ctx = ensureContext();
    if (!ctx) {
      telemetryRef.current.dropped += 1;
      return;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    ensureRouting(ctx);

    const sourceClips = entry?.sourceClips && typeof entry.sourceClips === "object"
      ? entry.sourceClips
      : null;
    const clips = sourceClips
      ? (sourceClips[source] || sourceClips.system || sourceClips.player || [])
      : (entry?.clips || []);
    const picked = clips.length > 0 ? clips[Math.floor(Math.random() * clips.length)] : null;
    if (!picked) {
      fallbackBeep(entry, key);
      return;
    }

    const decoded = await loadClip(picked);
    if (!(decoded instanceof AudioBuffer)) {
      fallbackBeep(entry, key);
      return;
    }

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = decoded;
    const gain = ctx.createGain();
    const category = String(entry?.category || "ui");
    const categoryGain = categoryGainRef.current?.[category] || masterGainRef.current || ctx.destination;
    gain.gain.setValueAtTime(Math.max(0, Number(entry?.volume || 0.5)), ctx.currentTime);
    sourceNode.connect(gain);
    gain.connect(categoryGain);
    sourceNode.start();
    telemetryRef.current.played += 1;
  }, [enabled, ensureContext, ensureRouting, fallbackBeep, loadClip]);

  const handleCombatEvents = useCallback((events = []) => {
    if (!enabled || !Array.isArray(events) || events.length === 0) return;
    events.forEach(async (event) => {
      const entry = resolveCombatAudioEntry(event);
      if (!entry) return;
      const actorId = String(event?.actorId || "unknown");
      await playClip(entry, event, `${String(event?.id || "")}:${actorId}`);
    });
  }, [enabled, playClip]);

  const playUiCue = useCallback((kind = "error") => {
    const event = kind === "ready"
      ? { type: "cooldown_ready", source: "system" }
      : { type: "range_fail", source: "system", payload: { reason: kind } };
    const entry = resolveCombatAudioEntry(event);
    if (!entry) return;
    playClip(entry, event, `manual_${kind}`);
  }, [playClip]);

  useEffect(() => {
    const wake = () => {
      const ctx = ensureContext();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [ensureContext]);

  useEffect(() => {
    if (!enabled) return;
    const warm = async () => {
      const manifestEntries = [
        resolveCombatAudioEntry({ type: "intent", source: "player" }),
        resolveCombatAudioEntry({ type: "intent", source: "monster" }),
        resolveCombatAudioEntry({ type: "cast_start" }),
        resolveCombatAudioEntry({ type: "hit" }),
        resolveCombatAudioEntry({ type: "hurt" }),
        resolveCombatAudioEntry({ type: "death" }),
        resolveCombatAudioEntry({ type: "cooldown_ready" }),
        resolveCombatAudioEntry({ type: "range_fail" }),
      ].filter(Boolean);
      const urls = new Set();
      manifestEntries.forEach((entry) => {
        (entry?.clips || []).forEach((u) => urls.add(u));
        if (entry?.sourceClips) {
          Object.values(entry.sourceClips).forEach((arr) => {
            (arr || []).forEach((u) => urls.add(u));
          });
        }
      });
      await Promise.all([...urls].map((u) => loadClip(u)));
    };
    warm().catch(() => {});
  }, [enabled, loadClip]);

  return useMemo(() => ({
    handleCombatEvents,
    playUiCue,
    telemetryRef,
  }), [handleCombatEvents, playUiCue]);
}
