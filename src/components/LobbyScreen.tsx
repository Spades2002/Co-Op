import { useState } from 'react';
import {
  ACCENT_COLORS,
  ACCESSORY_STYLES,
  BOTTOM_STYLES,
  OUTFIT_COLORS,
  TOP_STYLES,
} from '../data/customizationOptions.ts';
import type { CharacterAppearance, PlayerSettings, Role } from '../types/game.ts';
import { CharacterPreview3D } from './CharacterPreview3D.tsx';
import { Heart, RotateCcw, Settings, Sparkles, Users, Volume2, VolumeX } from 'lucide-react';

interface LobbyScreenProps {
  role: Role;
  onChangeRole: (role: Role) => void;
  appearance: CharacterAppearance;
  onChangeAppearance: (next: CharacterAppearance) => void;
  onCreateRoom: (startLevel: number) => void;
  onJoinRoom: (code: string) => void;
  lastSession: { roomCode: string; role: Role } | null;
  errorMsg: string | null;
  connecting: boolean;
  settings: PlayerSettings;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

export function LobbyScreen({
  role,
  onChangeRole,
  appearance,
  onChangeAppearance,
  onCreateRoom,
  onJoinRoom,
  lastSession,
  errorMsg,
  connecting,
  settings,
  onOpenSettings,
  onToggleMute,
}: LobbyScreenProps) {
  const [joinCode, setJoinCode] = useState(lastSession?.roomCode || '');
  const [startLevel, setStartLevel] = useState(1);

  const update = <K extends keyof CharacterAppearance>(key: K, val: CharacterAppearance[K]) => {
    onChangeAppearance({ ...appearance, [key]: val });
  };

  return (
    <div className="relative w-full h-full overflow-y-auto manor-scroll bg-[#0b0e17] text-[#eef1f7]">
      {/* Subtle atmospheric radial gradient background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at 25% 18%, rgba(226, 168, 75, 0.11), transparent 48%), radial-gradient(circle at 80% 75%, rgba(56, 189, 248, 0.08), transparent 46%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 min-h-full flex flex-col justify-between gap-6">
        {/* Clean Header */}
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-wide text-[#f7eedb] truncate">
              Blackwood Manor
            </h1>
            <p className="text-xs sm:text-sm text-[#e6c4cb] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Heart className="w-3.5 h-3.5 text-[#f43f5e] fill-[#f43f5e] shrink-0" />
              <span>A game for Rajkonna and Mr Kuchumuchu</span>
              <Heart className="w-3.5 h-3.5 text-[#f43f5e] fill-[#f43f5e] shrink-0" />
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              className="h-10 w-10 flex items-center justify-center rounded-lg border border-white/10 bg-[#151b2c] hover:bg-[#1d253b] text-[#d9e0ef] transition-colors cursor-pointer"
              title={settings.muted ? 'Unmute audio' : 'Mute audio'}
            >
              {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="h-10 px-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#151b2c] hover:bg-[#1d253b] text-sm font-medium text-[#d9e0ef] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </header>

        {/* Main 2-column split: Character Wardrobe + Room Entry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: 3D Character Customizer */}
          <section className="lg:col-span-7 bg-[#121726] border border-white/10 rounded-xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#f3e7ce]">
                  Detective Wardrobe
                </h2>
                <p className="text-xs text-[#94a0b8]">
                  Saved locally and shown live to your partner in the mansion.
                </p>
              </div>

              {/* Character Role Selector */}
              <div className="flex items-center gap-1 p-1 bg-[#0b0e17] rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => onChangeRole('staines')}
                  className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    role === 'staines'
                      ? 'bg-[#e2a84b] text-[#0b0e17]'
                      : 'text-[#a3afc7] hover:text-white'
                  }`}
                >
                  Staines
                </button>
                <button
                  type="button"
                  onClick={() => onChangeRole('anika')}
                  className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    role === 'anika'
                      ? 'bg-[#38bdf8] text-[#0b0e17]'
                      : 'text-[#a3afc7] hover:text-white'
                  }`}
                >
                  Anika
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch flex-1">
              {/* Live 3D Model Canvas */}
              <div className="md:col-span-5 bg-[#0c101b] border border-white/10 rounded-lg relative min-h-[270px] flex flex-col justify-end overflow-hidden">
                <div className="absolute inset-0">
                  <CharacterPreview3D role={role} appearance={appearance} />
                </div>
                <div className="relative z-10 px-3 py-2 text-center text-xs text-[#95a2ba] bg-gradient-to-t from-[#0b0e17]/90 to-transparent pointer-events-none">
                  Drag to rotate · {role === 'staines' ? 'Staines' : 'Anika'}
                </div>
              </div>

              {/* Customizer Controls */}
              <div className="md:col-span-7 flex flex-col gap-4">
                {(
                  <div className="flex flex-col gap-3.5">
                    <div>
                      <span className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                        Coat / Top
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {TOP_STYLES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => update('topStyle', t.id)}
                            className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                              appearance.topStyle === t.id
                                ? 'border-[#e2a84b] bg-[#e2a84b]/15 text-[#f9e7c4]'
                                : 'border-white/10 bg-[#171d2f] text-[#b4bfd6] hover:border-white/25'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                          Lower Garment
                        </span>
                        <select
                          value={appearance.bottomStyle}
                          onChange={(e) =>
                            update('bottomStyle', e.target.value as CharacterAppearance['bottomStyle'])
                          }
                          className="w-full h-10 px-3 rounded-lg bg-[#171d2f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#e2a84b]"
                        >
                          {BOTTOM_STYLES.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                          Accessory
                        </span>
                        <select
                          value={appearance.accessory}
                          onChange={(e) =>
                            update('accessory', e.target.value as CharacterAppearance['accessory'])
                          }
                          className="w-full h-10 px-3 rounded-lg bg-[#171d2f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#e2a84b]"
                        >
                          {ACCESSORY_STYLES.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                          Primary Colour
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {OUTFIT_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => update('primaryColor', c.hex)}
                              title={c.label}
                              className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                                appearance.primaryColor === c.hex
                                  ? 'border-[#e2a84b]'
                                  : 'border-white/15'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                          Accent Colour
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ACCENT_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => update('accentColor', c.hex)}
                              title={c.label}
                              className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                                appearance.accentColor === c.hex
                                  ? 'border-white'
                                  : 'border-white/15'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Right: Create or Join Co-op Mansion Room */}
          <section className="lg:col-span-5 bg-[#121726] border border-white/10 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#f3e7ce]">
                  Enter the Mansion
                </h2>
                <p className="text-xs sm:text-sm text-[#94a0b8] mt-1 leading-relaxed">
                  One partner opens a room and shares the 5-letter code. Progress across all 30 seeded murder cases is saved so you can drop back in anytime.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-950/70 border border-red-400/40 text-xs sm:text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              {/* Reconnect card if last session exists */}
              {lastSession && (
                <div className="p-4 rounded-lg bg-[#172033] border border-[#e2a84b]/40 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#d6b77b] font-medium">Previous Room Found</div>
                    <div className="font-mono-num text-base font-semibold text-white mt-0.5">
                      {lastSession.roomCode} · {lastSession.role === 'staines' ? 'Staines' : 'Anika'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() => onJoinRoom(lastSession.roomCode)}
                    className="h-10 px-4 rounded-lg bg-[#e2a84b] hover:bg-[#eab65c] text-[#0b0e17] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reconnect</span>
                  </button>
                </div>
              )}

              {/* Create New Room */}
              <div className="p-4 rounded-lg bg-[#161c2e] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#e2a84b]" />
                    Host a New Session
                  </span>
                  <span className="text-xs text-[#8f9bb3] font-mono-num">
                    Case {startLevel} / 30
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-[#94a0b8] mb-1.5">
                    Starting Case Level ({startLevel <= 10 ? 'Easy' : startLevel <= 20 ? 'Medium' : 'Hard'})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={startLevel}
                    onChange={(e) => setStartLevel(Number(e.target.value))}
                    className="w-full accent-[#e2a84b] cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#7f8ba3] font-mono-num mt-1">
                    <span>1 · Easy</span>
                    <span>11 · Medium</span>
                    <span>21–30 · Hard</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => onCreateRoom(startLevel)}
                  className="w-full h-11 rounded-lg bg-[#e2a84b] hover:bg-[#edb85d] text-[#0b0e17] font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {connecting ? 'Opening Manor Doors...' : `Create Room as ${role === 'staines' ? 'Staines' : 'Anika'}`}
                </button>
              </div>

              {/* Join Existing Room */}
              <div className="p-4 rounded-lg bg-[#161c2e] border border-white/10 flex flex-col gap-3">
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#38bdf8]" />
                  Join Partner’s Room
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                    className="flex-1 h-11 px-3 rounded-lg bg-[#0b0e17] border border-white/15 font-mono-num text-base tracking-widest text-white placeholder:text-[#566179] focus:outline-none focus:border-[#38bdf8]"
                  />
                  <button
                    type="button"
                    disabled={connecting || joinCode.trim().length < 4}
                    onClick={() => onJoinRoom(joinCode.trim())}
                    className="h-11 px-5 rounded-lg bg-[#38bdf8] hover:bg-[#5ccbfd] text-[#0b0e17] font-semibold text-sm transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs text-[#7f8ba3] border-t border-white/10 pt-3 flex flex-wrap gap-x-3 gap-y-1">
              <span>WASD / Touch Joystick to move</span>
              <span>·</span>
              <span>Drag view to orbit</span>
              <span>·</span>
              <span>E or Tap to examine</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
