import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import gameService from "@/api/gameService";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import WorldMap from "@/components/world/WorldMap.jsx";
import WorldScene3D from "@/components/world/WorldScene3D.jsx";
import ViewToggle from "@/components/world/ViewToggle.jsx";
import ChatDock from "@/components/chat/ChatDock.jsx";
import GroupWindow from "@/components/world/GroupWindow.jsx";
// TravelEncounterModal removed â€” monsters are 3D entities on the map (MMO-style)
import Minimap from "@/components/world/Minimap.jsx";
import TargetFrame from "@/components/world/TargetFrame.jsx";
import ShadowbaneHUD from "@/components/world/ShadowbaneHUD.jsx";
import InWorldCombatPanel from "@/components/world/InWorldCombatPanel.jsx";
import { getZoneAt, getPOIAt } from "@/components/shared/worldZones";
import { isPassable, movementEnergyRegen, setMovementDynamicBlockers, validateStep } from "@/components/shared/movementAuthority";
import { initiateCombat } from "@/components/combat/authorizedCombatEngine";
import { RESOURCES } from "@/components/shared/craftingData";
import InventoryPanel from "@/components/inventory/InventoryPanel.jsx";
import { Button } from "@/components/ui/button";
import { checkAchievements } from "@/components/shared/achievementData";
import useInputController from "@/components/world/useInputController.jsx";
import { useZoomController } from "@/components/world/useZoomController";
import AbilityHotbar from "@/components/world/AbilityHotbar.jsx";
import { COMBAT_MODE } from "@/components/shared/combatMode";
import { getTileEffects } from "@/components/shared/worldEventEffects";
import QuestOfferModal from "@/components/world/QuestOfferModal.jsx";
import useVoiceAbilityCommands from "@/components/voice/useVoiceAbilityCommands.jsx";
import usePartyVoiceChat from "@/components/voice/usePartyVoiceChat.jsx";
import VoiceOverlayPanel from "@/components/voice/VoiceOverlayPanel.jsx";
import { createEngineAdapterState, pushReplayFrame } from "@/components/shared/engineAdapterContracts";
import useCombatAudioBus from "@/components/audio/useCombatAudioBus.jsx";
import { triggerEntityState } from "@/components/world/WorldScene3D.jsx";
import {
  NPC_INTERACTION_PROFILES,
  buildQuestOffer,
  acceptQuestFromOffer,
  applyQuestEvent,
} from "@/components/world/questSystem";

function isArchivedCharacter(character) {
  if (!character) return true;
  if (character.is_deleted === true) return true;
  return String(character.status || "").toLowerCase() === "archived";
}

function VoiceStreamAudio({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream || null;
  }, [stream]);
  return <audio ref={audioRef} autoPlay />;
}

