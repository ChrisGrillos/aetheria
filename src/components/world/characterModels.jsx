/**
 * CharacterModels — Upgraded low-poly character and monster mesh builders.
 * Replaces the old box-people with more detailed representations:
 *   - Rounded heads (SphereGeometry)
 *   - Jointed limbs with proper proportions
 *   - Class-indicator weapons/accessories
 *   - Race-specific features (elf ears, dwarf beards, orc tusks, etc.)
 *   - Monster species with distinct silhouettes (dragon wings, skeleton ribs, etc.)
 */

import * as THREE from "three";

// ─── RACE VISUAL CONFIGS ─────────────────────────────────────────────────────

const RACE_VIS = {
  human:      { h: 1.00, bw: 0.32, skinColor: 0xd4a77a, accent: 0xfbbf24, headScale: 1.0 },
  elf:        { h: 1.10, bw: 0.26, skinColor: 0xb8d99a, accent: 0x67e8f9, headScale: 0.95 },
  dwarf:      { h: 0.72, bw: 0.44, skinColor: 0xb07030, accent: 0xfb923c, headScale: 1.15 },
  halfling:   { h: 0.58, bw: 0.28, skinColor: 0xd8b870, accent: 0x86efac, headScale: 1.10 },
  orc:        { h: 1.12, bw: 0.48, skinColor: 0x5a7a4e, accent: 0xef4444, headScale: 1.05 },
  half_giant: { h: 1.45, bw: 0.60, skinColor: 0x8090a0, accent: 0xa855f7, headScale: 0.90 },
};

const MONSTER_VIS = {
  goblin:   { h: 0.55, bw: 0.30, color: 0x44bb60 },
  orc:      { h: 1.08, bw: 0.48, color: 0x5a7a4e },
  dragon:   { h: 1.60, bw: 0.70, color: 0xcc2200 },
  skeleton: { h: 0.92, bw: 0.24, color: 0xdde8ee },
  troll:    { h: 1.30, bw: 0.54, color: 0x706050 },
  vampire:  { h: 1.02, bw: 0.30, color: 0x8822cc },
  werewolf: { h: 1.15, bw: 0.46, color: 0x7a3d10 },
  wraith:   { h: 0.98, bw: 0.28, color: 0x5055cc },
  basilisk: { h: 0.75, bw: 0.54, color: 0x558800 },
  kraken:   { h: 1.40, bw: 0.70, color: 0x1040b8 },
};

// Class → weapon/accessory color
const CLASS_COLORS = {
  warrior:   0x888888,
  hunter:    0x4a6a20,
  healer:    0xe0c0e0,
  wizard:    0x4466cc,
  merchant:  0xd4a017,
  craftsman: 0x8b6040,
};

const SKIN_TONE_COLORS = {
  light: 0xe0bf96,
  tan: 0xc6925f,
  olive: 0xa67f54,
  dark: 0x6b4a2e,
};

const HAIR_COLORS = {
  black: 0x1b1714,
  brown: 0x4d3320,
  blonde: 0xcfa45c,
  red: 0x9c4f27,
  gray: 0x9da1a7,
  silver: 0xc7c8d3,
};

const MARKING_COLORS = {
  tattoo: 0x19304f,
  warpaint: 0xa01212,
  scar: 0x6c3b31,
};

// ─── SHARED GEOMETRY CACHE ───────────────────────────────────────────────────

const _geoCache = {};
function cachedGeo(key, factory) {
  if (!_geoCache[key]) _geoCache[key] = factory();
  return _geoCache[key];
}

// ─── HELPER: create a limb group ─────────────────────────────────────────────

function makeLimb(width, height, depth, color) {
  // Upper + lower segments for a jointed look
  const upperH = height * 0.55;
  const lowerH = height * 0.50;
  const geo1 = new THREE.BoxGeometry(width, upperH, depth);
  const geo2 = new THREE.BoxGeometry(width * 0.85, lowerH, depth * 0.85);
  const mat = new THREE.MeshLambertMaterial({ color });

  const upper = new THREE.Mesh(geo1, mat);
  upper.position.y = upperH * 0.5;
  upper.castShadow = true;

  const lower = new THREE.Mesh(geo2, mat.clone());
  lower.material.color.multiplyScalar(0.85);
  lower.position.y = -lowerH * 0.5;
  lower.castShadow = true;

  const joint = new THREE.Group();
  joint.add(upper);
  const lowerGroup = new THREE.Group();
  lowerGroup.position.y = upperH;
  lowerGroup.add(lower);
  joint.add(lowerGroup);

  return joint;
}

