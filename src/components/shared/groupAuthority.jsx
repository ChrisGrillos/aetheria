/**
 * GROUP AUTHORITY
 *
 * Single source of truth for party/group state, follow mechanics,
 * and formation logic.
 *
 * Formations define the spatial offsets of followers relative to the leader.
 * Offsets are in tile units [dx, dy]. Index 0 = slot 1 (first follower), etc.
 *
 * Actual movement is still routed through movementAuthority — this module
 * only computes WHERE each member should stand given a formation.
 */

// ─── FORMATIONS ──────────────────────────────────────────────────────────────

export const FORMATIONS = {
  column: {
    name: "Column",
    description: "Single file behind leader",
    maxSize: 8,
    offsets: (n) => Array.from({ length: n }, (_, i) => [0, i + 1]),
  },
  line: {
    name: "Line",
    description: "Side by side with leader",
    maxSize: 7,
    offsets: (n) => {
      const half = Math.floor(n / 2);
      return Array.from({ length: n }, (_, i) => [i - half + (n % 2 === 0 ? 0 : 0), 0])
        .filter((_, i) => i !== Math.floor(n / 2) || n % 2 === 0);
    },
  },
  box: {
    name: "Box",
    description: "Surrounding the leader",
    maxSize: 8,
    offsets: () => [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
  },
  triangle: {
    name: "Triangle",
    description: "V-shape pointing forward",
    maxSize: 6,
    offsets: () => [[-1,1],[1,1],[-2,2],[0,2],[2,2]],
  },
  circle: {
    name: "Circle",
    description: "Ring around leader",
    maxSize: 8,
    offsets: (n) => {
      const r = 2;
      return Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n;
        return [Math.round(Math.sin(angle) * r), Math.round(Math.cos(angle) * r)];
      });
    },
  },
  ranks: {
    name: "Ranks",
    description: "Two rows behind leader",
    maxSize: 8,
    offsets: (n) => Array.from({ length: n }, (_, i) => [i % 3 - 1, Math.floor(i / 3) + 1]),
  },
  wedge: {
    name: "Wedge",
    description: "Arrow pointing forward",
    maxSize: 7,
    offsets: () => [[-1,1],[1,1],[-2,2],[0,2],[2,2],[-3,3],[3,3]],
  },
  inverse_wedge: {
    name: "Inverse Wedge",
    description: "Arrow pointing backward",
    maxSize: 7,
    offsets: () => [[-1,-1],[1,-1],[-2,-2],[0,-2],[2,-2],[-3,-3],[3,-3]],
  },
  t_formation: {
    name: "T Formation",
    description: "Leader front, line behind",
    maxSize: 7,
    offsets: () => [[-1,1],[0,1],[1,1],[-2,1],[2,1],[0,2]],
  },
};

export const DEFAULT_FORMATION = "column";

// ─── GROUP STATE HELPERS ─────────────────────────────────────────────────────

/**
 * Compute target positions for all followers given leader position and formation.
 * Returns array of { memberId, targetX, targetY }
 */
export function computeFormationPositions(leaderX, leaderY, memberIds, formationKey = DEFAULT_FORMATION) {
  const formation = FORMATIONS[formationKey] || FORMATIONS.column;
  const offsets = formation.offsets(memberIds.length);
  return memberIds.map((id, i) => {
    const [dx, dy] = offsets[i] || [0, i + 1];
    return { memberId: id, targetX: leaderX + dx, targetY: leaderY + dy };
  });
}

/**
 * Check if a character is "in formation" (within 1 tile of their slot).
 */
export function isInFormation(character, targetX, targetY) {
  const dx = Math.abs(character.x - targetX);
  const dy = Math.abs(character.y - targetY);
  return dx <= 1 && dy <= 1;
}

/**
 * Get the next step for a follower toward their formation position.
 * Returns [dx, dy] or null if already in position.
 */
export function getFollowStep(follower, targetX, targetY) {
  const dx = targetX - follower.x;
  const dy = targetY - follower.y;
  if (dx === 0 && dy === 0) return null;
  // Step toward target (one axis at a time, prioritize larger gap)
  if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx), 0];
  return [0, Math.sign(dy)];
}