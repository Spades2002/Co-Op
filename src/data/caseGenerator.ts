import type {
  CaseData,
  ClueDef,
  CluePropType,
  ClueVisibility,
  DifficultyTier,
  PuzzleDef,
  SuspectDef,
  TutorialStep,
} from '../types/game.ts';
import { getActiveRoomsForLevel, ROOM_INTERACTION_SPOTS, ROOM_MAP } from './mansionLayout.ts';

/** Deterministic PRNG (Mulberry32) */
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface SuspectTemplate {
  id: string;
  name: string;
  title: string;
  ghostTint: string;
  hatStyle: SuspectDef['hatStyle'];
  personality: string;
  traitItem: string;
}

const SUSPECT_POOL: SuspectTemplate[] = [
  {
    id: 'lord_alistair',
    name: 'Lord Alistair Blackwood',
    title: 'Estate Patriarch',
    ghostTint: '#7dd3fc',
    hatStyle: 'tophat',
    personality: 'imperious and guarded about the family crest',
    traitItem: 'monogrammed silver cufflink',
  },
  {
    id: 'lady_evelyn',
    name: 'Lady Evelyn Thorne',
    title: 'Botanist & Heiress',
    ghostTint: '#86efac',
    hatStyle: 'veil',
    personality: 'composed, poetic, and strangely calm',
    traitItem: 'pressed nightshade petal',
  },
  {
    id: 'dr_vance',
    name: 'Dr. Cornelius Vance',
    title: 'Family Physician',
    ghostTint: '#c4b5fd',
    hatStyle: 'spectacles',
    personality: 'clinical, precise, and quick to deflect blame',
    traitItem: 'apothecary brass measure',
  },
  {
    id: 'madame_isolde',
    name: 'Madame Isolde Moreau',
    title: 'Spiritualist Medium',
    ghostTint: '#f9a8d4',
    hatStyle: 'hood',
    personality: 'theatrical, observant, and fond of riddles',
    traitItem: 'tarot wax seal',
  },
  {
    id: 'capt_sterling',
    name: 'Captain Arthur Sterling',
    title: 'Retired Naval Officer',
    ghostTint: '#fcd34d',
    hatStyle: 'none',
    personality: 'blunt, restless, and haunted by old debts',
    traitItem: 'brass compass fob',
  },
  {
    id: 'clara_holloway',
    name: 'Clara Holloway',
    title: 'Head Archivist',
    ghostTint: '#67e8f9',
    hatStyle: 'spectacles',
    personality: 'meticulous, anxious, and fiercely protective of the ledgers',
    traitItem: 'ink-stained ribbon bookmark',
  },
  {
    id: 'prof_ash',
    name: 'Professor Gideon Ash',
    title: 'Horologist & Inventor',
    ghostTint: '#fdba74',
    hatStyle: 'tophat',
    personality: 'eccentric, obsessed with clockwork precision',
    traitItem: 'tiny toothed brass gear',
  },
  {
    id: 'baroness_vane',
    name: 'Baroness Octavia Vane',
    title: 'Opera Patron',
    ghostTint: '#f0abfc',
    hatStyle: 'veil',
    personality: 'sharp-tongued, theatrical, and fiercely ambitious',
    traitItem: 'crimson velvet glove button',
  },
  {
    id: 'father_crowe',
    name: 'Father Sebastian Crowe',
    title: 'Parish Antiquarian',
    ghostTint: '#cbd5e1',
    hatStyle: 'hood',
    personality: 'solemn, soft-spoken, and secretive about the crypt',
    traitItem: 'tarnished silver rosary link',
  },
  {
    id: 'inspector_graves',
    name: 'Inspector Julian Graves',
    title: 'Disgraced Detective',
    ghostTint: '#93c5fd',
    hatStyle: 'none',
    personality: 'cynical, sharp-eyed, and hiding his own investigation',
    traitItem: 'bent copper badge clasp',
  },
];

const VICTIMS = [
  { name: 'Edmund Blackwood', bio: 'Wealthy clockmaker and keeper of the Blackwood trust.' },
  { name: 'Lady Marguerite Ash', bio: 'Patroness of the manor’s midnight séances.' },
  { name: 'Julianna Thorne', bio: 'Cartographer who uncovered a buried manor secret.' },
  { name: 'Sir Percival Holloway', bio: 'Solicitor summoned to rewrite the Blackwood will.' },
  { name: 'Beatrice Finch', bio: 'Opera soprano visiting for a private winter recital.' },
  { name: 'Archibald Vane', bio: 'Collector of rare poisons and antique horology.' },
];

