export type Role = 'staines' | 'anika';

export type DifficultyTier = 'easy' | 'medium' | 'hard';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type FaceShape = 'oval' | 'square' | 'heart' | 'chiseled';
export type HairStyle = 'quiff' | 'waves' | 'bob' | 'sidepart' | 'braids' | 'curly';
export type TopStyle = 'trench' | 'waistcoat' | 'blazer' | 'sweater';
export type BottomStyle = 'trousers' | 'skirt' | 'riding';
export type AccessoryStyle = 'none' | 'monocle' | 'satchel' | 'fedora' | 'scarf' | 'bindi';

export interface CharacterAppearance {
  faceShape: FaceShape;
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  topStyle: TopStyle;
  bottomStyle: BottomStyle;
  accessory: AccessoryStyle;
  primaryColor: string;
  accentColor: string;
}

export interface PlayerSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  graphicsQuality: GraphicsQuality;
  cameraSensitivity: number;
  invertY: boolean;
}

export interface EmoteEvent {
  id: string;
  text: string;
  icon: string;
  at: number;
}

export interface PingBeacon {
  id: string;
  role: Role;
  position: [number, number, number];
  roomName: string;
  at: number;
}

export interface PlayerSyncState {
  role: Role;
  name: string;
  connected: boolean;
  appearance: CharacterAppearance;
  position: [number, number, number];
  rotationY: number;
  moving: boolean;
  roomId: string;
  lastEmote?: EmoteEvent;
}

export interface FurnitureDef {
  id: string;
  kind:
    | 'table'
    | 'sofa'
    | 'bookshelf'
    | 'piano'
    | 'clock'
    | 'desk'
    | 'stove'
    | 'fountain'
    | 'barrel'
    | 'bed'
    | 'pedestal'
    | 'chandelier'
    | 'armor'
    | 'telescope'
    | 'cabinet';
  position: [number, number, number];
  size: [number, number, number]; // width, height, depth
  rotationY?: number;
  color?: string;
}

export interface DoorDef {
  id: string;
  toRoomId: string;
  position: [number, number, number];
  axis: 'x' | 'z'; // wall orientation: 'x' means wall runs along X (door passes Z), 'z' means wall runs along Z (door passes X)
  width: number;
  lockedByTier?: DifficultyTier;
  lockedByPuzzleId?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  subtitle: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  floorStyle: 'wood' | 'marble' | 'stone' | 'glass';
  floorColor: string;
  wallColor: string;
  rugColor?: string;
  unlockedAtLevel: number;
  doors: DoorDef[];
  furniture: FurnitureDef[];
}

export interface SuspectDef {
  id: string;
  name: string;
  title: string;
  ghostTint: string;
  hatStyle: 'tophat' | 'veil' | 'spectacles' | 'hood' | 'none';
  roomId: string;
  position: [number, number, number];
  alibi: string;
  alibiRoom: string;
  alibiTime: string;
  personality: string;
  secretFact: string;
  clueReactions: Record<string, string>;
}

export type ClueCategory = 'physical' | 'document' | 'witness' | 'cipher';
export type ClueVisibility = 'staines' | 'anika' | 'both';
export type CluePropType =
  | 'letter'
  | 'dagger'
  | 'vial'
  | 'footprint'
  | 'ledger'
  | 'key'
  | 'glass'
  | 'locket'
  | 'candle'
  | 'blueprint';

export interface ClueDef {
  id: string;
  title: string;
  category: ClueCategory;
  roomId: string;
  position: [number, number, number];
  propType: CluePropType;
  visibility: ClueVisibility;
  summary: string;
  detail: string;
  pointsToSuspectId?: string;
  eliminatesSuspectId?: string;
  revealsWeapon?: string;
  revealsMotive?: string;
  requiresClueId?: string;
  requiresPuzzleId?: string;
  isRedHerring: boolean;
  chainStep: number;
}

export type PuzzleType = 'clock' | 'cipher_books' | 'alchemy_vials' | 'rune_pedestals';

export interface PuzzleDef {
  id: string;
  type: PuzzleType;
  title: string;
  roomId: string;
  position: [number, number, number];
  prompt: string;
  hintForStaines: string;
  hintForAnika: string;
  options: string[];
  correctCode: string;
  unlocksClueId?: string;
  unlocksRoomId?: string;
}

export interface TutorialStep {
  id: string;
  label: string;
  detail: string;
}

export interface CaseSolution {
  culpritId: string;
  weapon: string;
  motive: string;
  crimeRoomId: string;
  timeOfDeath: string;
  explanation: string;
}

export interface CaseData {
  level: number;
  seed: number;
  title: string;
  victimName: string;
  victimBio: string;
  difficulty: DifficultyTier;
  estimatedMinutes: number;
  activeRoomIds: string[];
  suspects: SuspectDef[];
  clues: ClueDef[];
  puzzles: PuzzleDef[];
  solution: CaseSolution;
  maxHints: number;
  hints: string[];
  tutorialSteps: TutorialStep[];
}

export interface NotebookEntry {
  id: string;
  authorRole: Role;
  clueId?: string;
  title: string;
  text: string;
  pinned: boolean;
  tag?: 'suspect' | 'weapon' | 'motive' | 'alibi' | 'note';
  createdAt: number;
}

export interface AccusationDraft {
  culpritId: string;
  weapon: string;
  motive: string;
}

export interface RoomSessionState {
  code: string;
  currentLevel: number;
  unlockedLevel: number;
  solvedLevels: number[];
  players: Partial<Record<Role, PlayerSyncState>>;
  discoveredClueIds: string[];
  clueFoundBy: Record<string, Role>;
  questionedSuspectIds: string[];
  solvedPuzzleIds: string[];
  notebook: NotebookEntry[];
  pings: PingBeacon[];
  hintsRevealed: number;
  accusationVotes: Partial<Record<Role, AccusationDraft>>;
  caseOutcome: null | {
    won: boolean;
    submittedBy: Role;
    accusation: AccusationDraft;
    at: number;
  };
  soloPreviewMode: boolean;
  updatedAt: number;
}