// ─── BUILD CHARACTER MESH ────────────────────────────────────────────────────

export function buildCharacterMesh(raceId, isAI = false, baseClass = null, appearance = null) {
  const vis = RACE_VIS[raceId] || RACE_VIS.human;
  const group = new THREE.Group();

  const h = vis.h;
  const bw = vis.bw;
  const skinTone = String(appearance?.skinTone || "");
  const hairTone = String(appearance?.hairColor || "");
  const markingType = String(appearance?.marking || "none");
  const hairPreset = String(appearance?.hairPreset || "short");
  const facialHair = String(appearance?.facialHair || "none");
  const skinColor = SKIN_TONE_COLORS[skinTone] || vis.skinColor;
  const hairColor = HAIR_COLORS[hairTone] || 0x3b2a1d;
  const accentColor = isAI ? 0x22ccdd : vis.accent;
  const classColor = CLASS_COLORS[baseClass] || 0x888888;

  // ── LEGS ──
  const legH = h * 0.38;
  const legW = bw * 0.28;
  [-1, 1].forEach(side => {
    // Thigh
    const thighGeo = new THREE.BoxGeometry(legW, legH * 0.55, legW);
    const thighMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const thigh = new THREE.Mesh(thighGeo, thighMat);
    thigh.position.set(side * bw * 0.20, legH * 0.55 * 0.5, 0);
    thigh.castShadow = true;
    group.add(thigh);

    // Shin (slightly thinner, darker)
    const shinGeo = new THREE.BoxGeometry(legW * 0.85, legH * 0.50, legW * 0.85);
    const shinMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinColor).multiplyScalar(0.8).getHex() });
    const shin = new THREE.Mesh(shinGeo, shinMat);
    shin.position.set(side * bw * 0.20, legH * 0.55 + legH * 0.50 * 0.5 - 0.02, 0);
    shin.castShadow = true;
    group.add(shin);

    // Boot
    const bootGeo = new THREE.BoxGeometry(legW * 1.1, legH * 0.18, legW * 1.3);
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(side * bw * 0.20, 0.02, legW * 0.1);
    boot.castShadow = true;
    group.add(boot);
  });

  // ── TORSO (two-part: chest + waist) ──
  const torsoH = h * 0.30;
  const chestGeo = new THREE.BoxGeometry(bw, torsoH * 0.65, bw * 0.65);
  const chestMat = new THREE.MeshLambertMaterial({ color: classColor });
  const chest = new THREE.Mesh(chestGeo, chestMat);
  chest.position.y = legH + torsoH * 0.65 * 0.5;
  chest.castShadow = true;
  group.add(chest);

  const waistGeo = new THREE.BoxGeometry(bw * 0.92, torsoH * 0.40, bw * 0.58);
  const waistMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(classColor).multiplyScalar(0.75).getHex() });
  const waist = new THREE.Mesh(waistGeo, waistMat);
  waist.position.y = legH + torsoH * 0.40 * 0.3;
  waist.castShadow = true;
  group.add(waist);

  // ── BELT / SASH ──
  const beltGeo = new THREE.BoxGeometry(bw + 0.04, h * 0.04, bw * 0.68);
  const beltMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = legH + torsoH * 0.08;
  group.add(belt);

  // ── SHOULDERS (pauldrons for warrior types) ──
  const shoulderY = legH + torsoH * 0.60;
  if (baseClass === "warrior" || raceId === "half_giant" || raceId === "orc") {
    [-1, 1].forEach(side => {
      const pGeo = new THREE.SphereGeometry(bw * 0.22, 6, 4);
      const pMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
      const pauldron = new THREE.Mesh(pGeo, pMat);
      pauldron.scale.y = 0.7;
      pauldron.position.set(side * bw * 0.58, shoulderY, 0);
      group.add(pauldron);
    });
  }

  // ── ARMS ──
  const armH = h * 0.34;
  const armW = bw * 0.22;
  [-1, 1].forEach(side => {
    // Upper arm
    const uaGeo = new THREE.BoxGeometry(armW, armH * 0.50, armW);
    const uaMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const upperArm = new THREE.Mesh(uaGeo, uaMat);
    upperArm.position.set(side * (bw * 0.58), shoulderY - armH * 0.25, 0);
    upperArm.castShadow = true;
    group.add(upperArm);

    // Forearm
    const faGeo = new THREE.BoxGeometry(armW * 0.85, armH * 0.45, armW * 0.85);
    const faMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinColor).multiplyScalar(0.9).getHex() });
    const forearm = new THREE.Mesh(faGeo, faMat);
    forearm.position.set(side * (bw * 0.58), shoulderY - armH * 0.72, 0);
    forearm.castShadow = true;
    group.add(forearm);

    // Hand
    const handGeo = new THREE.SphereGeometry(armW * 0.55, 5, 4);
    const handMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const hand = new THREE.Mesh(handGeo, handMat);
    hand.position.set(side * (bw * 0.58), shoulderY - armH * 0.95, 0);
    group.add(hand);
  });

  // ── NECK ──
  const neckH = h * 0.05;
  const neckGeo = new THREE.CylinderGeometry(bw * 0.12, bw * 0.15, neckH, 6);
  const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  const neckY = legH + torsoH + neckH * 0.5;
  neck.position.y = neckY;
  group.add(neck);

  // ── HEAD (sphere!) ──
  const headR = bw * 0.36 * (vis.headScale || 1.0);
  const headGeo = cachedGeo(`head_${Math.round(headR * 100)}`, () => new THREE.SphereGeometry(headR, 8, 6));
  const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const head = new THREE.Mesh(headGeo, headMat);
  const headY = neckY + neckH * 0.5 + headR;
  head.position.y = headY;
  head.castShadow = true;
  group.add(head);

  if (hairPreset !== "shaved") {
    const hairGeo = cachedGeo("hairCap", () => new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55));
    const hair = new THREE.Mesh(
      hairGeo,
      new THREE.MeshLambertMaterial({ color: hairColor }),
    );
    const presetScale =
      hairPreset === "long" ? 1.18 :
      hairPreset === "braid" ? 1.1 :
      hairPreset === "crown" ? 1.06 :
      1.02;
    hair.scale.set(headR * presetScale, headR * (hairPreset === "long" ? 1.2 : 1.0), headR * presetScale);
    hair.position.set(0, headY + headR * 0.22, 0);
    group.add(hair);
  }

  // ── EYES ──
  [-1, 1].forEach(side => {
    const eyeGeo = cachedGeo("eye", () => new THREE.SphereGeometry(headR * 0.12, 5, 4));
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * headR * 0.38, headY + headR * 0.08, headR * 0.82);
    group.add(eye);

    // Eye white
    const whiteGeo = cachedGeo("eyeWhite", () => new THREE.SphereGeometry(headR * 0.16, 5, 4));
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
    const white = new THREE.Mesh(whiteGeo, whiteMat);
    white.position.set(side * headR * 0.38, headY + headR * 0.08, headR * 0.76);
    group.add(white);
  });

  // ── RACE-SPECIFIC FEATURES ──
  if (raceId === "elf" || raceId === "halfling") {
    // Pointed ears
    [-1, 1].forEach(side => {
      const earGeo = new THREE.ConeGeometry(headR * 0.15, headR * 0.55, 4);
      const earMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(side * headR * 0.95, headY + headR * 0.2, 0);
      ear.rotation.z = side * 1.2;
      group.add(ear);
    });
  }

  if (raceId === "dwarf") {
    // Thick beard
    const beardGeo = new THREE.BoxGeometry(headR * 1.5, headR * 1.0, headR * 0.7);
    const beardMat = new THREE.MeshLambertMaterial({ color: hairColor });
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, headY - headR * 0.7, headR * 0.3);
    group.add(beard);

    // Helmet/cap
    const helmetGeo = new THREE.SphereGeometry(headR * 1.08, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const helmetMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = headY + headR * 0.08;
    group.add(helmet);
  }

  if (raceId === "orc") {
    // Tusks
    [-1, 1].forEach(side => {
      const tuskGeo = new THREE.ConeGeometry(headR * 0.08, headR * 0.35, 4);
      const tuskMat = new THREE.MeshLambertMaterial({ color: 0xeee8d0 });
      const tusk = new THREE.Mesh(tuskGeo, tuskMat);
      tusk.position.set(side * headR * 0.45, headY - headR * 0.3, headR * 0.6);
      tusk.rotation.x = -0.3;
      group.add(tusk);
    });

    // Brow ridge
    const browGeo = new THREE.BoxGeometry(headR * 1.6, headR * 0.15, headR * 0.3);
    const browMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(skinColor).multiplyScalar(0.8).getHex() });
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(0, headY + headR * 0.6, headR * 0.4);
    group.add(brow);
  }

  if (raceId === "half_giant") {
    // Broader jaw
    const jawGeo = new THREE.BoxGeometry(headR * 1.8, headR * 0.4, headR * 0.5);
    const jawMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const jaw = new THREE.Mesh(jawGeo, jawMat);
    jaw.position.set(0, headY - headR * 0.6, headR * 0.15);
    group.add(jaw);
  }

  if (facialHair !== "none" && raceId !== "dwarf") {
    const facialGeo = new THREE.BoxGeometry(headR * 0.95, headR * 0.42, headR * 0.28);
    const facial = new THREE.Mesh(
      facialGeo,
      new THREE.MeshLambertMaterial({ color: hairColor }),
    );
    facial.position.set(0, headY - headR * 0.54, headR * 0.42);
    group.add(facial);
  }

  if (markingType !== "none") {
    const markingColor = MARKING_COLORS[markingType] || MARKING_COLORS.tattoo;
    const markingGeo = new THREE.BoxGeometry(headR * 0.16, headR * 0.55, 0.01);
    const marking = new THREE.Mesh(
      markingGeo,
      new THREE.MeshBasicMaterial({ color: markingColor, transparent: true, opacity: 0.9 }),
    );
    marking.position.set(0, headY, headR * 0.95);
    group.add(marking);
  }

  // ── CLASS-SPECIFIC WEAPONS/ACCESSORIES ──
  const weaponY = shoulderY - h * 0.20;
  if (baseClass === "warrior") {
    // Sword on right side
    const bladeGeo = new THREE.BoxGeometry(0.06, h * 0.42, 0.04);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(bw * 0.58, weaponY, -bw * 0.25);
    group.add(blade);

    const hiltGeo = new THREE.BoxGeometry(0.14, 0.06, 0.04);
    const hiltMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
    const hilt = new THREE.Mesh(hiltGeo, hiltMat);
    hilt.position.set(bw * 0.58, weaponY - h * 0.21, -bw * 0.25);
    group.add(hilt);
  } else if (baseClass === "wizard") {
    // Staff on left
    const staffGeo = new THREE.CylinderGeometry(0.03, 0.035, h * 0.85, 5);
    const staffMat = new THREE.MeshLambertMaterial({ color: 0x5a3a20 });
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.position.set(-bw * 0.65, h * 0.42, 0);
    group.add(staff);

    // Crystal orb on top
    const orbGeo = cachedGeo("orb", () => new THREE.SphereGeometry(0.08, 6, 5));
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x4488ff });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(-bw * 0.65, h * 0.85, 0);
    group.add(orb);
  } else if (baseClass === "hunter") {
    // Bow on back
    const bowGeo = new THREE.TorusGeometry(h * 0.18, 0.02, 4, 12, Math.PI);
    const bowMat = new THREE.MeshLambertMaterial({ color: 0x5a3a10 });
    const bow = new THREE.Mesh(bowGeo, bowMat);
    bow.position.set(0, shoulderY + h * 0.05, -bw * 0.40);
    bow.rotation.y = Math.PI / 2;
    group.add(bow);
  } else if (baseClass === "healer") {
    // Glowing cross on chest
    const crossV = new THREE.BoxGeometry(0.04, bw * 0.40, 0.02);
    const crossH = new THREE.BoxGeometry(bw * 0.30, 0.04, 0.02);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x88ff88 });
    const cv = new THREE.Mesh(crossV, crossMat);
    const ch = new THREE.Mesh(crossH, crossMat);
    cv.position.set(0, legH + torsoH * 0.45, bw * 0.34);
    ch.position.set(0, legH + torsoH * 0.50, bw * 0.34);
    group.add(cv, ch);
  } else if (baseClass === "merchant") {
    // Coin pouch at belt
    const pouchGeo = new THREE.SphereGeometry(bw * 0.14, 5, 4);
    const pouchMat = new THREE.MeshLambertMaterial({ color: 0x8a6a30 });
    const pouch = new THREE.Mesh(pouchGeo, pouchMat);
    pouch.scale.y = 0.7;
    pouch.position.set(bw * 0.40, legH + torsoH * 0.05, bw * 0.20);
    group.add(pouch);
  } else if (baseClass === "craftsman") {
    // Hammer
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, h * 0.32, 4);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(bw * 0.60, weaponY, 0);
    group.add(handle);

    const hammerGeo = new THREE.BoxGeometry(0.12, 0.10, 0.10);
    const hammerMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const hammerHead = new THREE.Mesh(hammerGeo, hammerMat);
    hammerHead.position.set(bw * 0.60, weaponY + h * 0.16, 0);
    group.add(hammerHead);
  }

  // ── GROUND SHADOW ──
  const shadowGeo = cachedGeo("shadow", () => new THREE.CircleGeometry(0.4, 10));
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.scale.set(bw * 1.8, bw * 1.8, 1);
  group.add(shadow);

  // ── SELECTION RING ──
  const ringR = bw * 0.80;
  const ringGeo = cachedGeo("ring", () => new THREE.RingGeometry(0.26, 0.32, 28));
  const ringMat = new THREE.MeshBasicMaterial({
    color: isAI ? 0x22ccdd : accentColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.022;
  ring.scale.set(ringR / 0.32, ringR / 0.32, 1);
  ring.name = "selectionRing";
  group.add(ring);

  // ── HP BAR ──
  const barW = bw * 1.5;
  const barH = 0.08;
  const hpY = headY + headR + 0.30;

  const bgGeo = new THREE.PlaneGeometry(barW, barH);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
  const hpBg = new THREE.Mesh(bgGeo, bgMat);
  hpBg.position.y = hpY;
  hpBg.name = "hpBarBg";
  group.add(hpBg);

  const fillGeo = new THREE.PlaneGeometry(barW, barH);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const hpFill = new THREE.Mesh(fillGeo, fillMat);
  hpFill.position.y = hpY;
  hpFill.position.z = 0.001;
  hpFill.name = "hpBarFill";
  group.add(hpFill);

  return group;
}

// ─── BUILD MONSTER MESH ──────────────────────────────────────────────────────

export function buildMonsterMesh(species) {
  const vis = MONSTER_VIS[species] || MONSTER_VIS.goblin;
  const group = new THREE.Group();

  const h = vis.h;
  const bw = vis.bw;
  const color = vis.color;
  const darkColor = new THREE.Color(color).multiplyScalar(0.7).getHex();

  // Generic body shape — then species-specific overrides
  if (species === "dragon") {
    return buildDragonMesh(vis);
  } else if (species === "wraith") {
    return buildWraithMesh(vis);
  } else if (species === "skeleton") {
    return buildSkeletonMesh(vis);
  } else if (species === "kraken") {
    return buildKrakenMesh(vis);
  }

  // Default humanoid monster (goblin, orc, troll, vampire, werewolf, basilisk)

  // ── Legs ──
  const legH = h * 0.35;
  [-1, 1].forEach(side => {
    const legGeo = new THREE.BoxGeometry(bw * 0.28, legH, bw * 0.28);
    const legMat = new THREE.MeshLambertMaterial({ color });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(side * bw * 0.22, legH * 0.5, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  // ── Body ──
  const bodyH = h * 0.38;
  const bodyGeo = new THREE.BoxGeometry(bw, bodyH, bw * 0.65);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = legH + bodyH * 0.5;
  body.castShadow = true;
  group.add(body);

  // ── Arms ──
  const armH = h * 0.32;
  [-1, 1].forEach(side => {
    const armGeo = new THREE.BoxGeometry(bw * 0.22, armH, bw * 0.22);
    const armMat = new THREE.MeshLambertMaterial({ color });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(side * (bw * 0.60), legH + bodyH * 0.55, 0);
    arm.castShadow = true;
    group.add(arm);
  });

  // ── Head (species-shaped) ──
  const headY = legH + bodyH;
  if (species === "goblin") {
    // Pointed oblong head
    const headGeo = new THREE.SphereGeometry(bw * 0.35, 6, 5);
    const headMat = new THREE.MeshLambertMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.scale.set(1, 1.15, 0.9);
    head.position.y = headY + bw * 0.35;
    group.add(head);

    // Big pointy ears
    [-1, 1].forEach(side => {
      const earGeo = new THREE.ConeGeometry(0.06, 0.25, 4);
      const earMat = new THREE.MeshLambertMaterial({ color });
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(side * bw * 0.42, headY + bw * 0.42, 0);
      ear.rotation.z = side * 1.0;
      group.add(ear);
    });

    addMonsterEyes(group, bw * 0.35, headY + bw * 0.38);
  } else if (species === "troll") {
    // Big round head
    const headGeo = new THREE.SphereGeometry(bw * 0.40, 6, 5);
    const headMat = new THREE.MeshLambertMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = headY + bw * 0.40;
    group.add(head);

    // Horn stubs
    [-1, 1].forEach(side => {
      const hornGeo = new THREE.ConeGeometry(0.05, 0.20, 4);
      const hornMat = new THREE.MeshLambertMaterial({ color: 0x888870 });
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(side * bw * 0.28, headY + bw * 0.70, -0.05);
      horn.rotation.z = side * 0.3;
      group.add(horn);
    });

    addMonsterEyes(group, bw * 0.40, headY + bw * 0.44);
  } else if (species === "werewolf") {
    // Elongated snout head
    const headGeo = new THREE.SphereGeometry(bw * 0.32, 6, 5);
    const headMat = new THREE.MeshLambertMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.scale.set(0.9, 1.0, 1.3);
    head.position.y = headY + bw * 0.32;
    group.add(head);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(bw * 0.20, bw * 0.15, bw * 0.30);
    const snoutMat = new THREE.MeshLambertMaterial({ color: darkColor });
    const snout = new THREE.Mesh(snoutGeo, snoutMat);
    snout.position.set(0, headY + bw * 0.22, bw * 0.38);
    group.add(snout);

    // Ears
    [-1, 1].forEach(side => {
      const earGeo = new THREE.ConeGeometry(0.05, 0.18, 3);
      const earMat = new THREE.MeshLambertMaterial({ color });
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(side * bw * 0.28, headY + bw * 0.56, 0);
      group.add(ear);
    });

    addMonsterEyes(group, bw * 0.32, headY + bw * 0.36);
  } else if (species === "vampire") {
    // Aristocratic head
    const headGeo = new THREE.SphereGeometry(bw * 0.30, 7, 5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xc0a0b0 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = headY + bw * 0.30;
    group.add(head);

    // Cape
    const capeGeo = new THREE.BoxGeometry(bw * 1.3, bodyH + legH * 0.3, 0.06);
    const capeMat = new THREE.MeshLambertMaterial({ color: 0x220044 });
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, legH + bodyH * 0.35, -bw * 0.36);
    group.add(cape);

    addMonsterEyes(group, bw * 0.30, headY + bw * 0.34, 0xff0000);
  } else if (species === "basilisk") {
    // Low reptilian head
    const headGeo = new THREE.SphereGeometry(bw * 0.38, 6, 4);
    const headMat = new THREE.MeshLambertMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.scale.set(1.2, 0.7, 1.4);
    head.position.set(0, headY + bw * 0.18, bw * 0.15);
    group.add(head);

    addMonsterEyes(group, bw * 0.38, headY + bw * 0.22, 0xffff00);
  } else {
    // Orc / generic fallback
    const headGeo = new THREE.SphereGeometry(bw * 0.34, 6, 5);
    const headMat = new THREE.MeshLambertMaterial({ color });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = headY + bw * 0.34;
    group.add(head);

    addMonsterEyes(group, bw * 0.34, headY + bw * 0.38);
  }

  addMonsterExtras(group, h, bw);
  return group;
}

// ─── SPECIAL MONSTER TYPES ───────────────────────────────────────────────────

function buildDragonMesh(vis) {
  const group = new THREE.Group();
  const { h, bw, color } = vis;

  // Thick body
  const bodyGeo = new THREE.SphereGeometry(bw * 0.55, 7, 5);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.7, 1.3);
  body.position.y = h * 0.35;
  body.castShadow = true;
  group.add(body);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(bw * 0.15, bw * 0.22, h * 0.35, 6);
  const neckMat = new THREE.MeshLambertMaterial({ color });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.set(0, h * 0.60, bw * 0.30);
  neck.rotation.x = 0.4;
  group.add(neck);

  // Head
  const headGeo = new THREE.SphereGeometry(bw * 0.30, 6, 5);
  const headMat = new THREE.MeshLambertMaterial({ color });
  const head = new THREE.Mesh(headGeo, headMat);
  head.scale.set(1, 0.8, 1.4);
  head.position.set(0, h * 0.78, bw * 0.50);
  group.add(head);

  // Horns
  [-1, 1].forEach(side => {
    const hornGeo = new THREE.ConeGeometry(0.06, 0.30, 4);
    const hornMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(side * bw * 0.22, h * 0.92, bw * 0.40);
    horn.rotation.z = side * 0.4;
    group.add(horn);
  });

  // Eyes
  addMonsterEyes(group, bw * 0.30, h * 0.82, 0xff6600);

  // Wings
  [-1, 1].forEach(side => {
    const wingGeo = new THREE.BoxGeometry(bw * 0.80, 0.06, bw * 0.50);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x991100 });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(side * bw * 0.72, h * 0.50, -bw * 0.10);
    wing.rotation.z = side * 0.35;
    wing.rotation.x = -0.15;
    group.add(wing);

    // Wing membrane
    const memGeo = new THREE.BoxGeometry(bw * 0.55, 0.03, bw * 0.40);
    const memMat = new THREE.MeshLambertMaterial({ color: 0x771100, transparent: true, opacity: 0.7 });
    const mem = new THREE.Mesh(memGeo, memMat);
    mem.position.set(side * bw * 1.10, h * 0.42, -bw * 0.05);
    mem.rotation.z = side * 0.5;
    group.add(mem);
  });

  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.03, bw * 0.12, h * 0.55, 5);
  const tailMat = new THREE.MeshLambertMaterial({ color });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.set(0, h * 0.18, -bw * 0.60);
  tail.rotation.x = 0.6;
  group.add(tail);

  // Legs (4)
  [-1, 1].forEach(side => {
    [-1, 1].forEach(fb => {
      const legGeo = new THREE.BoxGeometry(bw * 0.18, h * 0.28, bw * 0.18);
      const legMat = new THREE.MeshLambertMaterial({ color });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side * bw * 0.36, h * 0.14, fb * bw * 0.30);
      leg.castShadow = true;
      group.add(leg);
    });
  });

  addMonsterExtras(group, h, bw);
  return group;
}