export const WEAPONS: { name: string; propType: CluePropType; trace: string }[] = [
  { name: 'Silver Letter Opener', propType: 'dagger', trace: 'a clean triangular puncture and silver polish residue' },
  { name: 'Arsenic Decanter', propType: 'vial', trace: 'bitter almond sediment coating a crystal rim' },
  { name: 'Brass Candlestick', propType: 'candle', trace: 'dented beeswax and heavy brass impact marks' },
  { name: 'Clockwork Pendulum', propType: 'key', trace: 'notched gear oil and a snapped spring coil' },
  { name: 'Silk Bell-Cord', propType: 'locket', trace: 'frayed crimson silk fibers caught near the collar' },
  { name: 'Obsidian Ritual Dagger', propType: 'dagger', trace: 'a chipped volcanic glass splinter in the floorboards' },
  { name: 'Aconite Phial', propType: 'vial', trace: 'violet wolfsbane droplets dried beside a teacup' },
  { name: 'Iron Fireplace Poker', propType: 'blueprint', trace: 'charcoal soot smeared along an angled strike mark' },
];

export const MOTIVES: { name: string; docHook: string; summary: string }[] = [
  {
    name: 'Concealed Forgery',
    docHook: 'altered signature plates hidden behind a false spine',
    summary: 'The victim discovered forged estate deeds ready to ruin the culprit.',
  },
  {
    name: 'Disinherited Fortune',
    docHook: 'an unsigned codicil striking the culprit from the inheritance',
    summary: 'A new will cut the culprit out of the entire Blackwood estate.',
  },
  {
    name: 'Blackmail Ledger',
    docHook: 'numbered receipts demanding hush money every solstice',
    summary: 'The victim kept a ledger threatening to expose the culprit’s past crime.',
  },
  {
    name: 'Stolen Patent',
    docHook: 'original mechanical drafts bearing scratched-out initials',
    summary: 'The victim planned to reclaim a lucrative invention claimed by the culprit.',
  },
  {
    name: 'Embezzled Trust',
    docHook: 'hollowed bank drafts from the manor charity fund',
    summary: 'An audit was scheduled for dawn that would reveal missing funds.',
  },
  {
    name: 'Betrayed Pact',
    docHook: 'a burnt vow signed in ash before the last séance',
    summary: 'The victim broke an old oath and threatened to confess everything.',
  },
];

const CASE_TITLES = [
  'The Midnight Chime',
  'Ashes in the Parlor',
  'The Poisoned Toast',
  'Shadows of the Archive',
  'The Stopped Pendulum',
  'Nightshade at Eleven',
  'The Velvet Alibi',
  'Whispers Behind the Wainscot',
  'The Broken Seal',
  'Ghosts of the East Wing',
  'Cipher in the Inkwell',
  'The Brass Measure',
  'Crimson on the Marble',
  'The Conservatory Pact',
  'Echoes of the Crypt',
  'The Clockmaker’s Debt',
  'Aconite & Candlelight',
  'The Unfinished Sonata',
  'The Hollow Ledger',
  'Lanterns in the Fog',
  'The Observatory Oath',
  'Seven Guests, One Grave',
  'The Silver Monogram',
  'Shattered Glass & Wolfsbane',
  'The Thirteenth Stroke',
  'Secrets of the Cellar Gate',
  'The Stolen Patent',
  'Bell-Cord at Midnight',
  'The Final Séance',
  'Reckoning at Blackwood Manor',
];

const TIMES_OF_DEATH = ['10:45 PM', '11:00 PM', '11:15 PM', '11:30 PM', '11:45 PM', '12:05 AM'];

