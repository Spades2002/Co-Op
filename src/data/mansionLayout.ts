import type { RoomDef } from '../types/game.ts';

/**
 * Spatial blueprint of Blackwood Manor (10 interconnected rooms).
 * Coordinates in meters. Y = 0 is floor plane.
 * North = -Z, South = +Z, West = -X, East = +X.
 */
export const MANSION_ROOMS: RoomDef[] = [
  {
    id: 'foyer',
    name: 'Grand Foyer',
    subtitle: 'Checkered marble threshold beneath a swaying chandelier',
    bounds: { minX: -7, maxX: 7, minZ: 6, maxZ: 16 },
    floorStyle: 'marble',
    floorColor: '#2c313f',
    wallColor: '#3a2b32',
    rugColor: '#69212f',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_foyer_hallway', toRoomId: 'hallway', position: [0, 0, 6], axis: 'x', width: 3.6 },
      { id: 'd_foyer_parlor', toRoomId: 'parlor', position: [-7, 0, 11], axis: 'z', width: 3.0 },
      { id: 'd_foyer_dining', toRoomId: 'dining', position: [7, 0, 11], axis: 'z', width: 3.0 },
    ],
    furniture: [
      { id: 'f_foyer_table', kind: 'table', position: [0, 0, 11], size: [2.2, 0.85, 1.4], color: '#4d3222' },
      { id: 'f_foyer_chand', kind: 'chandelier', position: [0, 4.3, 11], size: [1.8, 0.9, 1.8], color: '#c89844' },
      { id: 'f_foyer_armor_l', kind: 'armor', position: [-5.6, 0, 7.2], size: [0.9, 2.1, 0.9], color: '#7e8896' },
      { id: 'f_foyer_armor_r', kind: 'armor', position: [5.6, 0, 7.2], size: [0.9, 2.1, 0.9], color: '#7e8896' },
    ],
  },
  {
    id: 'parlor',
    name: 'Velvet Parlor',
    subtitle: 'Cold hearth embers and an untuned grand piano',
    bounds: { minX: -19, maxX: -7, minZ: 6, maxZ: 16 },
    floorStyle: 'wood',
    floorColor: '#3d2a1f',
    wallColor: '#432530',
    rugColor: '#5c2238',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_parlor_foyer', toRoomId: 'foyer', position: [-7, 0, 11], axis: 'z', width: 3.0 },
      { id: 'd_parlor_library', toRoomId: 'library', position: [-14, 0, 6], axis: 'x', width: 3.0 },
    ],
    furniture: [
      { id: 'f_parlor_piano', kind: 'piano', position: [-16.2, 0, 13.4], size: [2.6, 1.2, 2.0], color: '#1b1c22' },
      { id: 'f_parlor_sofa', kind: 'sofa', position: [-11.5, 0, 13.8], size: [2.8, 0.95, 1.1], color: '#6b2737' },
      { id: 'f_parlor_tea', kind: 'table', position: [-11.5, 0, 11.4], size: [1.5, 0.55, 1.0], color: '#513422' },
    ],
  },
  {
    id: 'dining',
    name: 'Banquet Hall',
    subtitle: 'Set for twelve guests who never finished supper',
    bounds: { minX: 7, maxX: 19, minZ: 6, maxZ: 16 },
    floorStyle: 'wood',
    floorColor: '#3a271c',
    wallColor: '#2d3b36',
    rugColor: '#284a42',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_dining_foyer', toRoomId: 'foyer', position: [7, 0, 11], axis: 'z', width: 3.0 },
      { id: 'd_dining_kitchen', toRoomId: 'kitchen', position: [14, 0, 6], axis: 'x', width: 3.0 },
    ],
    furniture: [
      { id: 'f_dining_long', kind: 'table', position: [13, 0, 11.5], size: [4.8, 0.85, 1.8], color: '#452b1d' },
      { id: 'f_dining_cab', kind: 'cabinet', position: [17.7, 0, 14.2], size: [1.1, 2.2, 2.4], color: '#3b2418' },
    ],
  },
  {
    id: 'hallway',
    name: 'Portrait Corridor',
    subtitle: 'Oil-painted ancestors whose eyes track lantern light',
    bounds: { minX: -11, maxX: 11, minZ: -2, maxZ: 6 },
    floorStyle: 'wood',
    floorColor: '#38251a',
    wallColor: '#2b2d3f',
    rugColor: '#66242f',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_hallway_foyer', toRoomId: 'foyer', position: [0, 0, 6], axis: 'x', width: 3.6 },
      { id: 'd_hallway_library', toRoomId: 'library', position: [-11, 0, 2], axis: 'z', width: 3.0 },
      { id: 'd_hallway_kitchen', toRoomId: 'kitchen', position: [11, 0, 2], axis: 'z', width: 3.0 },
      {
        id: 'd_hallway_conservatory',
        toRoomId: 'conservatory',
        position: [0, 0, -2],
        axis: 'x',
        width: 3.4,
        lockedByTier: undefined,
      },
    ],
    furniture: [
      { id: 'f_hall_clock', kind: 'clock', position: [-4.5, 0, -1.2], size: [1.0, 2.6, 0.7], color: '#472c1c' },
      { id: 'f_hall_pedestal', kind: 'pedestal', position: [4.8, 0, -1.0], size: [0.9, 1.2, 0.9], color: '#6b707d' },
    ],
  },
  {
    id: 'library',
    name: 'Arcane Library',
    subtitle: 'Floor-to-ceiling folios and hidden cipher drawers',
    bounds: { minX: -21, maxX: -11, minZ: -10, maxZ: 6 },
    floorStyle: 'wood',
    floorColor: '#342218',
    wallColor: '#283345',
    rugColor: '#243a54',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_library_parlor', toRoomId: 'parlor', position: [-14, 0, 6], axis: 'x', width: 3.0 },
      { id: 'd_library_hallway', toRoomId: 'hallway', position: [-11, 0, 2], axis: 'z', width: 3.0 },
      { id: 'd_library_study', toRoomId: 'study', position: [-16, 0, -10], axis: 'x', width: 3.0 },
    ],
    furniture: [
      { id: 'f_lib_shelf_w1', kind: 'bookshelf', position: [-20.1, 0, -4], size: [0.9, 2.8, 3.6], color: '#3b2517' },
      { id: 'f_lib_shelf_w2', kind: 'bookshelf', position: [-20.1, 0, 1.5], size: [0.9, 2.8, 3.6], color: '#3b2517' },
      { id: 'f_lib_desk', kind: 'desk', position: [-15.8, 0, -2.5], size: [2.4, 0.85, 1.3], color: '#4d2f1e' },
    ],
  },
  {
    id: 'kitchen',
    name: 'Old Kitchen',
    subtitle: 'Copper kettles, frost-rimmed pantry, and cellar steps',
    bounds: { minX: 11, maxX: 21, minZ: -10, maxZ: 6 },
    floorStyle: 'stone',
    floorColor: '#2f343b',
    wallColor: '#3a3b36',
    unlockedAtLevel: 1,
    doors: [
      { id: 'd_kitchen_dining', toRoomId: 'dining', position: [14, 0, 6], axis: 'x', width: 3.0 },
      { id: 'd_kitchen_hallway', toRoomId: 'hallway', position: [11, 0, 2], axis: 'z', width: 3.0 },
      { id: 'd_kitchen_cellar', toRoomId: 'cellar', position: [16, 0, -10], axis: 'x', width: 3.0 },
    ],
    furniture: [
      { id: 'f_kit_stove', kind: 'stove', position: [19.6, 0, 1.5], size: [1.4, 1.4, 2.6], color: '#22252b' },
      { id: 'f_kit_block', kind: 'table', position: [15.5, 0, -2.0], size: [2.2, 0.9, 1.4], color: '#6b4d35' },
      { id: 'f_kit_cab', kind: 'cabinet', position: [19.8, 0, -5.5], size: [1.1, 2.3, 2.8], color: '#463325' },
    ],
  },
  {
    id: 'conservatory',
    name: 'Moonlit Conservatory',
    subtitle: 'Glass atrium choked with silver-lit nightshade',
    bounds: { minX: -11, maxX: 11, minZ: -16, maxZ: -2 },
    floorStyle: 'glass',
    floorColor: '#203234',
    wallColor: '#1f3636',
    unlockedAtLevel: 4,
    doors: [
      { id: 'd_cons_hallway', toRoomId: 'hallway', position: [0, 0, -2], axis: 'x', width: 3.4 },
      { id: 'd_cons_study', toRoomId: 'study', position: [-11, 0, -13], axis: 'z', width: 2.8 },
      { id: 'd_cons_cellar', toRoomId: 'cellar', position: [11, 0, -13], axis: 'z', width: 2.8 },
      { id: 'd_cons_attic', toRoomId: 'attic', position: [0, 0, -16], axis: 'x', width: 3.4 },
    ],
    furniture: [
      { id: 'f_cons_fountain', kind: 'fountain', position: [0, 0, -9], size: [2.8, 1.3, 2.8], color: '#586775' },
      { id: 'f_cons_ped1', kind: 'pedestal', position: [-6.5, 0, -6.5], size: [0.9, 1.1, 0.9], color: '#53626d' },
      { id: 'f_cons_ped2', kind: 'pedestal', position: [6.5, 0, -6.5], size: [0.9, 1.1, 0.9], color: '#53626d' },
    ],
  },
  {
    id: 'study',
    name: "Alchemist's Study",
    subtitle: 'Distillation vials, brass sextants, and coded journals',
    bounds: { minX: -21, maxX: -11, minZ: -22, maxZ: -10 },
    floorStyle: 'wood',
    floorColor: '#2d1f26',
    wallColor: '#36263d',
    rugColor: '#482852',
    unlockedAtLevel: 11,
    doors: [
      { id: 'd_study_library', toRoomId: 'library', position: [-16, 0, -10], axis: 'x', width: 3.0 },
      { id: 'd_study_cons', toRoomId: 'conservatory', position: [-11, 0, -13], axis: 'z', width: 2.8 },
    ],
    furniture: [
      { id: 'f_study_desk', kind: 'desk', position: [-16.2, 0, -16.5], size: [2.6, 0.9, 1.4], color: '#3b241c' },
      { id: 'f_study_shelf', kind: 'bookshelf', position: [-20.1, 0, -16], size: [0.9, 2.7, 3.4], color: '#342019' },
      { id: 'f_study_scope', kind: 'telescope', position: [-13.2, 0, -19.8], size: [1.0, 1.8, 1.0], color: '#b48a42' },
    ],
  },
  {
    id: 'cellar',
    name: 'Cellar & Crypt',
    subtitle: 'Damp flagstones, vintage casks, and iron-barred alcoves',
    bounds: { minX: 11, maxX: 21, minZ: -22, maxZ: -10 },
    floorStyle: 'stone',
    floorColor: '#24272f',
    wallColor: '#2b2e37',
    unlockedAtLevel: 11,
    doors: [
      { id: 'd_cellar_kitchen', toRoomId: 'kitchen', position: [16, 0, -10], axis: 'x', width: 3.0 },
      { id: 'd_cellar_cons', toRoomId: 'conservatory', position: [11, 0, -13], axis: 'z', width: 2.8 },
    ],
    furniture: [
      { id: 'f_cellar_b1', kind: 'barrel', position: [19.3, 0, -18.5], size: [1.2, 1.3, 1.2], color: '#4d311f' },
      { id: 'f_cellar_b2', kind: 'barrel', position: [19.3, 0, -16.0], size: [1.2, 1.3, 1.2], color: '#4d311f' },
      { id: 'f_cellar_table', kind: 'table', position: [15.2, 0, -16.5], size: [2.0, 0.85, 1.2], color: '#3a2b24' },
    ],
  },
  {
    id: 'attic',
    name: 'Master Observatory',
    subtitle: 'Star-charted dome above the Blackwood estate',
    bounds: { minX: -11, maxX: 11, minZ: -28, maxZ: -16 },
    floorStyle: 'wood',
    floorColor: '#2a222b',
    wallColor: '#21273d',
    rugColor: '#2d3a5c',
    unlockedAtLevel: 21,
    doors: [
      { id: 'd_attic_cons', toRoomId: 'conservatory', position: [0, 0, -16], axis: 'x', width: 3.4 },
    ],
    furniture: [
      { id: 'f_attic_scope', kind: 'telescope', position: [0, 0, -24.2], size: [1.4, 2.2, 1.4], color: '#c49645' },
      { id: 'f_attic_desk', kind: 'desk', position: [-6.8, 0, -22.5], size: [2.4, 0.85, 1.3], color: '#3b261d' },
      { id: 'f_attic_bed', kind: 'bed', position: [6.8, 0, -22.5], size: [2.4, 1.0, 3.0], color: '#4f2230' },
    ],
  },
];