function buildWraithMesh(vis) {
  const group = new THREE.Group();
  const { h, bw, color } = vis;

  // Ethereal body — tall tapering cone
  const bodyGeo = new THREE.CylinderGeometry(bw * 0.10, bw * 0.40, h * 0.80, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.65 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h * 0.40;
  group.add(body);

  // Head (slightly visible)
  const headGeo = new THREE.SphereGeometry(bw * 0.28, 6, 5);
  const headMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = h * 0.82;
  group.add(head);

  // Glowing eyes
  [-1, 1].forEach(side => {
    const eyeGeo = new THREE.SphereGeometry(0.05, 5, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8888ff });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * bw * 0.14, h * 0.84, bw * 0.22);
    group.add(eye);
  });

  // Wispy tendrils
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const tendrilGeo = new THREE.CylinderGeometry(0.015, 0.04, h * 0.35, 4);
    const tendrilMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.35 });
    const tendril = new THREE.Mesh(tendrilGeo, tendrilMat);
    tendril.position.set(Math.cos(angle) * bw * 0.25, h * 0.10, Math.sin(angle) * bw * 0.25);
    tendril.rotation.z = (Math.random() - 0.5) * 0.4;
    group.add(tendril);
  }

  addMonsterExtras(group, h, bw);
  return group;
}

