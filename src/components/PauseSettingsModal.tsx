import { MANSION_ROOMS } from '../data/mansionLayout.ts';
import type {
  CaseData,
  GraphicsQuality,
  PlayerSettings,
  Role,
  RoomSessionState,
} from '../types/game.ts';
import { Check, Lightbulb, LogOut, Map as MapIcon, Sliders, X } from 'lucide-react';

interface PauseSettingsModalProps {
  initialTab: 'pause' | 'levels' | 'map' | 'settings' | 'hints';
  onTabChange: (tab: 'pause' | 'levels' | 'map' | 'settings' | 'hints') => void;
  caseData: CaseData | null;
  roomState: RoomSessionState | null;
  myRole: Role;
  settings: PlayerSettings;
  onUpdateSettings: (next: PlayerSettings) => void;
  onSelectLevel: (level: number) => void;
  onRevealHint: () => void;
  onSwitchRole: (role: Role) => void;
  onToggleSoloPreview: (enabled: boolean) => void;
  onLeaveRoom: () => void;
  onClose: () => void;
}

export function PauseSettingsModal({
  initialTab,
  onTabChange,
  caseData,
  roomState,
  myRole,
  settings,
  onUpdateSettings,
  onSelectLevel,
  onRevealHint,
  onSwitchRole,
  onToggleSoloPreview,
  onLeaveRoom,
  onClose,
}: PauseSettingsModalProps) {
  const inGame = Boolean(caseData && roomState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#070910]/80">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#121726] border border-white/15 rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-[#f7eedb]">
            {inGame ? `Mansion Menu · Room ${roomState?.code}` : 'Settings'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/10 bg-[#1a2135] hover:bg-[#242e47] flex items-center justify-center text-[#d5deef] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation */}
        {inGame && (
          <div className="flex items-center gap-1 px-5 py-2.5 border-b border-white/10 bg-[#0e1320] overflow-x-auto">
            {(
              [
                { id: 'pause', label: 'Session' },
                { id: 'map', label: 'Mansion Map' },
                { id: 'hints', label: 'Hints' },
                { id: 'levels', label: '30 Cases' },
                { id: 'settings', label: 'Settings' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  initialTab === t.id
                    ? 'bg-[#e2a84b] text-[#0b0e17]'
                    : 'text-[#a3afc7] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto manor-scroll p-5">
          {initialTab === 'pause' && inGame && roomState && caseData && (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-lg bg-[#161c2e] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#94a0b8]">Share Code with Partner</div>
                  <div className="font-mono-num text-2xl font-semibold text-[#e2a84b] tracking-widest mt-0.5">
                    {roomState.code}
                  </div>
                </div>
                <div className="text-xs text-[#c5cede] flex flex-col gap-1">
                  <span>
                    Staines:{' '}
                    {roomState.players.staines?.connected ? 'Connected' : 'Away / Open'}
                  </span>
                  <span>
                    Anika:{' '}
                    {roomState.players.anika?.connected ? 'Connected' : 'Away / Open'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161c2e] border border-white/10 flex flex-col gap-3">
                <div className="text-sm font-semibold text-white">Role &amp; Solo Preview</div>
                <p className="text-xs text-[#94a0b8]">
                  In 2-player co-op, clues are split between Staines and Anika. If you are exploring alone while waiting for your partner, you can toggle Solo Sight Preview or switch roles if the other character is unoccupied.
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSwitchRole(myRole === 'staines' ? 'anika' : 'staines')}
                    className="h-10 px-4 rounded-lg border border-white/15 bg-[#1c2438] hover:bg-[#25304a] text-xs font-medium text-white cursor-pointer"
                  >
                    Switch to {myRole === 'staines' ? 'Anika' : 'Staines'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSoloPreview(!roomState.soloPreviewMode)}
                    className={`h-10 px-4 rounded-lg border text-xs font-medium cursor-pointer ${
                      roomState.soloPreviewMode
                        ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-[#bae6fd]'
                        : 'border-white/15 bg-[#1c2438] text-[#cbd5e1]'
                    }`}
                  >
                    Solo Sight Preview: {roomState.soloPreviewMode ? 'On' : 'Off'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="h-10 px-4 rounded-lg border border-rose-400/30 bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 text-xs font-medium flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Return to Wardrobe</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-5 rounded-lg bg-[#e2a84b] hover:bg-[#edb960] text-[#0b0e17] text-xs font-semibold cursor-pointer"
                >
                  Resume Case
                </button>
              </div>
            </div>
          )}

          {initialTab === 'map' && inGame && caseData && roomState && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-[#94a0b8]">
                <span className="flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4 text-[#e2a84b]" />
                  <span>Blackwood Manor Floorplan · {caseData.activeRoomIds.length} Accessible Rooms</span>
                </span>
                <span>Gold: Staines · Blue: Anika</span>
              </div>

              {/* Accurate spatial SVG floorplan mapped directly from MANSION_ROOMS bounds */}
              <div className="w-full bg-[#0b0e17] border border-white/10 rounded-lg p-3">
                <svg viewBox="-23 -30 46 48" className="w-full max-h-[380px]">
                  {MANSION_ROOMS.map((room) => {
                    const active = caseData.activeRoomIds.includes(room.id);
                    const { minX, maxX, minZ, maxZ } = room.bounds;
                    const w = maxX - minX;
                    const h = maxZ - minZ;
                    return (
                      <g key={room.id} opacity={active ? 1 : 0.25}>
                        <rect
                          x={minX}
                          y={minZ}
                          width={w}
                          height={h}
                          fill={active ? '#182136' : '#101420'}
                          stroke={active ? '#465475' : '#262f45'}
                          strokeWidth="0.3"
                        />
                        <text
                          x={minX + w / 2}
                          y={minZ + h / 2 + 0.4}
                          textAnchor="middle"
                          fill={active ? '#d8e0ef' : '#64748b'}
                          fontSize="1.35"
                          fontWeight="600"
                        >
                          {room.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Unfound Clue Markers */}
                  {caseData.clues.map((c) => {
                    const found = roomState.discoveredClueIds.includes(c.id);
                    const mine =
                      roomState.soloPreviewMode || c.visibility === 'both' || c.visibility === myRole;
                    if (!mine && !found) return null;
                    return (
                      <circle
                        key={c.id}
                        cx={c.position[0]}
                        cy={c.position[2]}
                        r="0.55"
                        fill={found ? '#4ade80' : '#f59e0b'}
                      />
                    );
                  })}

                  {/* Player Markers */}
                  {roomState.players.staines && (
                    <circle
                      cx={roomState.players.staines.position[0]}
                      cy={roomState.players.staines.position[2]}
                      r="0.95"
                      fill="#e2a84b"
                      stroke="#0b0e17"
                      strokeWidth="0.3"
                    />
                  )}
                  {roomState.players.anika && (
                    <circle
                      cx={roomState.players.anika.position[0]}
                      cy={roomState.players.anika.position[2]}
                      r="0.95"
                      fill="#38bdf8"
                      stroke="#0b0e17"
                      strokeWidth="0.3"
                    />
                  )}
                </svg>
              </div>
            </div>
          )}

          {initialTab === 'hints' && inGame && caseData && roomState && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Case Hints ({caseData.difficulty.toUpperCase()})
                  </h3>
                  <p className="text-xs text-[#94a0b8]">
                    Hints grow scarcer as difficulty rises ({roomState.hintsRevealed} / {caseData.maxHints} used).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={roomState.hintsRevealed >= caseData.maxHints}
                  onClick={onRevealHint}
                  className="h-10 px-4 rounded-lg bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>Reveal Hint</span>
                </button>
              </div>

              {roomState.hintsRevealed === 0 ? (
                <div className="p-6 text-center text-xs sm:text-sm text-[#8b98b0] bg-[#161c2e] rounded-lg border border-white/10">
                  No hints revealed yet. Try combining clues with your partner first!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {caseData.hints.slice(0, roomState.hintsRevealed).map((h, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-lg bg-[#161c2e] border border-[#e2a84b]/35 text-sm text-[#f3e7ce]"
                    >
                      {i + 1}. {h}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {initialTab === 'levels' && inGame && roomState && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-[#94a0b8]">
                Levels 1–10 are Easy · 11–20 Medium · 21–30 Hard. Every level uses a fixed deterministic seed so both partners share the exact same mystery.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {Array.from({ length: 30 }, (_, idx) => idx + 1).map((lvl) => {
                  const solved = roomState.solvedLevels.includes(lvl);
                  const current = roomState.currentLevel === lvl;
                  const tierColor =
                    lvl <= 10
                      ? 'text-emerald-300'
                      : lvl <= 20
                        ? 'text-amber-300'
                        : 'text-rose-300';
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        onSelectLevel(lvl);
                        onClose();
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        current
                          ? 'border-[#e2a84b] bg-[#e2a84b]/15'
                          : 'border-white/10 bg-[#161c2e] hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-num text-sm font-semibold text-white">
                          Case {lvl}
                        </span>
                        {solved && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${tierColor}`}>
                        {lvl <= 10 ? 'Easy' : lvl <= 20 ? 'Medium' : 'Hard'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {initialTab === 'settings' && (
            <div className="flex flex-col gap-5 max-w-xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sliders className="w-4 h-4 text-[#e2a84b]" />
                <span>Audio &amp; Performance</span>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between text-xs text-[#c5cede] mb-1">
                    <span>Music Volume</span>
                    <span className="font-mono-num">{Math.round(settings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.musicVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, musicVolume: Number(e.target.value) })
                    }
                    className="w-full accent-[#e2a84b]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#c5cede] mb-1">
                    <span>Sound Effects Volume</span>
                    <span className="font-mono-num">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sfxVolume}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, sfxVolume: Number(e.target.value) })
                    }
                    className="w-full accent-[#e2a84b]"
                  />
                </div>

                <div>
                  <span className="block text-xs text-[#c5cede] mb-1.5">
                    Graphics Quality (Recommended: Low or Medium for phones)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, graphicsQuality: q })}
                        className={`h-10 rounded-lg border text-xs font-medium capitalize cursor-pointer ${
                          settings.graphicsQuality === q
                            ? 'border-[#e2a84b] bg-[#e2a84b]/15 text-[#f7eedb]'
                            : 'border-white/10 bg-[#161c2e] text-[#a3afc7]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#c5cede] mb-1">
                    <span>Camera Sensitivity</span>
                    <span className="font-mono-num">{settings.cameraSensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={settings.cameraSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, cameraSensitivity: Number(e.target.value) })
                    }
                    className="w-full accent-[#e2a84b]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
