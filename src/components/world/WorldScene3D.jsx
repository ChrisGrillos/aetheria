/**
 * WorldScene3D — Phase 3 model-based world presentation layer.
 *
 * AUTHORITY:
 * - This is a PRESENTATION LAYER ONLY.
 * - All movement, combat, and world state authority remains in pages/World.jsx + authorizedCombatEngine.
 * - This component reads world state and calls the same onMove/onMonsterClick callbacks as WorldMap.
 * - No new gameplay logic is introduced here.
 *
 * RENDERING:
 * - Three.js canvas, orthographic-leaning 3/4 camera (classic MMO perspective)
 * - Procedural low-poly character meshes per race
 * - Smooth position interpolation between tile centers
 * - Readable selection circles, nameplates, health bars
 * - Minimal restrained effects (selection flash, damage numbers via DOM overlay)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { getTile, getZoneAt, MAP_W, MAP_H, ZONES } from "@/components/shared/worldZones";
import { getRace, RACES } from "@/components/shared/raceData";
import { useAmbientWorld, AmbientHUDWidget } from "./AmbientWorld";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TILE_SIZE = 2;         // world units per tile
const CAMERA_HEIGHT = 22;
const CAMERA_DISTANCE = 18;
const CAMERA_ANGLE = 0.65;   // radians, isometric lean

const FOG_RADIUS = 10; // tiles

// Race visual config: height, body scale, color accents
const RACE_VISUALS = {
  human:      { height: 1.0, bodyW: 0.32, color: 0xd4a77a, accentColor: 0xfbbf24, headScale: 1.0 },
  elf:        { height: 1.05, bodyW: 0.26, color: 0xc5dba8, accentColor: 0x67e8f9, headScale: 0.95 },
  dwarf:      { height: 0.72, bodyW: 0.40, color: 0xb87333, accentColor: 0xfb923c, headScale: 1.15 },
  halfling:   { height: 0.60, bodyW: 0.28, color: 0xe8c88a, accentColor: 0x86efac, headScale: 1.10 },
  orc:        { height: 1.08, bodyW: 0.44, color: 0x6b8a5e, accentColor: 0xef4444, headScale: 1.05 },
  half_giant: { height: 1.35, bodyW: 0.55, color: 0x9ca3af, accentColor: 0xa855f7, headScale: 0.90 },
};

const MONSTER_VISUALS = {
  goblin:   { color: 0x4ade80, height: 0.55, bodyW: 0.30 },
  orc:      { color: 0x6b8a5e, height: 1.05, bodyW: 0.44 },
  dragon:   { color: 0xef4444, height: 1.40, bodyW: 0.60 },
  skeleton: { color: 0xe2e8f0, height: 0.90, bodyW: 0.26 },
  troll:    { color: 0x78716c, height: 1.20, bodyW: 0.50 },
  vampire:  { color: 0x9333ea, height: 1.00, bodyW: 0.30 },
  werewolf: { color: 0x92400e, height: 1.10, bodyW: 0.42 },
  wraith:   { color: 0x6366f1, height: 0.95, bodyW: 0.28 },
  basilisk: { color: 0x65a30d, height: 0.70, bodyW: 0.50 },
  kraken:   { color: 0x1d4ed8, height: 1.30, bodyW: 0.65 },
};

const TERRAIN_COLORS_3D = {
  grass:  0x2d5a27,
  forest: 0x1a3d1a,
  water:  0x1a3d6e,
  stone:  0x4a4a4a,
  sand:   0x8b7355,
  lava:   0x8b2500,
  swamp:  0x2a3d1a,
  plains: 0x4a5a20,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function tileToWorld(tx, ty) {
  return new THREE.Vector3(tx * TILE_SIZE, 0, ty * TILE_SIZE);
}

function buildPath(x0, y0, x1, y1) {
  if (x0 === x1 && y0 === y1) return [];
  const key = (x, y) => `${x},${y}`;
  const queue = [[x0, y0]];
  const visited = new Set([key(x0, y0)]);
  const parent = {};
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === x1 && cy === y1) {
      const path = [];
      let cur = key(x1, y1);
      while (cur !== key(x0, y0)) {
        const [px, py] = cur.split(",").map(Number);
        path.unshift([px, py]);
        cur = parent[cur];
      }
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (getTile(nx, ny) === "water") continue;
      visited.add(k);
      parent[k] = key(cx, cy);
      queue.push([nx, ny]);
    }
  }
  return [];
}

// ─── MESH BUILDERS ────────────────────────────────────────────────────────────

function buildCharacterMesh(raceId, isAI = false, isMonster = false, monsterSpecies = null) {
  const group = new THREE.Group();

  let vis;
  if (isMonster && monsterSpecies) {
    vis = MONSTER_VISUALS[monsterSpecies] || MONSTER_VISUALS.goblin;
  } else {
    vis = RACE_VISUALS[raceId] || RACE_VISUALS.human;
  }

  const h  = vis.height;
  const bw = vis.bodyW;
  const bodyColor  = vis.color;
  const accentColor = isMonster ? 0xff4444 : (isAI ? 0x67e8f9 : (vis.accentColor || 0xfbbf24));

  // Body
  const bodyGeo  = new THREE.BoxGeometry(bw, h * 0.55, bw * 0.7);
  const bodyMat  = new THREE.MeshLambertMaterial({ color: bodyColor });
  const body     = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h * 0.28;
  body.castShadow = true;
  group.add(body);

  // Head
  const headScale = vis.headScale || 1.0;
  const headSize  = bw * 0.72 * headScale;
  const headGeo   = new THREE.BoxGeometry(headSize, headSize, headSize);
  const headMat   = new THREE.MeshLambertMaterial({ color: bodyColor });
  const head      = new THREE.Mesh(headGeo, headMat);
  head.position.y = h * 0.65;
  head.castShadow = true;
  group.add(head);

  // Accent (belt / armor stripe)
  const accentGeo = new THREE.BoxGeometry(bw + 0.02, h * 0.07, bw * 0.72);
  const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const accent    = new THREE.Mesh(accentGeo, accentMat);
  accent.position.y = h * 0.28;
  group.add(accent);

  // Dwarf gets a beard block
  if (raceId === "dwarf") {
    const beardGeo = new THREE.BoxGeometry(headSize * 0.7, headSize * 0.45, headSize * 0.4);
    const beardMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const beard    = new THREE.Mesh(beardGeo, beardMat);
    beard.position.y = h * 0.65 - headSize * 0.35;
    beard.position.z = headSize * 0.3;
    group.add(beard);
  }

  // Half-giant gets extra shoulder blocks
  if (raceId === "half_giant") {
    [-1, 1].forEach(side => {
      const shGeo = new THREE.BoxGeometry(0.18, 0.14, 0.18);
      const shMat = new THREE.MeshLambertMaterial({ color: accentColor });
      const sh    = new THREE.Mesh(shGeo, shMat);
      sh.position.set(side * (bw * 0.55), h * 0.52, 0);
      group.add(sh);
    });
  }

  // Elf gets pointy "ear" spikes on head sides
  if (raceId === "elf") {
    [-1, 1].forEach(side => {
      const earGeo = new THREE.ConeGeometry(0.04, 0.14, 4);
      const earMat = new THREE.MeshLambertMaterial({ color: bodyColor });
      const ear    = new THREE.Mesh(earGeo, earMat);
      ear.position.set(side * headSize * 0.55, h * 0.65 + headSize * 0.1, 0);
      ear.rotation.z = side * Math.PI / 2.2;
      group.add(ear);
    });
  }

  // Shadow disc on ground
  const shadowGeo = new THREE.CircleGeometry(bw * 0.55, 8);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
  const shadow    = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // Selection ring (hidden by default)
  const ringGeo = new THREE.RingGeometry(bw * 0.6, bw * 0.75, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const ring    = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = "selectionRing";
  group.add(ring);

  // HP bar plane (world-space, always faces camera via billboard in animate loop)
  const hpBarGeo = new THREE.PlaneGeometry(bw * 1.4, 0.07);
  const hpBarBgMat = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
  const hpBarBg = new THREE.Mesh(hpBarGeo, hpBarBgMat);
  hpBarBg.position.y = h + 0.28;
  hpBarBg.name = "hpBarBg";
  group.add(hpBarBg);

  const hpBarFillGeo = new THREE.PlaneGeometry(bw * 1.4, 0.07);
  const hpBarFillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const hpBarFill = new THREE.Mesh(hpBarFillGeo, hpBarFillMat);
  hpBarFill.position.y = h + 0.28;
  hpBarFill.position.z = 0.001;
  hpBarFill.name = "hpBarFill";
  group.add(hpBarFill);

  return group;
}

function buildSelectionCircle(radius = 0.8, color = 0xfbbf24) {
  const geo = new THREE.RingGeometry(radius - 0.05, radius, 32);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  return mesh;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function WorldScene3D({
  myCharacter,
  allCharacters,
  monsters,
  worldObjects,
  activeEvents,
  onMove,
  onMonsterClick,
  sceneSettings = {},
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const rafRef = useRef(null);

  // Interpolated player position (smooth movement)
  const playerPosRef = useRef(null);
  const playerTargetRef = useRef(null);

  // Character meshes keyed by id
  const charMeshesRef = useRef({});
  // Monster meshes keyed by id
  const monsterMeshesRef = useRef({});
  // Terrain tiles (cached)
  const terrainRef = useRef(null);

  // State for DOM overlays (nameplates, damage numbers)
  const [nameplates, setNameplates] = useState([]);
  const [damageNums, setDamageNums] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Refs for callbacks to avoid stale closure
  const myCharRef = useRef(myCharacter);
  myCharRef.current = myCharacter;
  const allCharsRef = useRef(allCharacters);
  allCharsRef.current = allCharacters;
  const monstersRef = useRef(monsters);
  monstersRef.current = monsters;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onMonsterClickRef = useRef(onMonsterClick);
  onMonsterClickRef.current = onMonsterClick;

  const movingRef = useRef(false);
  const pendingPathRef = useRef([]);

  const settings = {
    showNameplates: true,
    showHealthBars: true,
    cameraDistance: 1.0,
    ...sceneSettings,
  };

  // ─── INIT THREE.JS ─────────────────────────────────────────────────────────

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.FogExp2(0x030712, 0.018);
    sceneRef.current = scene;

    // Camera — orthographic-leaning perspective for classic MMO feel
    const aspect = mount.clientWidth / mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 300);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambient = new THREE.AmbientLight(0xffeedd, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff3cd, 1.2);
    sun.position.set(20, 40, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // Subtle fill from below
    const fill = new THREE.DirectionalLight(0x4466bb, 0.2);
    fill.position.set(-10, -5, 10);
    scene.add(fill);

    // Build terrain (chunked — only near player)
    buildTerrain(scene);

    // Resize handler
    const handleResize = () => {
      if (!mount || !renderer || !camera) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // Animate loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const myChar = myCharRef.current;

      // Smooth camera follow
      if (myChar) {
        if (!playerPosRef.current) {
          playerPosRef.current = tileToWorld(myChar.x, myChar.y).clone();
          playerTargetRef.current = tileToWorld(myChar.x, myChar.y).clone();
        }
        // Lerp player visual position
        if (playerTargetRef.current) {
          playerPosRef.current.lerp(playerTargetRef.current, 0.18);
        }

        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        const dist = CAMERA_DISTANCE * settings.cameraDistance;

        camera.position.set(
          px - Math.sin(Math.PI * 0.15) * dist,
          CAMERA_HEIGHT * settings.cameraDistance * 0.85,
          pz + Math.cos(Math.PI * 0.15) * dist
        );
        camera.lookAt(px, 0, pz);

        // Move player mesh
        const myMesh = charMeshesRef.current[myChar.id];
        if (myMesh) {
          myMesh.position.x = playerPosRef.current.x;
          myMesh.position.z = playerPosRef.current.z;
          // Idle bob
          myMesh.position.y = Math.sin(Date.now() * 0.002) * 0.05;
          // Face movement direction
          const target = playerTargetRef.current;
          const dx = target.x - myMesh.position.x;
          const dz = target.z - myMesh.position.z;
          if (Math.abs(dx) + Math.abs(dz) > 0.05) {
            myMesh.rotation.y = Math.atan2(dx, dz);
          }
          // Update selection ring pulse
          const ring = myMesh.getObjectByName("selectionRing");
          if (ring) {
            ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
          }
          // Update HP bar billboard
          billboardHpBar(myMesh, myChar, camera);
        }
      }

      // Update other character meshes
      allCharsRef.current.forEach(c => {
        if (myChar && c.id === myChar.id) return;
        const mesh = charMeshesRef.current[c.id];
        if (mesh) {
          const target = tileToWorld(c.x, c.y);
          mesh.position.lerp(new THREE.Vector3(target.x, mesh.position.y, target.z), 0.12);
          mesh.position.y = Math.sin(Date.now() * 0.002 + c.id.charCodeAt(0)) * 0.04;
          billboardHpBar(mesh, c, camera);
        }
      });

      // Update monster meshes
      monstersRef.current.forEach(m => {
        if (!m.is_alive) return;
        const mesh = monsterMeshesRef.current[m.id];
        if (mesh) {
          mesh.position.y = Math.sin(Date.now() * 0.003 + m.id.charCodeAt(0)) * 0.06;
          // Monster idle sway
          mesh.rotation.y = Math.sin(Date.now() * 0.001 + m.id.charCodeAt(0)) * 0.15;
          billboardHpBar(mesh, m, camera);

          // Red pulsing ring for monsters
          const ring = mesh.getObjectByName("selectionRing");
          if (ring) {
            ring.material.color.setHex(0xef4444);
            ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          }
        }
      });

      // Update nameplates (DOM overlay positions)
      updateNameplatePositions(camera, renderer);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  // ─── TERRAIN ───────────────────────────────────────────────────────────────

  function buildTerrain(scene) {
    // Build visible terrain around player spawn
    const group = new THREE.Group();
    group.name = "terrain";

    const RANGE = 30; // tiles around center
    const cx = myCharacter?.x ?? 20;
    const cy = myCharacter?.y ?? 20;

    for (let ty = Math.max(0, cy - RANGE); ty < Math.min(MAP_H, cy + RANGE); ty++) {
      for (let tx = Math.max(0, cx - RANGE); tx < Math.min(MAP_W, cx + RANGE); tx++) {
        const tile = getTile(tx, ty);
        const color = TERRAIN_COLORS_3D[tile] ?? 0x2d5a27;

        const geo = new THREE.BoxGeometry(TILE_SIZE, tile === "water" ? 0.05 : 0.18, TILE_SIZE);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(tx * TILE_SIZE, tile === "water" ? -0.09 : 0, ty * TILE_SIZE);
        mesh.receiveShadow = true;
        mesh.userData = { tx, ty, tile };
        group.add(mesh);
      }
    }
    terrainRef.current = group;
    scene.add(group);
  }

  // ─── SYNC CHARACTERS → MESHES ─────────────────────────────────────────────

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !myCharacter) return;

    // Ensure player mesh exists
    if (!charMeshesRef.current[myCharacter.id]) {
      const mesh = buildCharacterMesh(myCharacter.race || "human", false, false);
      const wp = tileToWorld(myCharacter.x, myCharacter.y);
      mesh.position.copy(wp);
      mesh.userData = { charId: myCharacter.id, isMe: true };
      scene.add(mesh);
      charMeshesRef.current[myCharacter.id] = mesh;

      // Show selection ring for self
      const ring = mesh.getObjectByName("selectionRing");
      if (ring) ring.material.opacity = 0.7;

      playerPosRef.current = wp.clone();
      playerTargetRef.current = wp.clone();
    }
  }, [myCharacter?.id]);

  // Update player target on position change
  useEffect(() => {
    if (!myCharacter) return;
    if (playerTargetRef.current) {
      const wp = tileToWorld(myCharacter.x, myCharacter.y);
      playerTargetRef.current.set(wp.x, 0, wp.z);
    }
  }, [myCharacter?.x, myCharacter?.y]);

  // Sync other characters
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existing = new Set(Object.keys(charMeshesRef.current));

    allCharacters.forEach(c => {
      if (myCharacter && c.id === myCharacter.id) return;

      if (!charMeshesRef.current[c.id]) {
        const isAI = c.type === "ai_agent";
        const mesh = buildCharacterMesh(c.race || "human", isAI, false);
        const wp = tileToWorld(c.x, c.y);
        mesh.position.copy(wp);
        mesh.userData = { charId: c.id, isAI };
        // Color AI agents in cyan accent
        if (isAI) {
          mesh.traverse(child => {
            if (child.isMesh && child.name !== "hpBarBg" && child.name !== "hpBarFill") {
              child.material = child.material.clone();
              child.material.emissive = new THREE.Color(0x0e7490);
              child.material.emissiveIntensity = 0.15;
            }
          });
        }
        scene.add(mesh);
        charMeshesRef.current[c.id] = mesh;
      }
      existing.delete(c.id);
    });

    // Remove departed characters (keep self)
    existing.forEach(id => {
      if (myCharacter && id === myCharacter.id) return;
      const mesh = charMeshesRef.current[id];
      if (mesh) { scene.remove(mesh); delete charMeshesRef.current[id]; }
    });
  }, [allCharacters]);

  // Sync monsters
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existing = new Set(Object.keys(monsterMeshesRef.current));

    monsters.forEach(m => {
      if (!m.is_alive) {
        // Remove dead monsters
        if (monsterMeshesRef.current[m.id]) {
          scene.remove(monsterMeshesRef.current[m.id]);
          delete monsterMeshesRef.current[m.id];
        }
        return;
      }
      if (!monsterMeshesRef.current[m.id]) {
        const mesh = buildCharacterMesh(null, false, true, m.species);
        const wp = tileToWorld(m.x, m.y);
        mesh.position.copy(wp);
        mesh.userData = { monsterId: m.id, isMonster: true };
        // Enemy red tint
        mesh.traverse(child => {
          if (child.isMesh && child.name !== "hpBarBg" && child.name !== "hpBarFill") {
            child.material = child.material.clone();
            child.material.emissive = new THREE.Color(0x7f0000);
            child.material.emissiveIntensity = 0.12;
          }
        });
        scene.add(mesh);
        monsterMeshesRef.current[m.id] = mesh;
      }
      existing.delete(m.id);
    });

    existing.forEach(id => {
      const mesh = monsterMeshesRef.current[id];
      if (mesh) { scene.remove(mesh); delete monsterMeshesRef.current[id]; }
    });
  }, [monsters]);

  // ─── HP BAR BILLBOARD ──────────────────────────────────────────────────────

  function billboardHpBar(mesh, entity, camera) {
    if (!settings.showHealthBars) return;
    const bg = mesh.getObjectByName("hpBarBg");
    const fill = mesh.getObjectByName("hpBarFill");
    if (!bg || !fill) return;

    // Always face camera
    bg.quaternion.copy(camera.quaternion);
    fill.quaternion.copy(camera.quaternion);

    const hp = entity.hp ?? entity.max_hp ?? 100;
    const maxHp = entity.max_hp ?? 100;
    const pct = Math.max(0, Math.min(1, hp / maxHp));

    // Scale fill
    fill.scale.x = pct;
    fill.position.x = (pct - 1) * (bg.geometry.parameters.width / 2);

    // Color by HP %
    const color = pct > 0.6 ? 0x22c55e : pct > 0.3 ? 0xf59e0b : 0xef4444;
    fill.material.color.setHex(color);
  }

  // ─── NAMEPLATE POSITIONS ───────────────────────────────────────────────────

  const nameplateDataRef = useRef([]);

  function updateNameplatePositions(camera, renderer) {
    if (!settings.showNameplates) { setNameplates([]); return; }
    const plates = [];
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    const project = (worldPos) => {
      const v = worldPos.clone().project(camera);
      return { x: (v.x + 1) / 2 * w, y: -(v.y - 1) / 2 * h, behind: v.z > 1 };
    };

    // Player
    const myChar = myCharRef.current;
    if (myChar && playerPosRef.current) {
      const labelPos = playerPosRef.current.clone();
      const vis = RACE_VISUALS[myChar.race || "human"] || RACE_VISUALS.human;
      labelPos.y += vis.height + 0.6;
      const { x, y, behind } = project(labelPos);
      if (!behind) plates.push({ id: myChar.id, name: myChar.name, x, y, type: "me", level: myChar.level || 1 });
    }

    // Other chars
    allCharsRef.current.forEach(c => {
      if (myChar && c.id === myChar.id) return;
      const mesh = charMeshesRef.current[c.id];
      if (!mesh) return;
      const labelPos = mesh.position.clone();
      const vis = RACE_VISUALS[c.race || "human"] || RACE_VISUALS.human;
      labelPos.y += vis.height + 0.6;
      const { x, y, behind } = project(labelPos);
      if (!behind) plates.push({ id: c.id, name: c.name, x, y, type: c.type === "ai_agent" ? "ai" : "player", level: c.level || 1 });
    });

    // Monsters
    monstersRef.current.filter(m => m.is_alive).forEach(m => {
      const mesh = monsterMeshesRef.current[m.id];
      if (!mesh) return;
      const labelPos = mesh.position.clone();
      const vis = MONSTER_VISUALS[m.species] || MONSTER_VISUALS.goblin;
      labelPos.y += vis.height + 0.65;
      const { x, y, behind } = project(labelPos);
      if (!behind) plates.push({ id: m.id, name: `${m.name} Lv.${m.level}`, x, y, type: "monster", hp: m.hp, maxHp: m.max_hp });
    });

    setNameplates(plates);
  }

  // ─── CLICK HANDLING ───────────────────────────────────────────────────────

  const handleCanvasClick = useCallback((e) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene || movingRef.current) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check monster clicks first
    const monsterMeshes = Object.values(monsterMeshesRef.current);
    const monsterHits = raycaster.intersectObjects(monsterMeshes, true);
    if (monsterHits.length > 0) {
      let obj = monsterHits[0].object;
      while (obj.parent && !obj.userData.monsterId) obj = obj.parent;
      if (obj.userData.monsterId && onMonsterClickRef.current) {
        const monster = monstersRef.current.find(m => m.id === obj.userData.monsterId);
        if (monster) {
          setSelectedTarget({ type: "monster", entity: monster });
          onMonsterClickRef.current(monster);
          return;
        }
      }
    }

    // Check character clicks
    const charMeshes = Object.values(charMeshesRef.current).filter(m => !m.userData.isMe);
    const charHits = raycaster.intersectObjects(charMeshes, true);
    if (charHits.length > 0) {
      let obj = charHits[0].object;
      while (obj.parent && !obj.userData.charId) obj = obj.parent;
      if (obj.userData.charId) {
        const char = allCharsRef.current.find(c => c.id === obj.userData.charId);
        if (char) { setSelectedTarget({ type: "character", entity: char }); return; }
      }
    }

    // Click on terrain → move
    const terrain = terrainRef.current;
    if (!terrain) return;
    const terrainHits = raycaster.intersectObjects(terrain.children, false);
    if (terrainHits.length > 0) {
      const hit = terrainHits[0].object;
      const { tx, ty, tile } = hit.userData;
      if (tile === "water") return;
      const myChar = myCharRef.current;
      if (!myChar) return;

      const path = buildPath(myChar.x, myChar.y, tx, ty);
      if (path.length > 0) {
        pendingPathRef.current = path;
        walkPath(path);
      }
      setSelectedTarget(null);
    }
  }, []);

  // ─── PATH WALKING ──────────────────────────────────────────────────────────

  const walkPath = useCallback(async (path) => {
    if (!path.length) { movingRef.current = false; pendingPathRef.current = []; return; }
    movingRef.current = true;

    for (let i = 0; i < path.length; i++) {
      if (!movingRef.current) break;
      const [nx, ny] = path[i];
      pendingPathRef.current = path.slice(i + 1);
      if (playerTargetRef.current) {
        const wp = tileToWorld(nx, ny);
        playerTargetRef.current.set(wp.x, 0, wp.z);
      }

      if (onMoveRef.current) {
        const result = await onMoveRef.current(nx, ny);
        if (result === "combat") {
          movingRef.current = false;
          pendingPathRef.current = [];
          return;
        }
      }
      await new Promise(r => setTimeout(r, 180));
    }

    movingRef.current = false;
    pendingPathRef.current = [];
  }, []);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const nameplateColors = {
    me: "text-amber-400 border-amber-600",
    player: "text-blue-300 border-blue-800",
    ai: "text-cyan-400 border-cyan-800",
    monster: "text-red-400 border-red-900",
  };

  return (
    <div className="w-full h-full relative bg-gray-950 overflow-hidden">
      {/* Three.js canvas mount */}
      <div
        ref={mountRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
        style={{ cursor: movingRef.current ? "wait" : "crosshair" }}
      />

      {/* DOM Nameplates */}
      {settings.showNameplates && nameplates.map(plate => (
        <div
          key={plate.id}
          className={`absolute pointer-events-none select-none text-center`}
          style={{ left: plate.x, top: plate.y, transform: "translate(-50%, -100%)" }}
        >
          <div className={`text-xs font-bold px-1.5 py-0.5 rounded border bg-gray-950/80 ${nameplateColors[plate.type] || "text-gray-300 border-gray-700"}`}>
            {plate.name}
            {plate.level && plate.type !== "monster" && (
              <span className="ml-1 opacity-60 text-[10px]">Lv.{plate.level}</span>
            )}
          </div>
        </div>
      ))}

      {/* Target frame (selected entity) */}
      {selectedTarget && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <TargetFrame target={selectedTarget} />
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-600 bg-gray-900/80 px-2 py-1 rounded pointer-events-none">
        Click terrain to move · Click entities to target · Right-click monsters to attack
      </div>

      {/* Scene indicator */}
      <div className="absolute top-2 right-2 text-xs text-gray-700 bg-gray-900/60 px-2 py-1 rounded pointer-events-none">
        3D View
      </div>
    </div>
  );
}

