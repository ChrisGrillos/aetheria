/**
 * WorldScene3D — Visual presentation layer only.
 * Authority (movement, combat, targeting) stays in pages/World.jsx.
 * This file: Three.js canvas, camera, terrain, character meshes, DOM overlays.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { getZoneAt } from "@/components/shared/worldZones";
import { buildPath, getMovementCollisionSnapshot, isPassable } from "@/components/shared/movementAuthority";
import { useAmbientWorld, AmbientHUDWidget } from "./AmbientWorld";
import { createTownWalkers } from "./TownWalkers";
import { createNPCEntities } from "./NPCEntities";
import { buildProceduralTerrain, getTerrainHeight, worldPosToTile } from "./proceduralTerrain";
import { buildTerrainProps } from "./terrainProps";
import { buildCharacterMesh as buildNewCharMesh, buildMonsterMesh as buildNewMonsterMesh } from "./characterModels";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TILE_SIZE   = 2;

// ─── RACE VISUALS (kept for nameplate height lookups) ─────────────────────────

const RACE_VISUALS = {
  human:      { height: 1.00, bodyW: 0.32 },
  elf:        { height: 1.10, bodyW: 0.26 },
  dwarf:      { height: 0.72, bodyW: 0.44 },
  halfling:   { height: 0.58, bodyW: 0.28 },
  orc:        { height: 1.12, bodyW: 0.48 },
  half_giant: { height: 1.45, bodyW: 0.60 },
};

const MONSTER_VISUALS = {
  goblin:   { height: 0.55, bodyW: 0.30 },
  orc:      { height: 1.08, bodyW: 0.48 },
  dragon:   { height: 1.60, bodyW: 0.70 },
  skeleton: { height: 0.92, bodyW: 0.24 },
  troll:    { height: 1.30, bodyW: 0.54 },
  vampire:  { height: 1.02, bodyW: 0.30 },
  werewolf: { height: 1.15, bodyW: 0.46 },
  wraith:   { height: 0.98, bodyW: 0.28 },
  basilisk: { height: 0.75, bodyW: 0.54 },
  kraken:   { height: 1.40, bodyW: 0.70 },
};

// ─── VISUAL STATE SYSTEM ─────────────────────────────────────────────────────
// Tracks per-entity timed visual reactions. entityStates[id] = { state, expiresAt, phase }
const entityStates = {};
const STATE_PRIORITY = { attack: 1, hurt: 2, cast: 2, death: 9 };
const STATE_DURATION = { attack: 420, hurt: 360, cast: 820, death: 1300 };

export function triggerEntityState(entityId, state, durationMs = 400) {
  if (!entityId || !state) return;
  const now = Date.now();
  const nextPriority = STATE_PRIORITY[state] ?? 0;
  const nextDuration = Number(durationMs || STATE_DURATION[state] || 400);
  const prev = entityStates[entityId];

  if (prev && prev.expiresAt > now) {
    const prevPriority = Number(prev.priority || STATE_PRIORITY[prev.state] || 0);
    if (prev.state === "death") return;
    if (prevPriority > nextPriority && state !== "death") return;
  }

  entityStates[entityId] = {
    state,
    expiresAt: now + nextDuration,
    phase: 0,
    priority: nextPriority,
  };
}

// Called from outside (e.g. CombatOverlay) to drive visual reactions
// States: 'attack' | 'cast' | 'hurt' | 'death'

function applyEntityStateVisuals(mesh, entityId, now) {
  const es = entityStates[entityId];
  if (!es) return;

  const dur = es.state === "death" ? 1200 : es.state === "cast" ? 800 : 400;
  const elapsed = now - (es.expiresAt - dur);

  if (now > es.expiresAt) {
    // Reset
    mesh.rotation.z = 0;
    mesh.scale.setScalar(1);
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        try { child.material.emissive.setHex(mesh.userData.baseEmissive ?? 0x000000); } catch(e) {}
        child.material.emissiveIntensity = mesh.userData.baseEmissiveIntensity ?? 0;
      }
    });
    delete entityStates[entityId];
    return;
  }

  const p   = Math.min(1, elapsed / dur);

  if (es.state === "attack") {
    // Quick forward lunge + orange flash
    const lunge = Math.sin(p * Math.PI) * 0.28;
    mesh.position.z -= lunge * 0.5;
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        try { child.material.emissive.setHex(0xff5500); } catch(e) {}
        child.material.emissiveIntensity = (1 - p) * 0.9;
      }
    });
  } else if (es.state === "cast") {
    // Slow pulse up/down + blue glow
    mesh.position.y += Math.sin(p * Math.PI * 3) * 0.06;
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        try { child.material.emissive.setHex(0x4499ff); } catch(e) {}
        child.material.emissiveIntensity = 0.5 + Math.sin(p * Math.PI * 4) * 0.4;
      }
    });
  } else if (es.state === "hurt") {
    // Recoil backward + red flash + tilt
    mesh.rotation.z = Math.sin(p * Math.PI * 3) * 0.3;
    mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) {
        try { child.material.emissive.setHex(0xff0000); } catch(e) {}
        child.material.emissiveIntensity = (1 - p) * 1.2;
      }
    });
  } else if (es.state === "death") {
    // Tilt sideways + sink into ground + fade emissive dark
    mesh.rotation.z = p * Math.PI * 0.5; // fall over
    mesh.position.y = -p * 0.8;          // sink
    mesh.scale.setScalar(1 - p * 0.3);   // shrink slightly
    mesh.traverse(child => {
      if (child.isMesh && child.material) {
        if (child.material.emissive) {
          try { child.material.emissive.setHex(0x220000); } catch(e) {}
          child.material.emissiveIntensity = 0.2;
        }
        if (child.material.opacity !== undefined && child.material.transparent) {
          child.material.opacity = Math.max(0.1, 1 - p);
        }
      }
    });
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function tileToWorld(tx, ty) {
  const h = getTerrainHeight(tx, ty);
  return new THREE.Vector3(tx * TILE_SIZE, h, ty * TILE_SIZE);
}

function lerp3(v, target, t) {
  v.lerp(target, t);
}

function buildCollisionDebugGroup() {
  const snapshot = getMovementCollisionSnapshot();
  const group = new THREE.Group();
  group.name = "collisionDebug";

  snapshot.cellsBlocked.forEach((cell) => {
    const color =
      cell.reason === "wall"
        ? 0xff8a00
        : cell.reason === "building"
          ? 0xef4444
          : cell.reason === "poi"
            ? 0xfacc15
            : 0x38bdf8;

    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 0.86, TILE_SIZE * 0.86),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(cell.x * TILE_SIZE, getTerrainHeight(cell.x, cell.y) + 0.06, cell.y * TILE_SIZE);
    tile.userData.reason = cell.reason;
    group.add(tile);
  });

  return group;
}

// ─── MESH BUILDERS (delegating to new modules) ──────────────────────────────

function buildCharacterAppearance(character) {
  const appearance = (character?.appearance && typeof character.appearance === "object") ? character.appearance : {};
  return {
    facePreset: String(appearance.facePreset || character?.face_preset || "classic"),
    hairPreset: String(appearance.hairPreset || character?.hair_preset || "short"),
    facialHair: String(appearance.facialHair || character?.facial_hair || "none"),
    skinTone: String(appearance.skinTone || character?.skin_tone || "light"),
    hairColor: String(appearance.hairColor || character?.hair_color || "black"),
    marking: String(appearance.marking || character?.marking || "none"),
  };
}

function buildCharacterMesh(raceId, isAI = false, isMonster = false, monsterSpecies = null, baseClass = null, appearance = null) {
  if (isMonster && monsterSpecies) {
    return buildNewMonsterMesh(monsterSpecies);
  }
  return buildNewCharMesh(raceId, isAI, baseClass, appearance);
}

// ─── TERRAIN BUILDER (procedural) ───────────────────────────────────────────

function buildTerrain(scene, cx, cy) {
  const group = new THREE.Group();
  group.name = "terrain";

  // Procedural heightmap mesh
  const terrainMesh = buildProceduralTerrain(cx, cy, 32);
  group.add(terrainMesh);

  // Scatter props (trees, rocks, buildings, walls)
  const props = buildTerrainProps(cx, cy, 32);
  group.add(props);

  scene.add(group);
  return group;
}

// ─── HP BAR BILLBOARD ────────────────────────────────────────────────────────

function billboardHpBar(mesh, entity, camera, showBars) {
  const bg   = mesh.getObjectByName("hpBarBg");
  const fill = mesh.getObjectByName("hpBarFill");
  if (!bg || !fill || !bg.material || !fill.material) return;

  if (!showBars) { bg.visible = false; fill.visible = false; return; }
  bg.visible = fill.visible = true;

  if (bg.quaternion && camera.quaternion) bg.quaternion.copy(camera.quaternion);
  if (fill.quaternion && camera.quaternion) fill.quaternion.copy(camera.quaternion);

  const hp    = entity.hp ?? entity.max_hp ?? 100;
  const maxHp = entity.max_hp ?? 100;
  const pct   = Math.max(0.001, Math.min(1, hp / maxHp));
  fill.scale.x = pct;
  const barW = bg.geometry?.parameters?.width ?? 1.5;
  fill.position.x = (pct - 1) * (barW / 2);
  if (fill.material?.color) {
    fill.material.color.setHex(pct > 0.6 ? 0x22c55e : pct > 0.3 ? 0xf59e0b : 0xef4444);
  }
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function WorldScene3D({
  myCharacter,
  allCharacters,
  monsters,
  worldObjects,
  activeEvents,
  onMove,
  onMonsterClick,
  onNpcInteract,
  onCombatIntent,
  onAimVector,
  sceneSettings = {},
  getCurrentZoomConfig = () => ({ distance: 24, height: 28, angle: 0.62, fov: 42 }),
}) {
  const mountRef     = useRef(null);
  const sceneRef     = useRef(null);
  const cameraRef    = useRef(null);
  const rendererRef  = useRef(null);
  const rafRef       = useRef(null);
  const sunLightRef  = useRef(null);
  const ambLightRef  = useRef(null);
  const fogRef       = useRef(null);
  const terrainRef   = useRef(null);
  const collisionDebugRef = useRef(null);

  const playerPosRef    = useRef(null);
  const playerTargetRef = useRef(null);

  const charMeshesRef    = useRef({});
  const monsterMeshesRef = useRef({});
  const townWalkersRef   = useRef(null);
  const npcEntitiesRef   = useRef(null);

  const [nameplates, setNameplates] = useState([]);

  const myCharRef          = useRef(myCharacter);  myCharRef.current = myCharacter;
  const allCharsRef        = useRef(allCharacters); allCharsRef.current = allCharacters;
  const monstersRef        = useRef(monsters);      monstersRef.current = monsters;
  const onMoveRef          = useRef(onMove);        onMoveRef.current = onMove;
  const onMonsterClickRef  = useRef(onMonsterClick); onMonsterClickRef.current = onMonsterClick;
  const onNpcInteractRef   = useRef(onNpcInteract); onNpcInteractRef.current = onNpcInteract;
  const onCombatIntentRef  = useRef(onCombatIntent); onCombatIntentRef.current = onCombatIntent;
  const onAimVectorRef     = useRef(onAimVector); onAimVectorRef.current = onAimVector;

  const movingRef      = useRef(false);
  const pendingPathRef = useRef([]);
  const heldCombatRef  = useRef({ timer: null, hand: null });
  const lastAimRef     = useRef({ x: 1, y: 0 });

  const settings = {
    showNameplates: true,
    showHealthBars: true,
    showCollisionDebug: false,
    cameraDistance: 1.0,
    ...sceneSettings,
  };

  // ─── INIT ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c1a);
    scene.fog = new THREE.FogExp2(0x060c1a, 0.014);
    sceneRef.current = scene;
    fogRef.current = scene.fog;

    const aspect = mount.clientWidth / mount.clientHeight;
    const zoomConfig = getCurrentZoomConfig();
    const camera = new THREE.PerspectiveCamera(zoomConfig.fov || 42, aspect, 0.1, 400);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambient = new THREE.AmbientLight(0xffeedd, 0.55);
    scene.add(ambient);
    ambLightRef.current = ambient;

    const sun = new THREE.DirectionalLight(0xfff2cc, 1.3);
    sun.position.set(25, 50, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 220;
    sun.shadow.camera.left  = -80;
    sun.shadow.camera.right =  80;
    sun.shadow.camera.top   =  80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);
    sunLightRef.current = sun;

    // Hemisphere sky/ground fill
    const hemi = new THREE.HemisphereLight(0x80a0ff, 0x2a3a10, 0.35);
    scene.add(hemi);

    // Build terrain
    const cx = myCharacter?.x ?? 30;
    const cy = myCharacter?.y ?? 25;
    terrainRef.current = buildTerrain(scene, cx, cy);

    const collisionOverlay = buildCollisionDebugGroup();
    collisionOverlay.visible = !!settings.showCollisionDebug;
    scene.add(collisionOverlay);
    collisionDebugRef.current = collisionOverlay;

    // Spawn visual-only town walker NPCs
    townWalkersRef.current = createTownWalkers(scene);

    // Create 3D merchant/NPC entities in High Bastion
    npcEntitiesRef.current = createNPCEntities(scene);

    // Resize
    const onResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // Animate
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const myChar = myCharRef.current;
      const now = Date.now();

      if (myChar) {
        const wp = tileToWorld(myChar.x, myChar.y);
        if (!playerPosRef.current) {
          playerPosRef.current = wp.clone();
          playerTargetRef.current = wp.clone();
        }
        lerp3(playerPosRef.current, playerTargetRef.current, 0.16);

        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        
        // Get current zoom config with smooth interpolation
        const zoom = getCurrentZoomConfig();
        const dist = zoom.distance;
        const height = zoom.height;
        const angle = zoom.angle;

        // Classic 3/4 MMO camera with dynamic angle and height based on zoom
        const terrainY = playerPosRef.current.y || 0;
        camera.position.set(
          px - Math.sin(angle) * dist,
          terrainY + height,
          pz + Math.cos(angle) * dist
        );
        const lookAtY = getTerrainHeight(Math.round(px / TILE_SIZE), Math.round(pz / TILE_SIZE));
        camera.lookAt(px, lookAtY, pz);
        camera.fov = zoom.fov;
        camera.updateProjectionMatrix();

        const myMesh = charMeshesRef.current[myChar.id];
        if (myMesh) {
          myMesh.position.x = playerPosRef.current.x;
          myMesh.position.z = playerPosRef.current.z;
          myMesh.position.y = playerPosRef.current.y + Math.sin(now * 0.0018) * 0.04; // terrain height + idle bob

          // Face direction of movement
          const dx = playerTargetRef.current.x - myMesh.position.x;
          const dz = playerTargetRef.current.z - myMesh.position.z;
          if (Math.abs(dx) + Math.abs(dz) > 0.05) {
            myMesh.rotation.y = Math.atan2(dx, dz);
          }

          // Player selection ring pulse
          const ring = myMesh.getObjectByName("selectionRing");
          if (ring && ring.material) ring.material.opacity = 0.55 + Math.sin(now * 0.004) * 0.28;

          // Player state reactions
          if (!entityStates[myChar.id]) myMesh.position.y = playerPosRef.current.y + Math.sin(now * 0.0018) * 0.04;
          applyEntityStateVisuals(myMesh, myChar.id, now);

          billboardHpBar(myMesh, myChar, camera, settings.showHealthBars);
        }
      }

      // Other chars
      allCharsRef.current.forEach(c => {
        if (myChar && c.id === myChar.id) return;
        const mesh = charMeshesRef.current[c.id];
        if (!mesh) return;
        const target = tileToWorld(c.x, c.y);
        mesh.position.lerp(new THREE.Vector3(target.x, target.y, target.z), 0.12);
        if (!entityStates[c.id]) mesh.position.y = target.y + Math.sin(now * 0.0018 + c.id.charCodeAt(0)) * 0.04;
        applyEntityStateVisuals(mesh, c.id, now);
        billboardHpBar(mesh, c, camera, settings.showHealthBars);
      });

      // Monsters
      monstersRef.current.forEach(m => {
        if (!m.is_alive) return;
        const mesh = monsterMeshesRef.current[m.id];
        if (!mesh) return;
        if (!entityStates[m.id]) {
          const mh = getTerrainHeight(m.x, m.y);
          mesh.position.y = mh + Math.sin(now * 0.0024 + m.id.charCodeAt(0)) * 0.06;
          mesh.rotation.y = Math.sin(now * 0.0010 + m.id.charCodeAt(0)) * 0.18;
        }
        applyEntityStateVisuals(mesh, m.id, now);
        billboardHpBar(mesh, m, camera, settings.showHealthBars);

        const ring = mesh.getObjectByName("selectionRing");
        if (ring && ring.material) ring.material.opacity = 0.25 + Math.sin(now * 0.003 + m.id.charCodeAt(0)) * 0.18;
      });

      // Animate visual NPC walkers
      if (townWalkersRef.current) townWalkersRef.current.update(now);

      // Update NPC entities
      if (npcEntitiesRef.current) npcEntitiesRef.current.update(now);

      updateNameplateDom(camera, renderer);
      try {
        renderer.render(scene, camera);
      } catch(e) {
        console.error("Render error:", e);
      }
    };
    animate();

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      if (townWalkersRef.current) townWalkersRef.current.dispose();
      if (npcEntitiesRef.current) npcEntitiesRef.current.dispose();
      if (collisionDebugRef.current) {
        scene.remove(collisionDebugRef.current);
        collisionDebugRef.current = null;
      }
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line

  // ─── SYNC PLAYER ───────────────────────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !myCharacter) return;
    if (!charMeshesRef.current[myCharacter.id]) {
      const mesh = buildCharacterMesh(
        myCharacter.race || "human",
        false,
        false,
        null,
        myCharacter.base_class || myCharacter.class,
        buildCharacterAppearance(myCharacter)
      );
      const wp   = tileToWorld(myCharacter.x, myCharacter.y);
      mesh.position.copy(wp);
      mesh.userData = { charId: myCharacter.id, isMe: true };
      scene.add(mesh);
      charMeshesRef.current[myCharacter.id] = mesh;
      playerPosRef.current    = wp.clone();
      playerTargetRef.current = wp.clone();
      // Show own ring
      const ring = mesh.getObjectByName("selectionRing");
      if (ring && ring.material) ring.material.opacity = 0.7;
    }
  }, [myCharacter?.id]); // eslint-disable-line

  useEffect(() => {
    if (!myCharacter || !playerTargetRef.current) return;
    const wp = tileToWorld(myCharacter.x, myCharacter.y);
    playerTargetRef.current.set(wp.x, wp.y, wp.z);
  }, [myCharacter?.x, myCharacter?.y]); // eslint-disable-line

  useEffect(() => {
    if (!collisionDebugRef.current) return;
    collisionDebugRef.current.visible = !!sceneSettings?.showCollisionDebug;
  }, [sceneSettings?.showCollisionDebug]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !collisionDebugRef.current || !sceneSettings?.showCollisionDebug) return;
    scene.remove(collisionDebugRef.current);
    const rebuilt = buildCollisionDebugGroup();
    rebuilt.visible = true;
    scene.add(rebuilt);
    collisionDebugRef.current = rebuilt;
  }, [sceneSettings?.showCollisionDebug, monsters, allCharacters]);

  // ─── SYNC OTHER CHARS ──────────────────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const existing = new Set(Object.keys(charMeshesRef.current));

    allCharacters.forEach(c => {
      if (myCharacter && c.id === myCharacter.id) return;
      if (!charMeshesRef.current[c.id]) {
        const isAI = c.type === "ai_agent";
        const mesh = buildCharacterMesh(
          c.race || "human",
          isAI,
          false,
          null,
          c.base_class || c.class,
          buildCharacterAppearance(c)
        );
        const wp   = tileToWorld(c.x, c.y);
        mesh.position.copy(wp);
        mesh.userData = { charId: c.id, isAI };
        if (isAI) {
          mesh.traverse(child => {
            if (child.isMesh && !["hpBarBg","hpBarFill"].includes(child.name) && child.material) {
              child.material = child.material.clone();
              child.material.emissive = new THREE.Color(0x0e7490);
              child.material.emissiveIntensity = 0.18;
            }
          });
        }
        scene.add(mesh);
        charMeshesRef.current[c.id] = mesh;
      }
      existing.delete(c.id);
    });

    existing.forEach(id => {
      if (myCharacter && id === myCharacter.id) return;
      const m = charMeshesRef.current[id];
      if (m) { scene.remove(m); delete charMeshesRef.current[id]; }
    });
  }, [allCharacters]); // eslint-disable-line

  // ─── SYNC MONSTERS ─────────────────────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const existing = new Set(Object.keys(monsterMeshesRef.current));

    monsters.forEach(m => {
      if (!m.is_alive) {
        if (monsterMeshesRef.current[m.id]) {
          scene.remove(monsterMeshesRef.current[m.id]);
          delete monsterMeshesRef.current[m.id];
        }
        return;
      }
      if (!monsterMeshesRef.current[m.id]) {
        const mesh = buildCharacterMesh(null, false, true, m.species);
        const wp   = tileToWorld(m.x, m.y);
        mesh.position.copy(wp);
        mesh.userData = { monsterId: m.id, isMonster: true };
        mesh.traverse(child => {
          if (child.isMesh && !["hpBarBg","hpBarFill"].includes(child.name) && child.material) {
            child.material = child.material.clone();
            child.material.emissive = new THREE.Color(0x5a0000);
            child.material.emissiveIntensity = 0.14;
          }
        });
        scene.add(mesh);
        monsterMeshesRef.current[m.id] = mesh;
        // Show monster ring immediately
        const ring = mesh.getObjectByName("selectionRing");
        if (ring && ring.material) ring.material.opacity = 0.35;
      }
      existing.delete(m.id);
    });

    existing.forEach(id => {
      const m = monsterMeshesRef.current[id];
      if (m) { scene.remove(m); delete monsterMeshesRef.current[id]; }
    });
  }, [monsters]); // eslint-disable-line

  // ─── AMBIENT WORLD ─────────────────────────────────────────────────────────

  const { gameHour, timeLabel, weatherLabel } = useAmbientWorld(sceneRef, sunLightRef, ambLightRef, fogRef);

  // ─── NAMEPLATE DOM ─────────────────────────────────────────────────────────

  function updateNameplateDom(camera, renderer) {
    if (!settings.showNameplates) { setNameplates([]); return; }
    const plates = [];
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    const project = (worldPos) => {
      const v = worldPos.clone().project(camera);
      return { x: (v.x + 1) / 2 * w, y: -(v.y - 1) / 2 * h, behind: v.z > 1 };
    };

    const myChar = myCharRef.current;
    if (myChar && playerPosRef.current) {
      const lp = playerPosRef.current.clone();
      lp.y += (RACE_VISUALS[myChar.race || "human"] || RACE_VISUALS.human).height + 0.7;
      const { x, y, behind } = project(lp);
      if (!behind) plates.push({ id: myChar.id, name: myChar.name, x, y, type: "me", level: myChar.level || 1, sub: myChar.base_class || myChar.class });
    }

    allCharsRef.current.forEach(c => {
      if (myChar && c.id === myChar.id) return;
      const mesh = charMeshesRef.current[c.id];
      if (!mesh) return;
      const lp = mesh.position.clone();
      lp.y += (RACE_VISUALS[c.race || "human"] || RACE_VISUALS.human).height + 0.7;
      const { x, y, behind } = project(lp);
      if (!behind) plates.push({ id: c.id, name: c.name, x, y, type: c.type === "ai_agent" ? "ai" : "player", level: c.level || 1, sub: c.base_class || c.class });
    });

    monstersRef.current.filter(m => m.is_alive).forEach(m => {
      const mesh = monsterMeshesRef.current[m.id];
      if (!mesh) return;
      const lp = mesh.position.clone();
      lp.y += (MONSTER_VISUALS[m.species] || MONSTER_VISUALS.goblin).height + 0.70;
      const { x, y, behind } = project(lp);
      if (!behind) plates.push({ id: m.id, name: m.name, x, y, type: "monster", level: m.level || 1, sub: m.species, hp: m.hp, maxHp: m.max_hp });
    });

    setNameplates(plates);
  }

  // ─── CLICK HANDLING ───────────────────────────────────────────────────────

  const handleCanvasClick = useCallback((e) => {
    if (e.ctrlKey) return;
    const renderer = rendererRef.current;
    const camera   = cameraRef.current;
    const scene    = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    const rect  = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );

    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);

    // NPCs first (High Bastion traders/merchants)
    if (npcEntitiesRef.current) {
      const npcHits = ray.intersectObjects(Object.values(npcEntitiesRef.current.meshes), true);
      if (npcHits.length > 0) {
        let obj = npcHits[0].object;
        while (obj.parent && !obj.userData.isNPC) obj = obj.parent;
        if (obj.userData.poiId && obj.userData.npcType) {
          const posTile = worldPosToTile(obj.position.x, obj.position.z);
          onNpcInteractRef.current?.({
            id: `npc_${obj.userData.poiId}`,
            type: "npc",
            poiId: obj.userData.poiId,
            poiName: obj.userData.poiName,
            npcType: obj.userData.npcType,
            x: obj.userData.tileX ?? posTile.tx,
            y: obj.userData.tileY ?? posTile.ty,
          });
          return;
        }
      }
    }

    // Monsters next
    const mHits = ray.intersectObjects(Object.values(monsterMeshesRef.current), true);
    if (mHits.length > 0) {
      let obj = mHits[0].object;
      while (obj.parent && !obj.userData.monsterId) obj = obj.parent;
      if (obj.userData.monsterId && onMonsterClickRef.current) {
        const monster = monstersRef.current.find(m => m.id === obj.userData.monsterId);
        if (monster) { onMonsterClickRef.current(monster); return; }
      }
    }

    // Other characters
    const cHits = ray.intersectObjects(
      Object.values(charMeshesRef.current).filter(m => !m.userData.isMe), true
    );
    if (cHits.length > 0) {
      let obj = cHits[0].object;
      while (obj.parent && !obj.userData.charId) obj = obj.parent;
      // Character targeting handled at World level via onMonsterClick-equivalent
      return;
    }

    // Terrain → move (raycast against procedural terrain mesh + props)
    const terrain = terrainRef.current;
    if (!terrain) return;
    const tHits = ray.intersectObjects(terrain.children, true);
    if (tHits.length > 0) {
      const hitPoint = tHits[0].point;
      const { tx, ty } = worldPosToTile(hitPoint.x, hitPoint.z);
      if (!isPassable(tx, ty)) return;
      const myChar = myCharRef.current;
      if (!myChar) return;
      if (movingRef.current) { movingRef.current = false; pendingPathRef.current = []; }
      const path = buildPath(myChar.x, myChar.y, tx, ty);
      if (path.length > 0) walkPath(path);
    }
  }, []); // eslint-disable-line

  const walkPath = useCallback(async (path) => {
    if (!path.length) { movingRef.current = false; return; }
    movingRef.current = true;
    for (let i = 0; i < path.length; i++) {
      if (!movingRef.current) break;
      const [nx, ny] = path[i];
      pendingPathRef.current = path.slice(i + 1);
      if (playerTargetRef.current) {
        const wp = tileToWorld(nx, ny);
        playerTargetRef.current.set(wp.x, wp.y, wp.z);
      }
      if (onMoveRef.current) {
        const result = await onMoveRef.current(nx, ny);
        if (result === "combat" || result === "blocked") {
          movingRef.current = false;
          pendingPathRef.current = [];
          return;
        }
      }
      // Slower step delay to avoid API rate limits on Character.update per tile
      await new Promise(r => setTimeout(r, 350));
    }
    movingRef.current = false;
    pendingPathRef.current = [];
  }, []); // eslint-disable-line

  const handleCanvasMouseMove = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const mag = Math.sqrt((dx * dx) + (dy * dy)) || 1;
    const nextAim = { x: dx / mag, y: dy / mag };
    lastAimRef.current = nextAim;
    onAimVectorRef.current?.(nextAim);
  }, []);

  const stopHeldCombat = useCallback(() => {
    if (heldCombatRef.current.timer) {
      clearInterval(heldCombatRef.current.timer);
      heldCombatRef.current.timer = null;
    }
    heldCombatRef.current.hand = null;
  }, []);

  const handleCanvasMouseDown = useCallback((e) => {
    e.currentTarget.focus();
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const hand = e.button === 2 ? "right" : e.button === 0 ? "left" : null;
    if (!hand) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const mag = Math.sqrt((dx * dx) + (dy * dy)) || 1;
    const mouseVector = { x: dx / mag, y: dy / mag };
    lastAimRef.current = mouseVector;

    stopHeldCombat();

    const fireIntent = () => {
      onCombatIntentRef.current?.({
        hand,
        intentType: "swing",
        mouseVector: lastAimRef.current,
        timestamp: Date.now(),
      });
    };

    fireIntent();
    heldCombatRef.current.hand = hand;
    heldCombatRef.current.timer = setInterval(fireIntent, 250);
  }, [stopHeldCombat]);

  useEffect(() => {
    const onWindowMouseUp = () => stopHeldCombat();
    const onWindowBlur = () => stopHeldCombat();
    window.addEventListener("mouseup", onWindowMouseUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp);
      window.removeEventListener("blur", onWindowBlur);
      stopHeldCombat();
    };
  }, [stopHeldCombat]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const nameplateStyle = {
    me:      "text-amber-200 border-amber-600 bg-black/90 shadow-sm shadow-amber-900/40",
    player:  "text-sky-200   border-sky-700   bg-black/90 shadow-sm shadow-sky-900/40",
    ai:      "text-cyan-200  border-cyan-700  bg-black/90 shadow-sm shadow-cyan-900/40",
    monster: "text-red-300   border-red-800   bg-black/90 shadow-sm shadow-red-900/40",
  };

  return (
    <div className="w-full h-full relative bg-gray-950 overflow-hidden">
      {/* Three.js mount */}
      <div
        ref={mountRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={stopHeldCombat}
        onMouseLeave={stopHeldCombat}
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={0}
        style={{ cursor: "crosshair" }}
      />

      {/* DOM nameplates */}
      {settings.showNameplates && nameplates.map(plate => (
        <div
          key={plate.id}
          className="absolute pointer-events-none select-none text-center"
          style={{ left: plate.x, top: plate.y, transform: "translate(-50%, -100%)" }}
        >
          <div className={`text-[11px] font-bold px-2 py-0.5 rounded border leading-tight whitespace-nowrap ${nameplateStyle[plate.type] || "text-gray-300 border-gray-700 bg-black/90"}`}>
            {plate.type === "me" && <span className="mr-1 text-[9px]">{">"}</span>}
            <span>{plate.name}</span>
            {plate.level && <span className="ml-1.5 opacity-55 text-[9px] font-normal">Lv.{plate.level}</span>}
          </div>
          {/* Mini HP bar under nameplate for monsters */}
          {plate.type === "monster" && plate.maxHp && (
            <div className="w-full mt-0.5 h-1.5 bg-gray-900/90 rounded-full overflow-hidden border border-gray-700/50">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.max(2, Math.min(100, (plate.hp / plate.maxHp) * 100))}%`,
                  backgroundColor: plate.hp / plate.maxHp > 0.6 ? "#22c55e" : plate.hp / plate.maxHp > 0.3 ? "#f59e0b" : "#ef4444"
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Zone identity banner — shows when in a named zone */}
      <ZoneBanner myCharacter={myCharacter} />

      {/* Day/night widget */}
      <div className="absolute top-2 right-2 pointer-events-none flex flex-col items-end gap-1.5">
        <AmbientHUDWidget gameHour={gameHour} timeLabel={timeLabel} weatherLabel={weatherLabel} />
        {settings.showCollisionDebug && (
          <div className="rounded border border-orange-500/70 bg-black/70 px-2 py-1 text-[10px] text-orange-200">
            Collision Debug On
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ZONE BANNER ─────────────────────────────────────────────────────────────

function ZoneBanner({ myCharacter }) {
  const [banner, setBanner] = useState(null);
  const lastZoneRef = useRef(null);
  const hideTimerRef = useRef(null);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!myCharacter) {
      clearHideTimer();
      setBanner(null);
      return;
    }

    const zone = getZoneAt(myCharacter.x, myCharacter.y);
    const zoneId = zone?.id ?? null;
    if (zoneId !== lastZoneRef.current) {
      lastZoneRef.current = zoneId;
      if (zone) {
        clearHideTimer();
        setBanner(zone);
        hideTimerRef.current = setTimeout(() => {
          setBanner(null);
          hideTimerRef.current = null;
        }, 2600);
      } else {
        clearHideTimer();
        setBanner(null);
      }
    }
  }, [myCharacter?.x, myCharacter?.y, clearHideTimer]); // eslint-disable-line

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  if (!banner) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none
      flex flex-col items-center gap-1"
      style={{ animationDuration: "2.5s" }}>
      <div className="text-3xl">{banner.emoji}</div>
      <div className="text-white font-black text-base tracking-[0.25em] uppercase drop-shadow-lg"
        style={{ textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
        {banner.name}
      </div>
    </div>
  );
}