export default function World() {
  const [user, setUser] = useState(null);
  const userRef = useRef(null);
  const [myCharacter, setMyCharacter] = useState(null);
  const [allCharacters, setAllCharacters] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [worldObjects, setWorldObjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Encounters are now initiated by clicking 3D monsters directly (no random encounters)
  const [showInventory, setShowInventory] = useState(false);
  const [fastTravelTarget, setFastTravelTarget] = useState(null);
  const [fastTravelProgress, setFastTravelProgress] = useState(0);
  const fastTravelRef = useRef(null);
  const moveWriteTimerRef = useRef(null);
  const [viewMode, setViewMode] = useState("3d"); // "map" | "3d"
  const [sceneSettings, setSceneSettings] = useState({
    showNameplates: false,
    showHealthBars: true,
    showCollisionDebug: false,
    cameraDistance: 1.0,
  });
  const [questOffer, setQuestOffer] = useState(null);
  const [characterQuests, setCharacterQuests] = useState([]);
  const [conversationState, setConversationState] = useState({});
  const [runEnergy, setRunEnergy] = useState(100);
  const [isSprinting, setIsSprinting] = useState(false);
  const questsRef = useRef([]);
  
  // â”€â”€â”€ ZOOM CONTROLLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { getCurrentZoomConfig } = useZoomController();

  const partyMembers = allCharacters.filter(
    (c) => c.party_id && myCharacter?.party_id && c.party_id === myCharacter.party_id && c.id !== myCharacter.id
  );

  useEffect(() => {
    const rows = [];

    allCharacters.forEach((c) => {
      if (!c?.id) return;
      if (myCharacter?.id && c.id === myCharacter.id) return;
      rows.push({ x: c.x, y: c.y, occupantId: `character:${c.id}` });
    });

    monsters.forEach((m) => {
      if (!m?.is_alive) return;
      rows.push({ x: m.x, y: m.y, occupantId: `monster:${m.id}` });
    });

    setMovementDynamicBlockers(rows);
  }, [allCharacters, monsters, myCharacter?.id]);

  const voice = usePartyVoiceChat({
    enabled: !!myCharacter,
    myCharacter,
    allCharacters,
  });
  const combatAudio = useCombatAudioBus({ enabled: true });

  // â”€â”€â”€ AUTHORITATIVE TARGET STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Single source of truth. No parallel target concepts.
  // { entity, type: "monster"|"player"|"ai_agent"|"npc" }
  const [activeTarget, setActiveTarget] = useState(null);
  // In-world combat session state (modal removed)
  const [combatSession, setCombatSession] = useState(null);
  const [combatStatus, setCombatStatus] = useState("idle");
  const [combatError, setCombatError] = useState("");
  const [aimVec, setAimVec] = useState({ x: 1, y: 0 });
  const [authoritativeCooldowns, setAuthoritativeCooldowns] = useState({});
  const combatStartRef = useRef(false);
  const engineReplayRef = useRef([]);
  const seenCombatEventIdsRef = useRef([]);
  const setDebugGlobal = useCallback((key, value) => {
    if (typeof window === "undefined") return;
    Reflect.set(window, key, value);
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    loadWorld();
    const interval = setInterval(loadCharacters, 8000);
    const worldInterval = setInterval(async () => {
      const res = await gameService.worldTick().catch(() => null);
      if (res) setDebugGlobal("__monsterAITelemetry", res.monster_ai || null);
    }, 12000);
    return () => { clearInterval(interval); clearInterval(worldInterval); };
  }, [setDebugGlobal]);

  useEffect(() => {
    questsRef.current = characterQuests;
  }, [characterQuests]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "i" || e.key === "I") setShowInventory(v => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!myCharacter) return;
    const unsub = base44.entities.ChatMessage.subscribe(event => {
      if (event.type === "create") {
        setMessages(prev => [...prev.slice(-49), event.data]);
      }
    });
    return unsub;
  }, [myCharacter?.id]);

  const loadWorld = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    userRef.current = u;

    const [charsRaw, mons, objs, msgs, events] = await Promise.all([
      base44.entities.Character.list("-updated_date", 100),
      base44.entities.Monster.filter({ is_alive: true }),
      base44.entities.WorldObject.list(),
      base44.entities.ChatMessage.list("-created_date", 40),
      base44.entities.WorldEvent.filter({ status: "active" }),
    ]);
    const chars = (charsRaw || []).filter((c) => !isArchivedCharacter(c));

    setAllCharacters(chars);
    setMonsters(mons);
    setWorldObjects(objs);
    setMessages(msgs.reverse());
    setActiveEvents(events);

    if (u) {
      // Use active_character_id from user profile, fall back to first human character
      let mine = null;
      if (u.active_character_id) {
        mine = chars.find(c => c.id === u.active_character_id && c.type === "human");
      }
      if (!mine) {
        mine = chars.find(c => c.created_by === u.email && c.type === "human");
      }
      if (mine) {
        setMyCharacter(mine);
        const existingQuests = Array.isArray(mine.active_quests) ? mine.active_quests : [];
        setCharacterQuests(existingQuests);
        base44.entities.Character.update(mine.id, { is_online: true });
      }
    }
    setLoading(false);
  };

  const loadCharacters = async () => {
    const [charsRaw, mons] = await Promise.all([
      base44.entities.Character.list("-updated_date", 100),
      base44.entities.Monster.filter({ is_alive: true }).catch(() => []),
    ]);
    const chars = (charsRaw || []).filter((c) => !isArchivedCharacter(c));
    setAllCharacters(chars);
    if (Array.isArray(mons)) setMonsters(mons);
    const currentUser = userRef.current;
    if (currentUser) {
      let mine = null;
      if (currentUser.active_character_id) {
        mine = chars.find(c => c.id === currentUser.active_character_id && c.type === "human");
      }
      if (!mine) {
        mine = chars.find(c => c.created_by === currentUser.email && c.type === "human");
      }
      if (mine) {
        setMyCharacter(mine);
        if (Array.isArray(mine.active_quests)) setCharacterQuests(mine.active_quests);
      }
    }

    setActiveTarget((prev) => {
      if (!prev || prev.type !== "monster") return prev;
      const fresh = (Array.isArray(mons) ? mons : []).find((m) => m.id === prev.entity?.id);
      if (!fresh) return prev;
      return { ...prev, entity: fresh };
    });
  };

  const recordReplayFrame = useCallback((intent = {}) => {
    const state = createEngineAdapterState({
      myCharacter,
      allCharacters,
      monsters,
      activeTarget,
      combatSession,
    });
    engineReplayRef.current = pushReplayFrame(engineReplayRef.current, {
      ts: Date.now(),
      intent,
      state,
    });
    setDebugGlobal("__aetheriaReplay", engineReplayRef.current);
  }, [activeTarget, allCharacters, combatSession, monsters, myCharacter, setDebugGlobal]);

  const applyCombatEvents = useCallback((events = []) => {
    if (!Array.isArray(events) || events.length === 0) return;

    const seen = seenCombatEventIdsRef.current;
    const deduped = events.filter((ev) => {
      const id = String(ev?.id || "");
      if (!id) return true;
      if (seen.includes(id)) return false;
      seen.push(id);
      if (seen.length > 240) seen.splice(0, seen.length - 240);
      return true;
    });
    if (deduped.length === 0) return;

    combatAudio.handleCombatEvents(deduped);
    setDebugGlobal("__combatAudioTelemetry", combatAudio.telemetryRef.current);

    deduped.forEach((ev) => {
      const type = String(ev?.type || "");
      const actorId = ev?.actorId ? String(ev.actorId) : null;
      const targetId = ev?.targetId ? String(ev.targetId) : null;

      if (type === "cast_start" && actorId) {
        triggerEntityState(actorId, "cast", 820);
      } else if (type === "hit") {
        if (actorId) triggerEntityState(actorId, "attack", 420);
        if (targetId) triggerEntityState(targetId, "hurt", 360);
      } else if (type === "hurt") {
        if (targetId) triggerEntityState(targetId, "hurt", 360);
      } else if (type === "death") {
        if (targetId) triggerEntityState(targetId, "death", 1300);
      } else if (type === "range_fail") {
        const reason = String(ev?.payload?.reason || "out_of_range");
        setCombatError(reason === "cooldown" ? "Ability cooling down." : "Target out of range.");
      } else if (type === "miss" && String(ev?.payload?.reason || "") === "cooldown") {
        setCombatError("Ability cooling down.");
      }
    });

    recordReplayFrame({
      combatEvents: deduped.map((ev) => String(ev?.id || "")).filter(Boolean),
    });
  }, [combatAudio, recordReplayFrame, setDebugGlobal]);

  useEffect(() => {
    if (!myCharacter?.id) return;
    const timer = setInterval(async () => {
      if (combatStatus === "active" || combatStatus === "starting") return;
      const sessions = await base44.entities.CombatSession
        .filter({ actor_character_id: myCharacter.id, active: true }, "-updated_date", 1)
        .catch(() => []);
      const session = sessions?.[0];
      if (!session?.id) return;

      setCombatSession(session);
      setCombatStatus("active");
      if (session.actor_ability_cooldowns) setAuthoritativeCooldowns(session.actor_ability_cooldowns);

      const monster =
        monsters.find((m) => m.id === session.monster_id) ||
        (await base44.entities.Monster.get(session.monster_id).catch(() => null));
      if (monster) setActiveTarget({ entity: monster, type: "monster" });
      if (Array.isArray(session.pending_events) && session.pending_events.length > 0) {
        applyCombatEvents(session.pending_events);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [applyCombatEvents, combatStatus, monsters, myCharacter?.id]);

  const postNpcChat = useCallback(async (npc, text, channel = "npc_local") => {
    if (!text?.trim()) return;
    const payload = {
      character_id: npc.id || npc.poiId || `npc_${npc.npcType || "merchant"}`,
      character_name: npc.name || npc.poiName || "NPC",
      character_type: "npc",
      character_class: npc.npcType || "npc",
      message: text,
      channel,
      x: npc.x ?? myCharacter?.x ?? 0,
      y: npc.y ?? myCharacter?.y ?? 0,
      is_ambient: false,
      is_direct_reply_to_player: true,
    };
    try {
      await base44.entities.ChatMessage.create(payload);
    } catch {
      setMessages(prev => [...prev.slice(-49), { ...payload, id: `local_${Date.now()}`, created_date: new Date().toISOString() }]);
    }
  }, [myCharacter?.x, myCharacter?.y]);

  const postSystemChat = useCallback((text) => {
    setMessages(prev => [...prev.slice(-49), {
      id: `sys_${Date.now()}`,
      character_name: "System",
      character_type: "system",
      channel: "system",
      message: text,
      created_date: new Date().toISOString(),
      x: myCharacter?.x ?? 0,
      y: myCharacter?.y ?? 0,
    }]);
  }, [myCharacter?.x, myCharacter?.y]);

  const persistQuestState = useCallback((nextQuests) => {
    if (!myCharacter?.id) return;
    base44.entities.Character.update(myCharacter.id, { active_quests: nextQuests }).catch(() => {});
  }, [myCharacter?.id]);

  const applyQuestProgress = useCallback((event) => {
    const { changed, quests, completedNow } = applyQuestEvent(questsRef.current, event);
    if (!changed) return;

    questsRef.current = quests;
    setCharacterQuests(quests);
    persistQuestState(quests);

    completedNow.forEach((quest) => {
      postSystemChat(`Quest complete: ${quest.title}`);
      const rewardUpdates = { xp: myCharacter?.xp || 0, gold: myCharacter?.gold || 0 };
      (quest.rewards || []).forEach((reward) => {
        if (reward.type === "xp") rewardUpdates.xp += reward.amount;
        if (reward.type === "gold") rewardUpdates.gold += reward.amount;
      });
      if (myCharacter?.id) {
        setMyCharacter(prev => prev ? { ...prev, ...rewardUpdates } : prev);
        setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? { ...c, ...rewardUpdates } : c));
        base44.entities.Character.update(myCharacter.id, rewardUpdates).catch(() => {});
      }
    });
  }, [myCharacter?.gold, myCharacter?.id, myCharacter?.xp, persistQuestState, postSystemChat]);

  const npcInRange = useCallback((npc) => {
    if (!myCharacter || !npc) return false;
    const dist = Math.abs((npc.x ?? 0) - myCharacter.x) + Math.abs((npc.y ?? 0) - myCharacter.y);
    return dist <= 2;
  }, [myCharacter]);

  const interactWithNpc = useCallback(async (npc) => {
    if (!npc || npc.type !== "npc") return;
    if (!npcInRange(npc)) {
      postSystemChat("Move closer to interact.");
      return;
    }

    const key = npc.id || npc.poiId || `${npc.x},${npc.y}`;
    const now = Date.now();
    const cooldown = conversationState[key]?.lastAt || 0;
    if (now - cooldown < 800) return;
    setConversationState(prev => ({ ...prev, [key]: { lastAt: now } }));

    const profile = NPC_INTERACTION_PROFILES[npc.npcType] || NPC_INTERACTION_PROFILES.merchant;
    await postNpcChat({ ...npc, name: profile.name }, profile.greeting);
    await postNpcChat({ ...npc, name: profile.name }, profile.followUp);
    applyQuestProgress({ type: "talk_npc", npcType: npc.npcType, amount: 1 });

    if (npc.npcType === "quest_giver" || npc.npcType === "miner" || npc.npcType === "farmer") {
      const zone = getZoneAt(npc.x ?? myCharacter?.x ?? 0, npc.y ?? myCharacter?.y ?? 0);
      const completedQuestIds = (questsRef.current || []).filter(q => q.status === "completed").map(q => q.questId);
      const offer = await buildQuestOffer({
        npc,
        zoneId: zone?.id || null,
        zoneName: zone?.name || "Unknown",
        completedQuestIds,
        characterName: myCharacter?.name || "Player",
        invokeLLM: base44.integrations?.Core?.InvokeLLM,
      });
      setQuestOffer(offer);
    }
  }, [applyQuestProgress, conversationState, myCharacter?.name, myCharacter?.x, myCharacter?.y, npcInRange, postNpcChat, postSystemChat]);



  const cancelFastTravel = useCallback(() => {
    if (fastTravelRef.current) clearInterval(fastTravelRef.current);
    setFastTravelTarget(null);
    setFastTravelProgress(0);
  }, []);

  const requestFastTravel = useCallback((tx, ty) => {
    if (combatStatus === "active" || combatStatus === "starting" || fastTravelTarget) return;
    if (!isPassable(tx, ty)) return;

    setFastTravelTarget({ x: tx, y: ty });
    setFastTravelProgress(0);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      setFastTravelProgress(Math.min(100, (elapsed / 3000) * 100));

      if (elapsed >= 3000) {
        clearInterval(interval);
        setMyCharacter(prev => {
          if (!prev) return prev;
          const updated = { ...prev, x: tx, y: ty };
          setAllCharacters(all => all.map(c => c.id === prev.id ? updated : c));
          base44.entities.Character.update(prev.id, { x: tx, y: ty });
          return updated;
        });
        setFastTravelTarget(null);
        setFastTravelProgress(0);
      }
    }, 100);

    fastTravelRef.current = interval;
  }, [combatStatus, fastTravelTarget]);

  const syncCharacterLocals = useCallback((updates) => {
    if (!myCharacter?.id) return;
    setMyCharacter((prev) => prev ? { ...prev, ...updates } : prev);
    setAllCharacters((prev) => prev.map((c) => (c.id === myCharacter.id ? { ...c, ...updates } : c)));
  }, [myCharacter?.id]);

  const clearCombatState = useCallback(() => {
    setCombatSession(null);
    setCombatStatus("idle");
    setCombatError("");
    setAuthoritativeCooldowns({});
    combatStartRef.current = false;
  }, []);

  const processCombatResult = useCallback(async (res, sourceMonster = null) => {
    if (!res) return;
    setCombatError("");
    if (res.session) setCombatSession(res.session);
    if (res.status) setCombatStatus(res.status === "active" ? "active" : res.status);
    if (res?.session?.actor_ability_cooldowns) {
      setAuthoritativeCooldowns(res.session.actor_ability_cooldowns);
    }
    if (Array.isArray(res?.events) && res.events.length > 0) {
      applyCombatEvents(res.events);
    }
    if (res?.telemetry) setDebugGlobal("__combatTelemetry", res.telemetry);

    if (res.session?.actor_hp !== undefined || res.session?.actor_energy !== undefined) {
      syncCharacterLocals({
        hp: Number(res.session.actor_hp ?? myCharacter?.hp ?? 0),
        energy: Number(res.session.actor_energy ?? myCharacter?.energy ?? 0),
      });
    }

    if (res.status === "victory") {
      const killed = sourceMonster || activeTarget?.entity;
      if (killed?.species) {
        applyQuestProgress({ type: "kill_monster", species: killed.species, amount: 1 });
      }
      await gameService.creatorEventHook({
        marker_type: "combat_victory",
        title: `Victory vs ${killed?.name || "enemy"}`,
        summary: `${myCharacter?.name || "Player"} won an in-world directional combat exchange.`,
        context: { monster_id: killed?.id, zone_x: myCharacter?.x, zone_y: myCharacter?.y },
      }).catch(() => {});
      await loadWorld();
      const refreshed = await base44.entities.Character.get(myCharacter.id).catch(() => null);
      if (refreshed) {
        const achievementUpdates = checkAchievements(refreshed, myCharacter);
        if (Object.keys(achievementUpdates).length > 0) {
          await base44.entities.Character.update(myCharacter.id, achievementUpdates).catch(() => {});
        }
      }
      clearCombatState();
      setActiveTarget(null);
    } else if (res.status === "defeat" || res.status === "retreated") {
      await loadWorld();
      clearCombatState();
      setActiveTarget(null);
    }
  }, [activeTarget?.entity, applyCombatEvents, applyQuestProgress, clearCombatState, myCharacter, setDebugGlobal, syncCharacterLocals]);

  const startCombat = useCallback(async (monster) => {
    if (!monster || !myCharacter || !monster.species) return null;
    if (combatStartRef.current) return combatSession;
    if (combatSession?.status === "active" && combatSession?.monster_id === monster.id) return combatSession;

    const validation = initiateCombat(myCharacter, monster, true);
    if (!validation.success) {
      setCombatError(`Cannot engage: ${validation.reason}`);
      return null;
    }

    combatStartRef.current = true;
    setCombatStatus("starting");
    setCombatError("");
    try {
      const res = await gameService.combatAction({
        action: "start",
        character_id: myCharacter.id,
        monster_id: monster.id,
      });
      setActiveTarget({ entity: monster, type: "monster" });
      setCombatSession(res.session || null);
      setCombatStatus(res.phase || "active");
      if (res?.session?.actor_ability_cooldowns) {
        setAuthoritativeCooldowns(res.session.actor_ability_cooldowns);
      }
      if (Array.isArray(res?.events) && res.events.length > 0) {
        applyCombatEvents(res.events);
      }
      return res.session || null;
    } catch (e) {
      setCombatError(String(e?.message || e));
      setCombatStatus("idle");
      return null;
    } finally {
      combatStartRef.current = false;
    }
  }, [applyCombatEvents, combatSession, myCharacter]);

  const sendCombatIntent = useCallback(async ({ hand = "left", intentType = "swing", mouseVector = { x: 1, y: 0 }, abilityId = undefined } = {}) => {
    const monster = activeTarget?.type === "monster" ? activeTarget.entity : null;
    if (!monster || !myCharacter) return;
    const currentSession = combatSession || await startCombat(monster);
    if (!currentSession?.id) return;

    const leftHasShield = !!myCharacter?.equipment?.shield;
    const intent = intentType === "ability_cast"
      ? "ability_cast"
      : hand === "left"
        ? "swing_left"
        : "swing_right";
    const realIntentType = hand === "left" && leftHasShield && intentType !== "ability_cast" ? "shield_bash" : intentType;
    recordReplayFrame({
      combatIntent: {
        hand,
        intentType: realIntentType,
        mouseVector,
        abilityId,
      },
      target: { id: monster.id, type: "monster" },
    });

    try {
      const res = await gameService.combatAction({
        action: "intent",
        session_id: currentSession.id,
        intent,
        hand,
        intent_type: realIntentType,
        ability_id: abilityId,
        mouse_vector: mouseVector,
        guard_vector: mouseVector,
        timestamp: Date.now(),
      });
      await processCombatResult(res, monster);
    } catch (e) {
      setCombatError(String(e?.message || e));
      combatAudio.playUiCue("error");
    }
  }, [activeTarget, combatAudio, combatSession, myCharacter, processCombatResult, recordReplayFrame, startCombat]);

  const handleMove = useCallback(async (newX, newY) => {
    if (!myCharacter) return;
    cancelFastTravel();

    const step = validateStep(myCharacter.x, myCharacter.y, newX, newY, {
      ignoreOccupantId: `character:${myCharacter.id}`,
    });
    if (!step.valid) return "blocked";

    if (!isPassable(newX, newY, { ignoreOccupantId: `character:${myCharacter.id}` })) return "blocked";
    const blockingMonster = monsters.find(m => m.is_alive && m.x === newX && m.y === newY);
    if (blockingMonster) return "blocked";

    const zone = getZoneAt(newX, newY);
    const poi  = getPOIAt(newX, newY);

    // Gather resource from POI resource nodes
    let inventoryUpdates = null;
    if (poi?.type === "resource_node" && poi.resource) {
      const res = RESOURCES[poi.resource];
      if (res) {
        const inv = [...(myCharacter.inventory || [])];
        const idx = inv.findIndex(i => i.id === poi.resource);
        const qty = 1 + Math.floor(Math.random() * 2);
        if (idx >= 0) inv[idx] = { ...inv[idx], qty: (inv[idx].qty || 0) + qty };
        else inv.push({ id: poi.resource, name: res.name, emoji: res.emoji, qty });
        inventoryUpdates = inv;
      }
    }

    // POI rest/heal
    let hpUpdate = null;
    if (poi?.type === "rest" && poi.hp_restore) {
      hpUpdate = Math.min(myCharacter.max_hp || 100, (myCharacter.hp || 100) + poi.hp_restore);
    }
    if (poi?.type === "heal_station") {
      hpUpdate = myCharacter.max_hp || 100;
    }

    // Authority: energy regen on movement (out of combat)
    const { energy: newEnergy } = movementEnergyRegen(myCharacter);

    const tileFx = getTileEffects(activeEvents, newX, newY);
    const updates = { x: newX, y: newY, energy: Math.max(0, newEnergy - tileFx.energyPenalty) };
    if (tileFx.healPerMove > 0) {
      updates.hp = Math.min(myCharacter.max_hp || 100, ((hpUpdate ?? myCharacter.hp) || 0) + tileFx.healPerMove);
    }
    if (tileFx.lawEffect) {
      updates.active_law_effect = tileFx.lawEffect;
    }
    if (inventoryUpdates) updates.inventory = inventoryUpdates;
    if (hpUpdate !== null) updates.hp = hpUpdate;

    const updated = { ...myCharacter, ...updates };
    setMyCharacter(updated);
    setAllCharacters(prev => prev.map(c => c.id === myCharacter.id ? updated : c));
    // Keep server position tightly synced during active combat; otherwise throttle writes.
    if (combatStatus === "active" || combatStatus === "starting") {
      if (moveWriteTimerRef.current) {
        clearTimeout(moveWriteTimerRef.current);
        moveWriteTimerRef.current = null;
      }
      base44.entities.Character.update(myCharacter.id, updates).catch(() => {});
    } else {
      if (moveWriteTimerRef.current) clearTimeout(moveWriteTimerRef.current);
      moveWriteTimerRef.current = setTimeout(() => {
        base44.entities.Character.update(myCharacter.id, updates).catch(() => {});
        moveWriteTimerRef.current = null;
      }, 300);
    }

    applyQuestProgress({ type: "travel_step", amount: 1 });
    if (zone?.id) applyQuestProgress({ type: "visit_zone", zoneId: zone.id, amount: 1 });
    if (poi?.type === "resource_node" && poi.resource) {
      applyQuestProgress({ type: "gather_resource", resource: poi.resource, amount: 1 });
    }
    recordReplayFrame({
      move: { from: { x: myCharacter.x, y: myCharacter.y }, to: { x: newX, y: newY } },
      sprint: { active: isSprinting, runEnergy },
    });

    return "moved";
  }, [myCharacter, monsters, cancelFastTravel, activeEvents, applyQuestProgress, recordReplayFrame, isSprinting, runEnergy, combatStatus]);

  // â”€â”€â”€ Input controller (WASD, hotkeys, Tab-target, auto-attack) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleMovementBlocked = useCallback((reason, payload) => {
    if (reason === "monster" && payload?.monster) {
      setActiveTarget({ entity: payload.monster, type: "monster" });
      return;
    }
    if (reason === "collision" && payload?.reason) {
      setCombatError(payload.reason);
    }
  }, []);

  const characterAbilities = myCharacter?.abilities || [];
  const {
    lockedTarget,
    lockTarget,
    clearTarget,
    autoAttacking,
    cooldowns,
    runEnergy: runEnergyState,
    isSprinting: sprintingState,
  } =
    useInputController({
      myCharacter,
      monsters,
      onMove: handleMove,
      onStartCombat: startCombat,
      onAbilityInput: (ability) => {
        if (!ability) return;
        sendCombatIntent({
          hand: "right",
          intentType: "ability_cast",
          abilityId: ability.id,
          mouseVector: aimVec,
        });
      },
      onInteractIntent: () => {
        if (activeTarget?.type === "npc") interactWithNpc(activeTarget.entity);
      },
      onMovementBlocked: handleMovementBlocked,
      abilities: characterAbilities,
      externalCooldowns: authoritativeCooldowns,
      enabled: !showInventory && !questOffer,
    });

  useEffect(() => {
    setRunEnergy(runEnergyState);
    setIsSprinting(sprintingState);
  }, [runEnergyState, sprintingState]);

  const voiceCommands = useVoiceAbilityCommands({
    enabled: !showInventory && !!myCharacter,
    onVoiceAction: ({ action, slot }) => {
      if (action !== "use_hotbar") return;
      const idx = Math.max(0, Math.min(8, Number(slot) - 1));
      const ability = characterAbilities[idx];
      if (!ability) {
        setCombatError(`No ability in slot ${slot}`);
        combatAudio.playUiCue("error");
        return;
      }
      sendCombatIntent({
        hand: "right",
        intentType: "ability_cast",
        abilityId: ability.id,
        mouseVector: aimVec,
      });
    },
  });

  useEffect(() => {
    if (!combatSession?.id || combatStatus !== "active") return;
    const tick = setInterval(async () => {
      try {
        const res = await gameService.combatAction({
          action: "tick",
          session_id: combatSession.id,
          timestamp: Date.now(),
        });
        await processCombatResult(res);
      } catch (e) {
        setCombatError(String(e?.message || e));
      }
    }, 900);

    const sync = setInterval(async () => {
      try {
        const res = await gameService.combatAction({
          action: "sync",
          session_id: combatSession.id,
          timestamp: Date.now(),
        });
        if (res?.session) {
          setCombatSession(res.session);
          if (res.session.actor_ability_cooldowns) setAuthoritativeCooldowns(res.session.actor_ability_cooldowns);
        }
        if (Array.isArray(res?.events) && res.events.length > 0) applyCombatEvents(res.events);
      } catch {
        // keep fail-open behavior for sync
      }
    }, 450);

    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [applyCombatEvents, combatSession?.id, combatStatus, processCombatResult]);

  // â”€â”€â”€ Authoritative target selection (click-path) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Tab-cycling â†’ lockTarget (in useInputController) â†’ lockedTarget state â†’ effect below.
  // Click-path â†’ selectTarget â†’ setActiveTarget + lockTarget (keep controller in sync).
  const selectTarget = useCallback((entity, type = "monster") => {
    setActiveTarget({ entity, type });
    lockTarget(type === "monster" ? entity : null);
  }, [lockTarget]);

  const clearActiveTarget = useCallback(() => {
    setActiveTarget(null);
  }, []);

  // Sync Tab-cycled lockedTarget into authoritative activeTarget
  useEffect(() => {
    if (!lockedTarget) return;
    setActiveTarget(prev =>
      prev?.entity?.id === lockedTarget.id ? prev : { entity: lockedTarget, type: "monster" }
    );
  }, [lockedTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€â”€ Combat mode (derived from authoritative state) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const combatMode = combatStatus === "active" || combatStatus === "starting" ? COMBAT_MODE.ACTIVE : COMBAT_MODE.PEACEFUL;

  const handleSendMessage = async (text, channel = "global") => {
    if (!myCharacter || !text.trim()) return;
    await base44.entities.ChatMessage.create({
      character_id: myCharacter.id,
      character_name: myCharacter.name,
      character_type: myCharacter.type,
      character_class: myCharacter.class,
      message: text,
      channel,
      x: myCharacter.x,
      y: myCharacter.y
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-amber-400 text-xl font-bold">
        Loading Agentic World...
      </div>
    );
  }

  if (!myCharacter) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-gray-400">You need a character to enter the world.</p>
        <Link to={createPageUrl("Characters")}>
          <button className="bg-amber-500 text-black font-bold px-6 py-2 rounded-lg hover:bg-amber-600">
            Create Character
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050609] overflow-hidden relative">
      <div className="absolute inset-0">
        {/* View toggle overlay */}
        <ViewToggle
          mode={viewMode}
          onChange={setViewMode}
          settings={sceneSettings}
          onSettingsChange={setSceneSettings}
        />

        {/* Classic 2D map (always mounted for minimap data, hidden in 3D mode) */}
        <div className={viewMode === "map" ? "w-full h-full" : "hidden"}>
          <WorldMap
            myCharacter={myCharacter}
            allCharacters={allCharacters}
            monsters={monsters}
            worldObjects={worldObjects}
            onMove={handleMove}
            activeEvents={activeEvents}
            onMonsterClick={(monster) => selectTarget(monster, "monster")}
          />
        </div>

        {/* 3D model-based world scene */}
         {viewMode === "3d" && myCharacter && (
           <WorldScene3D
             myCharacter={myCharacter}
             allCharacters={allCharacters}
             monsters={monsters}
             worldObjects={worldObjects}
             activeEvents={activeEvents}
             onMove={handleMove}
             onMonsterClick={(monster) => selectTarget(monster, "monster")}
            onNpcInteract={(npcRef) => selectTarget({
              ...npcRef,
              name: npcRef.poiName || NPC_INTERACTION_PROFILES[npcRef.npcType]?.name || "NPC",
            }, "npc")}
            onCombatIntent={(intent) => sendCombatIntent(intent)}
            onAimVector={(vec) => setAimVec(vec)}
            sceneSettings={sceneSettings}
            getCurrentZoomConfig={getCurrentZoomConfig}
          />
        )}

        <Minimap
          myCharacter={myCharacter}
          allCharacters={allCharacters}
          monsters={monsters}
          onFastTravel={requestFastTravel}
        />
        {fastTravelTarget && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30
              bg-gray-900/95 border border-amber-600 rounded-xl px-6 py-4 text-center pointer-events-auto"
              onClick={cancelFastTravel}>
              <p className="text-sm text-amber-400 font-bold mb-2">âš¡ Fast Traveling...</p>
              <div className="w-48 bg-gray-800 rounded-full h-3 mb-2">
                <div className="bg-amber-500 h-3 rounded-full transition-all"
                  style={{ width: `${fastTravelProgress}%` }} />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                To ({fastTravelTarget.x}, {fastTravelTarget.y}) Â· Click to cancel
              </p>
              <Button size="sm" variant="outline" className="border-gray-700 text-xs"
                onClick={e => { e.stopPropagation(); cancelFastTravel(); }}>Cancel</Button>
          </div>
        )}

        {/* Ability hotbar â€” bottom-center */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <AbilityHotbar
            abilities={characterAbilities}
            cooldowns={cooldowns}
            onUseAbility={(slot) => {
              const ab = characterAbilities[slot];
              if (ab && activeTarget?.type === "monster" && activeTarget?.entity) {
                sendCombatIntent({
                  hand: "right",
                  intentType: "ability_cast",
                  abilityId: ab.id,
                  mouseVector: aimVec,
                });
              }
            }}
            autoAttacking={autoAttacking}
          />
        </div>

        {/* Group window */}
        <GroupWindow
          myCharacter={myCharacter}
          allCharacters={allCharacters}
          onMoveFollower={null}
        />

        {/* Target frame â€” top-center, authoritative, single instance */}
        {activeTarget && myCharacter && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[25] pointer-events-auto">
            <TargetFrame
              target={activeTarget}
              myCharacter={myCharacter}
              combatMode={combatMode}
              x={myCharacter.x}
              y={myCharacter.y}
              onEngage={(entity) => startCombat(entity)}
              onInteract={(entity) => {
                if (activeTarget?.type === "npc") interactWithNpc(entity);
              }}
              onClear={() => { clearTarget(); clearActiveTarget(); }}
            />
          </div>
        )}

      </div>

      <ShadowbaneHUD
        character={myCharacter}
        runEnergy={runEnergy}
        isSprinting={isSprinting}
        combatStatus={combatStatus}
        targetName={activeTarget?.entity?.name || ""}
        voiceStatus={voice.status}
        pushToTalk={voice.pushToTalk}
        speaking={voice.speaking}
        onInventory={() => setShowInventory(true)}
      />

      <InWorldCombatPanel
        session={combatSession}
        status={combatStatus}
        combatError={combatError}
        aimVec={aimVec}
      />

      <ChatDock
        compactWorld
        messages={messages}
        onSend={handleSendMessage}
        myCharacter={myCharacter}
      />

      <VoiceOverlayPanel
        listening={voiceCommands.listening}
        supported={voiceCommands.supported}
        transcript={voiceCommands.lastTranscript}
        error={voiceCommands.lastError || voice.error}
        manualPrompt={voiceCommands.manualPrompt}
        manualInput={voiceCommands.manualInput}
        setManualInput={voiceCommands.setManualInput}
        submitManual={voiceCommands.submitManual}
        closeManual={() => voiceCommands.setManualPrompt(false)}
        pushToTalk={voice.pushToTalk}
        togglePushToTalk={voice.togglePushToTalk}
        remoteCount={voice.remotePeers.length || partyMembers.length}
      />

      <div className="hidden">
        {voice.remoteStreams.map((row) => (
          <VoiceStreamAudio key={row.peerId} stream={row.stream} />
        ))}
      </div>

    {showInventory && myCharacter && (
      <InventoryPanel
        open={showInventory}
        onClose={() => setShowInventory(false)}
        character={myCharacter}
        onUpdate={(updated) => {
          setMyCharacter(updated);
          setAllCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />
    )}

    {questOffer && (
      <QuestOfferModal
        offer={questOffer}
        onDecline={() => {
          setQuestOffer(null);
          postSystemChat("Quest declined.");
        }}
        onAccept={() => {
          const accepted = acceptQuestFromOffer(questOffer);
          const next = [...questsRef.current, accepted];
          questsRef.current = next;
          setCharacterQuests(next);
          persistQuestState(next);
          setQuestOffer(null);
          postSystemChat(`Quest accepted: ${accepted.title}`);
        }}
      />
    )}

    {/* Random encounter modal removed â€” monsters are persistent 3D world entities */}
  </div>
  );
}