function buildSkeletonMesh(vis) {
  const group = new THREE.Group();
  const { h, bw, color } = vis;
  const boneColor = 0xdde0e4;

  // Legs — thin bone rods
  const legH = h * 0.38;
  [-1, 1].forEach(side => {
    const legGeo = new THREE.CylinderGeometry(0.03, 0.04, legH, 4);
    const legMat = new THREE.MeshLambertMaterial({ color: boneColor });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(side * bw * 0.18, legH * 0.5, 0);
    group.add(leg);
  });

  // Pelvis
  const pelvisGeo = new THREE.BoxGeometry(bw * 0.60, 0.08, bw * 0.30);
  const pelvisMat = new THREE.MeshLambertMaterial({ color: boneColor });
  const pelvis = new THREE.Mesh(pelvisGeo, pelvisMat);
  pelvis.position.y = legH;
  group.add(pelvis);

  // Spine
  const spineH = h * 0.30;
  const spineGeo = new THREE.CylinderGeometry(0.04, 0.035, spineH, 4);
  const spineMat = new THREE.MeshLambertMaterial({ color: boneColor });
  const spine = new THREE.Mesh(spineGeo, spineMat);
  spine.position.y = legH + spineH * 0.5;
  group.add(spine);

  // Ribcage
  for (let i = 0; i < 4; i++) {
    const ribGeo = new THREE.TorusGeometry(bw * 0.28 - i * 0.02, 0.02, 4, 8, Math.PI);
    const ribMat = new THREE.MeshLambertMaterial({ color: boneColor });
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(0, legH + spineH * 0.25 + i * 0.07, bw * 0.08);
    rib.rotation.x = Math.PI / 2;
    group.add(rib);
  }

  // Arms — thin bones
  [-1, 1].forEach(side => {
    const armGeo = new THREE.CylinderGeometry(0.025, 0.03, h * 0.28, 4);
    const armMat = new THREE.MeshLambertMaterial({ color: boneColor });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(side * bw * 0.42, legH + spineH * 0.60, 0);
    arm.rotation.z = side * 0.15;
    group.add(arm);
  });

  // Skull
  const skullGeo = new THREE.SphereGeometry(bw * 0.32, 6, 5);
  const skullMat = new THREE.MeshLambertMaterial({ color: boneColor });
  const skull = new THREE.Mesh(skullGeo, skullMat);
  skull.position.y = legH + spineH + bw * 0.32;
  group.add(skull);

  // Jaw
  const jawGeo = new THREE.BoxGeometry(bw * 0.38, bw * 0.12, bw * 0.20);
  const jawMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const jaw = new THREE.Mesh(jawGeo, jawMat);
  jaw.position.set(0, legH + spineH + bw * 0.08, bw * 0.12);
  group.add(jaw);

  // Eye sockets (dark)
  [-1, 1].forEach(side => {
    const eyeGeo = new THREE.SphereGeometry(bw * 0.10, 5, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * bw * 0.16, legH + spineH + bw * 0.36, bw * 0.26);
    group.add(eye);
  });

  addMonsterExtras(group, h, bw);
  return group;
}