export function getDifficultyForLevel(level: number): {
  tier: DifficultyTier;
  suspectCount: number;
  redHerringCount: number;
  maxHints: number;
  estimatedMinutes: number;
  chainDepth: number;
  puzzleCount: number;
} {
  if (level <= 10) {
    return {
      tier: 'easy',
      suspectCount: level <= 4 ? 3 : 4,
      redHerringCount: level <= 5 ? 1 : 2,
      maxHints: 4,
      estimatedMinutes: 18 + Math.round(level * 0.5),
      chainDepth: level <= 5 ? 1 : 2,
      puzzleCount: level >= 5 ? 1 : 0,
    };
  }
  if (level <= 20) {
    return {
      tier: 'medium',
      suspectCount: level <= 15 ? 5 : 6,
      redHerringCount: level <= 15 ? 3 : 4,
      maxHints: level <= 15 ? 3 : 2,
      estimatedMinutes: 28 + Math.round((level - 10) * 0.8),
      chainDepth: 2,
      puzzleCount: level >= 15 ? 2 : 1,
    };
  }
  return {
    tier: 'hard',
    suspectCount: level <= 25 ? 7 : 8,
    redHerringCount: level <= 25 ? 5 : 6,
    maxHints: 1,
    estimatedMinutes: 38 + Math.round((level - 20) * 0.7),
    chainDepth: 3,
    puzzleCount: 2,
  };
}

export const LEVEL_1_TUTORIAL: TutorialStep[] = [
  {
    id: 'move',
    label: 'Explore the Foyer & Hallway',
    detail: 'Use WASD / Arrows (or the touch joystick) to walk. Drag to orbit the camera.',
  },
  {
    id: 'clue',
    label: 'Inspect a Glowing Clue',
    detail: 'Step near a shimmering clue prop and press E or tap Examine. Some clues are visible only to Staines or Anika!',
  },
  {
    id: 'ghost',
    label: 'Question a Ghostly Suspect',
    detail: 'Approach any ghost to hear their alibi and test their story against discovered clues.',
  },
  {
    id: 'notebook',
    label: 'Share Findings in the Notebook',
    detail: 'Open the Shared Notebook (N) to review what your partner found and pin key evidence.',
  },
  {
    id: 'accuse',
    label: 'Make the Final Accusation',
    detail: 'Once you agree on Culprit, Weapon, and Motive, submit your accusation together.',
  },
];