export const ROOM_MAP: Record<string, RoomDef> = Object.fromEntries(
  MANSION_ROOMS.map((r) => [r.id, r]),
);

export function getActiveRoomsForLevel(level: number): RoomDef[] {
  return MANSION_ROOMS.filter((r) => level >= r.unlockedAtLevel);
}

export function findRoomAtPosition(
  x: number,
  z: number,
  activeRoomIds: string[],
): RoomDef | null {
  for (const room of MANSION_ROOMS) {
    if (!activeRoomIds.includes(room.id)) continue;
    const { minX, maxX, minZ, maxZ } = room.bounds;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      return room;
    }
  }
  return null;
}

/**
 * Resolves movement collision against active room bounds, doorway passages, and solid furniture.
 */
export function resolvePlayerMovement(
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  activeRoomIds: string[],
  lockedRoomIds: string[] = [],
): [number, number] {
  const playerRadius = 0.42;
  const activeRooms = MANSION_ROOMS.filter(
    (r) => activeRoomIds.includes(r.id) && !lockedRoomIds.includes(r.id),
  );

  const isInsideAnyPassableSpace = (px: number, pz: number): boolean => {
    // Check inside any unlocked room interior (with wall margin)
    for (const room of activeRooms) {
      const { minX, maxX, minZ, maxZ } = room.bounds;
      if (
        px >= minX + playerRadius &&
        px <= maxX - playerRadius &&
        pz >= minZ + playerRadius &&
        pz <= maxZ - playerRadius
      ) {
        return true;
      }
    }
    // Check inside any open doorway bridge between two unlocked rooms
    for (const room of activeRooms) {
      for (const door of room.doors) {
        if (!activeRoomIds.includes(door.toRoomId) || lockedRoomIds.includes(door.toRoomId)) {
          continue;
        }
        const [dx, , dz] = door.position;
        const halfW = Math.max(0.5, door.width / 2 - playerRadius * 0.45);
        const wallDepth = 0.72;
        if (door.axis === 'x') {
          if (Math.abs(px - dx) <= halfW && Math.abs(pz - dz) <= wallDepth) {
            return true;
          }
        } else {
          if (Math.abs(pz - dz) <= halfW && Math.abs(px - dx) <= wallDepth) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const collidesFurniture = (px: number, pz: number): boolean => {
    for (const room of activeRooms) {
      for (const item of room.furniture) {
        if (item.kind === 'chandelier') continue; // overhead
        const [fx, , fz] = item.position;
        const [fw, , fd] = item.size;
        const hw = fw / 2 + playerRadius * 0.8;
        const hd = fd / 2 + playerRadius * 0.8;
        if (Math.abs(px - fx) < hw && Math.abs(pz - fz) < hd) {
          return true;
        }
      }
    }
    return false;
  };

  let finalX = prevX;
  let finalZ = prevZ;

  // Try full move first, then slide along X or Z
  if (isInsideAnyPassableSpace(nextX, nextZ) && !collidesFurniture(nextX, nextZ)) {
    return [nextX, nextZ];
  }
  if (isInsideAnyPassableSpace(nextX, prevZ) && !collidesFurniture(nextX, prevZ)) {
    finalX = nextX;
  }
  if (isInsideAnyPassableSpace(finalX, nextZ) && !collidesFurniture(finalX, nextZ)) {
    finalZ = nextZ;
  }
  return [finalX, finalZ];
}

/**
 * Curated interior floor spots per room so clues & suspects never overlap furniture or walls.
 */
export const ROOM_INTERACTION_SPOTS: Record<string, [number, number, number][]> = {
  foyer: [
    [-4.2, 0, 13.6],
    [4.2, 0, 13.6],
    [-4.5, 0, 9.0],
    [4.5, 0, 9.0],
    [0, 0, 14.3],
  ],
  parlor: [
    [-16.8, 0, 8.2],
    [-9.2, 0, 8.4],
    [-14.2, 0, 10.6],
    [-9.2, 0, 14.0],
  ],
  dining: [
    [9.4, 0, 8.4],
    [16.8, 0, 8.4],
    [9.4, 0, 14.2],
    [15.8, 0, 14.2],
  ],
  hallway: [
    [-8.2, 0, 4.0],
    [8.2, 0, 4.0],
    [-7.5, 0, 0.2],
    [7.5, 0, 0.2],
    [0, 0, 2.2],
  ],
  library: [
    [-18.0, 0, 4.2],
    [-13.0, 0, -7.8],
    [-18.2, 0, -7.6],
    [-13.0, 0, 0.5],
  ],
  kitchen: [
    [13.0, 0, 4.2],
    [18.2, 0, -1.8],
    [13.0, 0, -7.5],
    [17.8, 0, 4.2],
  ],
  conservatory: [
    [-7.8, 0, -4.5],
    [7.8, 0, -4.5],
    [-7.8, 0, -13.5],
    [7.8, 0, -13.5],
    [0, 0, -13.2],
  ],
  study: [
    [-18.5, 0, -12.2],
    [-13.0, 0, -16.0],
    [-18.2, 0, -19.8],
    [-14.0, 0, -12.0],
  ],
  cellar: [
    [13.0, 0, -12.2],
    [18.2, 0, -12.5],
    [13.0, 0, -19.8],
    [16.5, 0, -19.8],
  ],
  attic: [
    [-8.0, 0, -18.2],
    [8.0, 0, -18.2],
    [-4.2, 0, -25.8],
    [4.2, 0, -25.8],
  ],
};