function buildKrakenMesh(vis) {
  const group = new THREE.Group();
  const { h, bw, color } = vis;

  // Main body — large oval
  const bodyGeo = new THREE.SphereGeometry(bw * 0.50, 7, 5);
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.8, 1.2);
  body.position.y = h * 0.40;
  body.castShadow = true;
  group.add(body);

  // Eyes
  [-1, 1].forEach(side => {
    const eyeGeo = new THREE.SphereGeometry(bw * 0.12, 5, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * bw * 0.28, h * 0.48, bw * 0.40);
    group.add(eye);
  });

  // Tentacles (8)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tentGeo = new THREE.CylinderGeometry(0.02, bw * 0.08, h * 0.55, 5);
    const tentMat = new THREE.MeshLambertMaterial({ color });
    const tent = new THREE.Mesh(tentGeo, tentMat);
    tent.position.set(
      Math.cos(angle) * bw * 0.35,
      h * 0.08,
      Math.sin(angle) * bw * 0.35
    );
    tent.rotation.z = Math.cos(angle) * 0.4;
    tent.rotation.x = Math.sin(angle) * 0.4;
    group.add(tent);
  }

  addMonsterExtras(group, h, bw);
  return group;
}

// ─── SHARED MONSTER HELPERS ──────────────────────────────────────────────────