export function generateCaseForLevel(levelInput: number): CaseData {
  const level = Math.max(1, Math.min(30, Math.floor(levelInput)));
  const seed = (level * 2654435761) >>> 0;
  const rng = createRng(seed);

  const config = getDifficultyForLevel(level);
  const activeRooms = getActiveRoomsForLevel(level);
  const activeRoomIds = activeRooms.map((r) => r.id);

  // Track used floor spots per room so nothing overlaps
  const spotCursor: Record<string, number> = {};
  const nextSpot = (roomId: string): [number, number, number] => {
    const spots = ROOM_INTERACTION_SPOTS[roomId] || [[0, 0, 10]];
    const idx = spotCursor[roomId] || 0;
    spotCursor[roomId] = idx + 1;
    const base = spots[idx % spots.length];
    const jitter = idx >= spots.length ? ((idx % 3) - 1) * 0.75 : 0;
    return [base[0] + jitter, base[1], base[2] + (idx >= spots.length ? 0.6 : 0)];
  };

  // Pick victim, culprit, weapon, motive, crime room, time
  const victim = pick(rng, VICTIMS);
  const selectedSuspectTemplates = shuffle(rng, SUSPECT_POOL).slice(0, config.suspectCount);
  const culpritTemplate = selectedSuspectTemplates[0];
  const innocentTemplates = selectedSuspectTemplates.slice(1);

  const weaponObj = pick(rng, WEAPONS);
  const motiveObj = pick(rng, MOTIVES);
  const otherWeapons = shuffle(rng, WEAPONS.filter((w) => w.name !== weaponObj.name));
  const otherMotives = shuffle(rng, MOTIVES.filter((m) => m.name !== motiveObj.name));

  // Choose crime room (not foyer so players explore!)
  const candidateCrimeRooms = activeRoomIds.filter((id) => id !== 'foyer');
  const crimeRoomId = pick(rng, candidateCrimeRooms);
  const crimeRoomName = ROOM_MAP[crimeRoomId].name;
  const timeOfDeath = pick(rng, TIMES_OF_DEATH);

  // Assign rooms for alibis & physical ghost locations
  const ghostRooms = shuffle(rng, activeRoomIds);
  const culpritFakeAlibiRoom = pick(
    rng,
    activeRoomIds.filter((r) => r !== crimeRoomId),
  );

  // Build suspects
  const suspects: SuspectDef[] = selectedSuspectTemplates.map((tpl, idx) => {
    const isCulprit = tpl.id === culpritTemplate.id;
    const currentRoomId = ghostRooms[idx % ghostRooms.length];
    const alibiRoomId = isCulprit
      ? culpritFakeAlibiRoom
      : activeRoomIds[(idx + 2) % activeRoomIds.length === activeRoomIds.indexOf(crimeRoomId) ? (idx + 3) % activeRoomIds.length : (idx + 2) % activeRoomIds.length];
    const alibiRoomName = ROOM_MAP[alibiRoomId].name;

    const alibi = isCulprit
      ? `I swear I remained alone in the ${alibiRoomName} at ${timeOfDeath}, reading by a single taper.`
      : `I was in the ${alibiRoomName} around ${timeOfDeath}; the grandfather clock chimed just as I checked my pocket watch.`;

    const secretFact = isCulprit
      ? `Avoids looking directly at anything connected to the ${crimeRoomName}.`
      : `Quietly admits they had a brief quarrel with ${victim.name} earlier that afternoon, though never near ${crimeRoomName}.`;

    return {
      id: tpl.id,
      name: tpl.name,
      title: tpl.title,
      ghostTint: tpl.ghostTint,
      hatStyle: tpl.hatStyle,
      roomId: currentRoomId,
      position: nextSpot(currentRoomId),
      alibi,
      alibiRoom: alibiRoomName,
      alibiTime: timeOfDeath,
      personality: tpl.personality,
      secretFact,
      clueReactions: {},
    };
  });

  // Shuffle suspect display order so culprit isn't always index 0
  const orderedSuspects = shuffle(rng, suspects);

  // Build Puzzles (0, 1, or 2 depending on level)
  const puzzles: PuzzleDef[] = [];
  let puzzleUnlockClueId: string | undefined;
  let secondPuzzleUnlockClueId: string | undefined;

  if (config.puzzleCount >= 1) {
    const clockHour = ((level * 3) % 11) + 1;
    const clockMin = pick(rng, ['15', '30', '45']);
    const clockCode = `${clockHour}:${clockMin}`;
    puzzleUnlockClueId = `clue_locked_proof_${level}_1`;
    const puzzleRoomId = activeRoomIds.includes('hallway') ? 'hallway' : activeRoomIds[1];
    puzzles.push({
      id: `puzzle_clock_${level}`,
      type: 'clock',
      title: 'Stopped Corridor Clock',
      roomId: puzzleRoomId,
      position: [-3.3, 0, -0.8],
      prompt: `Set the brass hands of the corridor clock to the true silent chime hidden in the manor.`,
      hintForStaines: `Staines sees an engraving on the pendulum: "Set the hour to ${clockHour}."`,
      hintForAnika: `Anika sees frost-etched Roman numerals on the glass: "Set the minutes to :${clockMin}."`,
      options: shuffle(rng, [
        clockCode,
        `${((clockHour + 2) % 12) || 12}:00`,
        `${((clockHour + 5) % 12) || 12}:15`,
        `${clockHour}:${clockMin === '15' ? '45' : '15'}`,
      ]),
      correctCode: clockCode,
      unlocksClueId: puzzleUnlockClueId,
    });
  }

  if (config.puzzleCount >= 2) {
    const vialOrder = pick(rng, ['Emerald · Amber · Violet', 'Violet · Crimson · Emerald', 'Amber · Indigo · Silver']);
    const decoys = [
      'Crimson · Silver · Amber',
      'Indigo · Emerald · Violet',
      'Silver · Amber · Crimson',
      'Emerald · Amber · Violet',
      'Violet · Crimson · Emerald',
      'Amber · Indigo · Silver',
    ].filter((v) => v !== vialOrder);
    secondPuzzleUnlockClueId = `clue_locked_proof_${level}_2`;
    const p2RoomId = activeRoomIds.includes('study')
      ? 'study'
      : activeRoomIds.includes('conservatory')
        ? 'conservatory'
        : 'library';
    puzzles.push({
      id: `puzzle_alch_${level}`,
      type: p2RoomId === 'study' ? 'alchemy_vials' : 'rune_pedestals',
      title: p2RoomId === 'study' ? 'Alchemist’s Vial Rack' : 'Pedestal Seal',
      roomId: p2RoomId,
      position: nextSpot(p2RoomId),
      prompt: 'Arrange the three reagent seals in the exact order to spring the hidden drawer.',
      hintForStaines: `Staines reads a torn label: "Begin with ${vialOrder.split(' · ')[0]}, end with ${vialOrder.split(' · ')[2]}."`,
      hintForAnika: `Anika sees glowing residue on the middle slot: "The center vessel must be ${vialOrder.split(' · ')[1]}."`,
      options: shuffle(rng, [vialOrder, decoys[0], decoys[1], decoys[2]]),
      correctCode: vialOrder,
      unlocksClueId: secondPuzzleUnlockClueId,
    });
  }

  // Build deterministic clue chain!
  const clues: ClueDef[] = [];
  const pickRoomExcluding = (exclude: string[]) => {
    const pool = activeRoomIds.filter((r) => !exclude.includes(r));
    return pick(rng, pool.length ? pool : activeRoomIds);
  };

  // 1. Crime scene anchor clue (visible to both)
  clues.push({
    id: `clue_scene_${level}`,
    title: `Disturbance in the ${crimeRoomName}`,
    category: 'physical',
    roomId: crimeRoomId,
    position: nextSpot(crimeRoomId),
    propType: 'glass',
    visibility: 'both',
    summary: `${victim.name} fell in the ${crimeRoomName} at ${timeOfDeath}.`,
    detail: `Signs of a sudden struggle mark the ${crimeRoomName}. The wall timepiece stopped dead at ${timeOfDeath}, and the scent of ${weaponObj.trace} lingers.`,
    revealsWeapon: weaponObj.name,
    isRedHerring: false,
    chainStep: 1,
  });

  // 2. Asymmetrical Alibi-Breaker Part A (Staines) + Part B (Anika)
  const alibiRoomName = ROOM_MAP[culpritFakeAlibiRoom].name;
  const alibiBreakClue1Id = `clue_alibi_break_a_${level}`;
  clues.push({
    id: alibiBreakClue1Id,
    title: `${alibiRoomName} Latch Bolt`,
    category: 'physical',
    roomId: culpritFakeAlibiRoom,
    position: nextSpot(culpritFakeAlibiRoom),
    propType: 'key',
    visibility: 'staines',
    summary: `The ${alibiRoomName} was bolted from the corridor side all evening.`,
    detail: `Dust on the inner handle is completely undisturbed. Nobody could have been sitting inside the ${alibiRoomName} at ${timeOfDeath} — contradicting ${culpritTemplate.name}'s claim.`,
    pointsToSuspectId: culpritTemplate.id,
    isRedHerring: false,
    chainStep: 1,
  });

  // 3. Personal Trait Trace linking culprit to Crime Room (Anika) - chained in Medium/Hard
  const culpritTraceId = puzzleUnlockClueId || `clue_culprit_trace_${level}`;
  clues.push({
    id: culpritTraceId,
    title: `Dropped ${culpritTemplate.traitItem}`,
    category: 'physical',
    roomId: crimeRoomId,
    position: nextSpot(crimeRoomId),
    propType: 'locket',
    visibility: 'anika',
    summary: `A ${culpritTemplate.traitItem} belonging to ${culpritTemplate.name} lies in the ${crimeRoomName}.`,
    detail: `Tucked beneath the baseboard of the ${crimeRoomName}, Anika's spectral sight spots a ${culpritTemplate.traitItem} smudged with soot from ${timeOfDeath}.`,
    pointsToSuspectId: culpritTemplate.id,
    requiresPuzzleId: puzzleUnlockClueId ? puzzles[0].id : undefined,
    requiresClueId: config.chainDepth >= 2 && !puzzleUnlockClueId ? alibiBreakClue1Id : undefined,
    isRedHerring: false,
    chainStep: config.chainDepth >= 2 ? 2 : 1,
  });

  // 4. Weapon Forensic Proof (Staines or Anika)
  const weaponClueId = secondPuzzleUnlockClueId || `clue_weapon_proof_${level}`;
  const weaponRoomId = pickRoomExcluding([crimeRoomId]);
  clues.push({
    id: weaponClueId,
    title: `Hidden ${weaponObj.name}`,
    category: 'physical',
    roomId: weaponRoomId,
    position: nextSpot(weaponRoomId),
    propType: weaponObj.propType,
    visibility: level % 2 === 0 ? 'staines' : 'anika',
    summary: `The ${weaponObj.name} bears fresh forensic traces from the ${crimeRoomName}.`,
    detail: `Carefully wiped yet still showing ${weaponObj.trace}, this ${weaponObj.name} was stashed inside the ${ROOM_MAP[weaponRoomId].name} shortly after ${timeOfDeath}.`,
    revealsWeapon: weaponObj.name,
    pointsToSuspectId: culpritTemplate.id,
    requiresPuzzleId: secondPuzzleUnlockClueId && puzzles[1] ? puzzles[1].id : undefined,
    requiresClueId: config.chainDepth >= 3 && !secondPuzzleUnlockClueId ? culpritTraceId : undefined,
    isRedHerring: false,
    chainStep: config.chainDepth >= 3 ? 3 : 2,
  });

  // 5. Motive Document Proof (split across asymmetrical sight in higher levels)
  const motiveRoomId = pickRoomExcluding([crimeRoomId, weaponRoomId]);
  const motiveKeyId = `clue_motive_key_${level}`;
  if (config.chainDepth >= 2) {
    clues.push({
      id: motiveKeyId,
      title: 'Ciphered Wax Envelope',
      category: 'cipher',
      roomId: pickRoomExcluding([motiveRoomId]),
      position: nextSpot(pickRoomExcluding([motiveRoomId])),
      propType: 'letter',
      visibility: 'anika',
      summary: `Anika decodes initials on the envelope: "${culpritTemplate.name.split(' ').slice(-1)[0]}" & "${motiveObj.name}".`,
      detail: `Heat-reactive ink reveals a private note linking ${culpritTemplate.name} directly to the ${motiveObj.docHook}.`,
      revealsMotive: motiveObj.name,
      isRedHerring: false,
      chainStep: 1,
    });
  }

  clues.push({
    id: `clue_motive_doc_${level}`,
    title: `${motiveObj.name} Dossier`,
    category: 'document',
    roomId: motiveRoomId,
    position: nextSpot(motiveRoomId),
    propType: 'ledger',
    visibility: 'staines',
    summary: `${culpritTemplate.name} stood to lose everything over ${motiveObj.name}.`,
    detail: `Inside a leather-bound folder in the ${ROOM_MAP[motiveRoomId].name}, Staines finds ${motiveObj.docHook} naming ${culpritTemplate.name} as the sole beneficiary of ${victim.name}'s silence.`,
    revealsMotive: motiveObj.name,
    pointsToSuspectId: culpritTemplate.id,
    requiresClueId: config.chainDepth >= 2 ? motiveKeyId : undefined,
    isRedHerring: false,
    chainStep: config.chainDepth >= 2 ? 2 : 1,
  });

  // 6. Innocent Alibi Corroborations (every innocent can be cleared!)
  innocentTemplates.forEach((innocent, idx) => {
    const roomId = activeRoomIds[(idx + 2) % activeRoomIds.length];
    const vis: ClueVisibility = idx % 3 === 0 ? 'both' : idx % 3 === 1 ? 'staines' : 'anika';
    const susObj = suspects.find((s) => s.id === innocent.id)!;
    clues.push({
      id: `clue_clear_${innocent.id}_${level}`,
      title: `${innocent.name.split(' ')[0]}’s Alibi Note`,
      category: 'witness',
      roomId,
      position: nextSpot(roomId),
      propType: idx % 2 === 0 ? 'letter' : 'footprint',
      visibility: vis,
      summary: `${innocent.name} is confirmed in the ${susObj.alibiRoom} at ${timeOfDeath}.`,
      detail: `A parlor guest log and fresh wax droplet confirm ${innocent.name} remained inside the ${susObj.alibiRoom} when ${timeOfDeath} struck—ruling them out of the murder.`,
      eliminatesSuspectId: innocent.id,
      isRedHerring: false,
      chainStep: 1,
    });
  });

  // 7. Red Herrings (scaled by difficulty, never contradicting the true solution!)
  for (let r = 0; r < config.redHerringCount; r++) {
    const innocent = innocentTemplates[r % innocentTemplates.length];
    const decoyWeapon = otherWeapons[r % otherWeapons.length];
    const decoyMotive = otherMotives[r % otherMotives.length];
    const roomId = activeRoomIds[(r + 3) % activeRoomIds.length];
    const vis: ClueVisibility = r % 2 === 0 ? 'staines' : 'anika';

    clues.push({
      id: `clue_herring_${level}_${r}`,
      title: r % 2 === 0 ? `Misplaced ${decoyWeapon.name}` : `Gossip About ${innocent.name.split(' ')[0]}`,
      category: r % 2 === 0 ? 'physical' : 'document',
      roomId,
      position: nextSpot(roomId),
      propType: r % 2 === 0 ? decoyWeapon.propType : 'blueprint',
      visibility: vis,
      summary:
        r % 2 === 0
          ? `A dusty ${decoyWeapon.name} sits in the ${ROOM_MAP[roomId].name}, though its edge shows no blood or recent wear.`
          : `An old draft mentions ${innocent.name} arguing over ${decoyMotive.name}, dated three years prior.`,
      detail:
        r % 2 === 0
          ? `At first glance this ${decoyWeapon.name} looks ominous, yet close inspection shows thick unbroken cobwebs—it hasn't been touched in months.`
          : `While ${innocent.name} once disputed ${decoyMotive.name}, the dates are from years ago and have no connection to tonight's crime in the ${crimeRoomName}.`,
      isRedHerring: true,
      chainStep: 1,
    });
  }

  // Populate suspect reactions to clues
  orderedSuspects.forEach((sus) => {
    const isCulprit = sus.id === culpritTemplate.id;
    sus.clueReactions[clues[0].id] = isCulprit
      ? `The ${crimeRoomName}? Dreadful acoustics. I wouldn't set foot near there tonight.`
      : `I heard glass shatter toward the ${crimeRoomName} right around ${timeOfDeath}.`;

    sus.clueReactions[culpritTraceId] = isCulprit
      ? `That ${culpritTemplate.traitItem}? Anyone could have borrowed it from my coat pocket!`
      : `Curious—I saw ${culpritTemplate.name} fiddling with a ${culpritTemplate.traitItem} near the stairs earlier.`;

    sus.clueReactions[`clue_motive_doc_${level}`] = isCulprit
      ? `Pure slander! You cannot prove ${motiveObj.name} had anything to do with me.`
      : `Everyone whispered about ${motiveObj.name}, though ${culpritTemplate.name} stood to suffer most if it surfaced.`;
  });

  // Hints (stingier as levels progress)
  const allHints = [
    `Start in the ${crimeRoomName} — check both shared and partner-only traces around ${timeOfDeath}.`,
    `Compare ${culpritTemplate.name}'s alibi in the ${alibiRoomName} against what Staines can inspect on the room latch.`,
    `The true weapon left ${weaponObj.trace}. Look closely for the ${weaponObj.name}.`,
    `Pin the ${motiveObj.name} dossier to the Shared Notebook before submitting your accusation.`,
  ];

  const hints = allHints.slice(0, config.maxHints);

  return {
    level,
    seed,
    title: `Case ${level}: ${CASE_TITLES[(level - 1) % CASE_TITLES.length]}`,
    victimName: victim.name,
    victimBio: victim.bio,
    difficulty: config.tier,
    estimatedMinutes: config.estimatedMinutes,
    activeRoomIds,
    suspects: orderedSuspects,
    clues,
    puzzles,
    solution: {
      culpritId: culpritTemplate.id,
      weapon: weaponObj.name,
      motive: motiveObj.name,
      crimeRoomId,
      timeOfDeath,
      explanation: `${culpritTemplate.name} murdered ${victim.name} in the ${crimeRoomName} at ${timeOfDeath} using the ${weaponObj.name}, driven by ${motiveObj.name}. Their alibi in the ${alibiRoomName} was impossible because the door was bolted from outside.`,
    },
    maxHints: config.maxHints,
    hints,
    tutorialSteps: level === 1 ? LEVEL_1_TUTORIAL : [],
  };
}