// ─── TARGET FRAME ─────────────────────────────────────────────────────────────

function TargetFrame({ target }) {
  const { type, entity } = target;
  const isMonster = type === "monster";
  const hp = entity.hp ?? entity.max_hp ?? 100;
  const maxHp = entity.max_hp ?? 100;
  const hpPct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const hpColor = hpPct > 60 ? "bg-green-500" : hpPct > 30 ? "bg-yellow-500" : "bg-red-600 animate-pulse";

  return (
    <div className={`bg-gray-900/95 border rounded-lg px-3 py-2 text-xs min-w-40 ${isMonster ? "border-red-700" : "border-blue-700"}`}>
      <div className={`font-bold ${isMonster ? "text-red-400" : "text-blue-300"}`}>
        {isMonster ? "⚔️ " : "🧑 "}{entity.name}
        {entity.level && <span className="ml-1 opacity-60">Lv.{entity.level}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-gray-500">HP</span>
        <div className="flex-1 bg-gray-800 rounded-full h-2">
          <div className={`${hpColor} h-2 rounded-full transition-all`} style={{ width: `${hpPct}%` }} />
        </div>
        <span className="text-gray-400">{hp}/{maxHp}</span>
      </div>
      {entity.base_class && (
        <div className="text-gray-600 mt-0.5 capitalize">{entity.base_class} · {entity.race || "human"}</div>
      )}
      {entity.species && (
        <div className="text-gray-600 mt-0.5 capitalize">{entity.species}</div>
      )}
    </div>
  );
}