function addMonsterEyes(group, headR, eyeY, eyeColor = 0xff2200) {
  [-1, 1].forEach(side => {
    const eyeGeo = new THREE.SphereGeometry(headR * 0.14, 5, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * headR * 0.50, eyeY, headR * 0.80);
    group.add(eye);
  });
}

function addMonsterExtras(group, h, bw) {
  // Ground shadow
  const shadowGeo = new THREE.CircleGeometry(bw * 0.65, 10);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // Selection ring
  const ringR = bw * 0.80;
  const ringGeo = new THREE.RingGeometry(ringR - 0.08, ringR, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.022;
  ring.name = "selectionRing";
  group.add(ring);

  // HP bar
  const barW = bw * 1.5;
  const barH = 0.08;
  const hpY = h + 0.40;

  const bgGeo = new THREE.PlaneGeometry(barW, barH);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x1f2937, side: THREE.DoubleSide });
  const hpBg = new THREE.Mesh(bgGeo, bgMat);
  hpBg.position.y = hpY;
  hpBg.name = "hpBarBg";
  group.add(hpBg);

  const fillGeo = new THREE.PlaneGeometry(barW, barH);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const hpFill = new THREE.Mesh(fillGeo, fillMat);
  hpFill.position.y = hpY;
  hpFill.position.z = 0.001;
  hpFill.name = "hpBarFill";
  group.add(hpFill);
}
