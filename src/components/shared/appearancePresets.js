export const APPEARANCE_PRESETS = {
  default: {
    facePreset: ["classic", "angular", "scarred"],
    hairPreset: ["short", "long", "braid", "shaved"],
    facialHair: ["none", "stubble", "beard", "goatee"],
    skinTone: ["light", "tan", "olive", "dark"],
    hairColor: ["black", "brown", "blonde", "red", "gray"],
    marking: ["none", "tattoo", "warpaint", "scar"],
  },
  elf: {
    facePreset: ["classic", "refined", "wild"],
    hairPreset: ["long", "braid", "crown"],
    facialHair: ["none", "stubble"],
    skinTone: ["light", "olive"],
    hairColor: ["black", "brown", "blonde", "silver"],
    marking: ["none", "tattoo", "warpaint"],
  },
  dwarf: {
    facePreset: ["broad", "scarred", "stoneborn"],
    hairPreset: ["short", "braid", "crown"],
    facialHair: ["stubble", "beard", "goatee"],
    skinTone: ["light", "tan", "olive"],
    hairColor: ["black", "brown", "red", "gray"],
    marking: ["none", "tattoo", "scar"],
  },
  half_giant: {
    facePreset: ["massive", "scarred", "ancient"],
    hairPreset: ["short", "shaved", "braid"],
    facialHair: ["none", "stubble", "beard"],
    skinTone: ["tan", "olive", "dark"],
    hairColor: ["black", "brown", "gray"],
    marking: ["none", "warpaint", "scar"],
  },
};

export function getAppearancePresetSet(raceId) {
  return APPEARANCE_PRESETS[raceId] || APPEARANCE_PRESETS.default;
}

export function buildDefaultAppearance(raceId) {
  const set = getAppearancePresetSet(raceId);
  return {
    facePreset: set.facePreset[0] || "classic",
    hairPreset: set.hairPreset[0] || "short",
    facialHair: set.facialHair[0] || "none",
    skinTone: set.skinTone[0] || "light",
    hairColor: set.hairColor[0] || "black",
    marking: set.marking[0] || "none",
  };
}

