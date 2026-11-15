import type {
  AccessoryStyle,
  BottomStyle,
  CharacterAppearance,
  FaceShape,
  HairStyle,
  PlayerSettings,
  Role,
  TopStyle,
} from '../types/game.ts';

export const SKIN_TONES = [
  { id: 'porcelain', label: 'Porcelain', hex: '#f4d3be' },
  { id: 'ivory', label: 'Warm Ivory', hex: '#e8be9e' },
  { id: 'olive', label: 'Golden Olive', hex: '#d39f72' },
  { id: 'amber', label: 'Amber Bronze', hex: '#b57b4c' },
  { id: 'chestnut', label: 'Chestnut', hex: '#865334' },
  { id: 'espresso', label: 'Deep Espresso', hex: '#543222' },
];

export const HAIR_COLORS = [
  { id: 'raven', label: 'Raven Black', hex: '#1d1d24' },
  { id: 'espresso', label: 'Dark Espresso', hex: '#3d2820' },
  { id: 'chestnut', label: 'Chestnut', hex: '#6c3e26' },
  { id: 'auburn', label: 'Auburn', hex: '#943c24' },
  { id: 'honey', label: 'Honey Blonde', hex: '#c89e57' },
  { id: 'ash', label: 'Ash Silver', hex: '#a8afb8' },
  { id: 'midnight', label: 'Midnight Indigo', hex: '#283354' },
  { id: 'rosewood', label: 'Rosewood', hex: '#6d2d3b' },
];

export const OUTFIT_COLORS = [
  { id: 'charcoal', label: 'Charcoal', hex: '#2a3040' },
  { id: 'burgundy', label: 'Burgundy', hex: '#682433' },
  { id: 'emerald', label: 'Forest Moss', hex: '#254a3e' },
  { id: 'navy', label: 'Midnight Navy', hex: '#202d4a' },
  { id: 'plum', label: 'Victorian Plum', hex: '#492b4c' },
  { id: 'camel', label: 'Camel Trench', hex: '#8c6943' },
  { id: 'slate', label: 'Storm Slate', hex: '#48566a' },
  { id: 'ivory', label: 'Parchment', hex: '#cbc3b4' },
];

export const ACCENT_COLORS = [
  { id: 'amber', label: 'Lantern Gold', hex: '#e2a84b' },
  { id: 'crimson', label: 'Ruby Silk', hex: '#b83b48' },
  { id: 'teal', label: 'Spectral Jade', hex: '#3ba39c' },
  { id: 'copper', label: 'Burnished Copper', hex: '#c97848' },
  { id: 'silver', label: 'Moon Silver', hex: '#b9c4d4' },
  { id: 'violet', label: 'Amethyst', hex: '#8565b8' },
];

export const FACE_SHAPES: { id: FaceShape; label: string }[] = [
  { id: 'oval', label: 'Oval' },
  { id: 'square', label: 'Square' },
  { id: 'heart', label: 'Heart' },
  { id: 'chiseled', label: 'Chiseled' },
];

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'quiff', label: 'Swept Quiff' },
  { id: 'waves', label: 'Long Waves' },
  { id: 'bob', label: 'Classic Bob' },
  { id: 'sidepart', label: 'Side Part' },
  { id: 'braids', label: 'Braided Crown' },
  { id: 'curly', label: 'Curly Crop' },
];

export const TOP_STYLES: { id: TopStyle; label: string }[] = [
  { id: 'trench', label: 'Trench Coat' },
  { id: 'waistcoat', label: 'Waistcoat' },
  { id: 'blazer', label: 'Tailored Blazer' },
  { id: 'sweater', label: 'Cable Knit' },
];

export const BOTTOM_STYLES: { id: BottomStyle; label: string }[] = [
  { id: 'trousers', label: 'Trousers' },
  { id: 'skirt', label: 'Pleated Skirt' },
  { id: 'riding', label: 'Riding Pants' },
];

export const ACCESSORY_STYLES: { id: AccessoryStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'monocle', label: 'Brass Monocle' },
  { id: 'satchel', label: 'Field Satchel' },
  { id: 'fedora', label: 'Detective Hat' },
  { id: 'scarf', label: 'Silk Scarf' },
];

export const DEFAULT_APPEARANCE: Record<Role, CharacterAppearance> = {
  staines: {
    faceShape: 'chiseled',
    skinTone: '#d39f72',
    hairStyle: 'quiff',
    hairColor: '#1d1d24',
    topStyle: 'trench',
    bottomStyle: 'trousers',
    accessory: 'fedora',
    primaryColor: '#2a3040',
    accentColor: '#e2a84b',
  },
  anika: {
    faceShape: 'heart',
    skinTone: '#b57b4c',
    hairStyle: 'waves',
    hairColor: '#3d2820',
    topStyle: 'blazer',
    bottomStyle: 'skirt',
    accessory: 'scarf',
    primaryColor: '#682433',
    accentColor: '#3ba39c',
  },
};

export const DEFAULT_SETTINGS: PlayerSettings = {
  musicVolume: 0.45,
  sfxVolume: 0.7,
  muted: false,
  graphicsQuality: 'medium',
  cameraSensitivity: 1.0,
  invertY: false,
};

const APPEARANCE_KEY = 'blackwood_appearance_v1';
const SETTINGS_KEY = 'blackwood_settings_v1';
const SESSION_KEY = 'blackwood_session_v1';

export function loadSavedAppearance(role: Role): CharacterAppearance {
  try {
    const raw = localStorage.getItem(`${APPEARANCE_KEY}_${role}`);
    if (!raw) return DEFAULT_APPEARANCE[role];
    return { ...DEFAULT_APPEARANCE[role], ...JSON.parse(raw) };
  } catch {
    return DEFAULT_APPEARANCE[role];
  }
}

export function saveAppearance(role: Role, appearance: CharacterAppearance): void {
  try {
    localStorage.setItem(`${APPEARANCE_KEY}_${role}`, JSON.stringify(appearance));
  } catch {
    // ignore storage quota errors
  }
}

export function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function loadLastSession(): { roomCode: string; role: Role } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && (parsed.role === 'staines' || parsed.role === 'anika')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLastSession(roomCode: string, role: Role): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, role }));
  } catch {
    // ignore
  }
}

export function clearLastSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
