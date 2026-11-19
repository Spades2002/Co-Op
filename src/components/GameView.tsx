import { useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine.ts';
import { generateCaseForLevel } from '../data/caseGenerator.ts';
import { ROOM_MAP } from '../data/mansionLayout.ts';
import { MansionSceneEngine, type InteractTarget } from '../three/mansionScene.ts';
import type {
  AccusationDraft,
  CharacterAppearance,
  PlayerSettings,
  Role,
  RoomSessionState,
} from '../types/game.ts';
import { InteractionModal } from './InteractionModal.tsx';
import { NotebookModal } from './NotebookModal.tsx';
import { PauseSettingsModal } from './PauseSettingsModal.tsx';
import { TouchJoystick } from './TouchJoystick.tsx';
import {
  BookOpen,
  Check,
  Copy,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Menu,
  Radio,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface GameViewProps {
  roomState: RoomSessionState;
  myRole: Role;
  myAppearance: CharacterAppearance;
  settings: PlayerSettings;
  wsConnected: boolean;
  onUpdateSettings: (next: PlayerSettings) => void;
  onLocalMove: (pos: [number, number, number], rotY: number, moving: boolean, roomId: string) => void;
  onDiscoverClue: (clueId: string, title: string, summary: string, tag: 'suspect' | 'weapon' | 'motive' | 'alibi' | 'note') => void;
  onQuestionSuspect: (suspectId: string) => void;
  onSolvePuzzle: (puzzleId: string) => void;
  onAddNote: (title: string, text: string, tag: 'suspect' | 'weapon' | 'motive' | 'alibi' | 'note') => void;
  onTogglePin: (entryId: string) => void;
  onSendEmote: (icon: string, text: string) => void;
  onSendPing: (pos: [number, number, number], roomName: string) => void;
  onRevealHint: (maxHints: number) => void;
  onVoteAccusation: (draft: AccusationDraft) => void;
  onSubmitAccusation: (draft: AccusationDraft, won: boolean) => void;
  onSelectLevel: (level: number) => void;
  onSwitchRole: (role: Role) => void;
  onToggleSoloPreview: (enabled: boolean) => void;
  onLeaveRoom: () => void;
  engineRefOut: React.MutableRefObject<MansionSceneEngine | null>;
}

const QUICK_EMOTES = [
  { icon: '🔍', text: 'Found Clue!' },
  { icon: '👉', text: 'Look Here!' },
  { icon: '🤨', text: 'Suspicious...' },
  { icon: '🆘', text: 'Need Help' },
  { icon: '👍', text: 'I Agree!' },
];

export function GameView({
  roomState,
  myRole,
  myAppearance,
  settings,
  wsConnected,
  onUpdateSettings,
  onLocalMove,
  onDiscoverClue,
  onQuestionSuspect,
  onSolvePuzzle,
  onAddNote,
  onTogglePin,
  onSendEmote,
  onSendPing,
  onRevealHint,
  onVoteAccusation,
  onSubmitAccusation,
  onSelectLevel,
  onSwitchRole,
  onToggleSoloPreview,
  onLeaveRoom,
  engineRefOut,
}: GameViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const partnerLabelRef = useRef<HTMLDivElement | null>(null);
  const myLastPosRef = useRef<[number, number, number]>([myRole === 'staines' ? -1.4 : 1.4, 0, 12.2]);

  const caseData = useMemo(
    () => generateCaseForLevel(roomState.currentLevel),
    [roomState.currentLevel],
  );

  const [nearTarget, setNearTarget] = useState<InteractTarget | null>(null);
  const [activeInteract, setActiveInteract] = useState<InteractTarget | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<'pause' | 'levels' | 'map' | 'settings' | 'hints' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [tutorialHidden, setTutorialHidden] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const partnerRole: Role = myRole === 'staines' ? 'anika' : 'staines';
  const partner = roomState.players[partnerRole];
  const myPlayer = roomState.players[myRole];

  // Paper sounds when the notebook opens and closes (skip the very first render)
  const notebookMounted = useRef(false);
  useEffect(() => {
    if (!notebookMounted.current) {
      notebookMounted.current = true;
      return;
    }
    if (notebookOpen) soundEngine.playNotebookOpen();
    else soundEngine.playNotebookClose();
  }, [notebookOpen]);

  const callbacksRef = useRef({
    onLocalMove,
    onInteract: (target: InteractTarget) => {
      if (target.kind === 'suspect') soundEngine.playSuspectVoice(target.suspect.id);
      else if (target.kind === 'puzzle') soundEngine.playPuzzleInteract();
      else soundEngine.playObjectInteract(target.clue.propType);
      setActiveInteract(target);
    },
  });
  callbacksRef.current.onLocalMove = onLocalMove;

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Mount Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialPos = roomState.players[myRole]?.position || [
      myRole === 'staines' ? -1.4 : 1.4,
      0,
      12.2,
    ];
    myLastPosRef.current = initialPos;

    const engine = new MansionSceneEngine(container, {
      myRole,
      myAppearance,
      initialPos,
      caseData,
      settings,
      partnerLabelEl: partnerLabelRef.current,
      callbacks: {
        onLocalMove: (pos, rotY, moving, roomId) => {
          myLastPosRef.current = pos;
          if (moving) setHasMoved(true);
          callbacksRef.current.onLocalMove(pos, rotY, moving, roomId);
        },
        onNearTargetChange: (target) => setNearTarget(target),
        onInteract: (target) => callbacksRef.current.onInteract(target),
        onFootstep: () => soundEngine.playFootstep(),
        onContextLostChange: (lost) => setContextLost(lost),
      },
    });

    engineRefOut.current = engine;

    return () => {
      engine.dispose();
      engineRefOut.current = null;
    };
    // Mount once for stable WebGL lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update case when level changes
  const prevLevelRef = useRef(roomState.currentLevel);
  useEffect(() => {
    if (prevLevelRef.current !== roomState.currentLevel && engineRefOut.current) {
      prevLevelRef.current = roomState.currentLevel;
      engineRefOut.current.loadCase(caseData, true);
      setActiveInteract(null);
      setNearTarget(null);
    }
  }, [roomState.currentLevel, caseData, engineRefOut]);

  // Update role/appearance
  useEffect(() => {
    engineRefOut.current?.setMyRoleAndAppearance(myRole, myAppearance);
  }, [myRole, myAppearance, engineRefOut]);

  // Update graphics settings
  useEffect(() => {
    engineRefOut.current?.updateSettings(settings);
  }, [settings, engineRefOut]);

  // Sync room entities (clues, puzzles, partner, pings)
  useEffect(() => {
    engineRefOut.current?.syncRoomEntities({
      discoveredClueIds: roomState.discoveredClueIds,
      solvedPuzzleIds: roomState.solvedPuzzleIds,
      partner,
      pings: roomState.pings,
      soloPreviewMode: roomState.soloPreviewMode,
    });
  }, [
    roomState.discoveredClueIds,
    roomState.solvedPuzzleIds,
    roomState.pings,
    roomState.soloPreviewMode,
    partner,
    engineRefOut,
  ]);

  // Show toast on partner emote or ping
  const lastPartnerEmoteAt = useRef<number>(0);
  useEffect(() => {
    const emote = partner?.lastEmote;
    if (emote && emote.at > lastPartnerEmoteAt.current) {
      lastPartnerEmoteAt.current = emote.at;
      soundEngine.playEmotePing();
      setToast(`${partner?.name}: ${emote.icon} ${emote.text}`);
      const t = window.setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [partner?.lastEmote, partner?.name]);

  const lastPingAt = useRef<number>(0);
  useEffect(() => {
    const latest = roomState.pings[roomState.pings.length - 1];
    if (latest && latest.at > lastPingAt.current && latest.role !== myRole) {
      lastPingAt.current = latest.at;
      soundEngine.playEmotePing();
      const rm = ROOM_MAP[latest.roomName]?.name || latest.roomName;
      setToast(`${latest.role === 'staines' ? 'Staines' : 'Anika'} pinged the ${rm}!`);
      const t = window.setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [roomState.pings, myRole]);

  // Keyboard shortcuts for HUD panels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyN') {
        setNotebookOpen((v) => !v);
      } else if (e.code === 'KeyM') {
        setPauseTab((t) => (t === 'map' ? null : 'map'));
      } else if (e.code === 'KeyH') {
        setPauseTab((t) => (t === 'hints' ? null : 'hints'));
      } else if (e.code === 'Escape') {
        if (activeInteract) setActiveInteract(null);
        else if (notebookOpen) setNotebookOpen(false);
        else setPauseTab((t) => (t ? null : 'pause'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeInteract, notebookOpen]);

  const currentRoomName =
    ROOM_MAP[myPlayer?.roomId || 'foyer']?.name || 'Grand Foyer';

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomState.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleSubmitAccusation = (draft: AccusationDraft) => {
    const won =
      draft.culpritId === caseData.solution.culpritId &&
      draft.weapon === caseData.solution.weapon &&
      draft.motive === caseData.solution.motive;
    soundEngine.playCaseResult(won);
    onSubmitAccusation(draft, won);
    setNotebookOpen(false);
  };

  const handleDiscoverClue = (clueId: string) => {
    const clue = caseData.clues.find((c) => c.id === clueId);
    if (!clue) return;
    soundEngine.playClueDiscovered();
    const tag = clue.revealsWeapon
      ? 'weapon'
      : clue.revealsMotive
        ? 'motive'
        : clue.eliminatesSuspectId
          ? 'alibi'
          : clue.pointsToSuspectId
            ? 'suspect'
            : 'note';
    onDiscoverClue(clue.id, clue.title, clue.summary, tag);
  };

  // Level 1 tutorial completion checks
  const tutorialDoneMap: Record<string, boolean> = {
    move: hasMoved,
    clue: roomState.discoveredClueIds.length > 0,
    ghost: roomState.questionedSuspectIds.length > 0,
    notebook: roomState.notebook.length > 0 && notebookOpen,
    accuse: Boolean(roomState.caseOutcome?.won),
  };

  const showActiveEmoteForPartner =
    partner?.lastEmote && Date.now() - partner.lastEmote.at < 4500;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0e17]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none-zone" />

      {/* Floating Partner 3D World-to-Screen Label */}
      <div
        ref={partnerLabelRef}
        className="pointer-events-none fixed top-0 left-0 z-20 transition-opacity duration-150"
        style={{ opacity: 0 }}
      >
        <div className="flex flex-col items-center gap-1">
          {showActiveEmoteForPartner && partner?.lastEmote && (
            <div className="px-2.5 py-1 rounded-lg bg-[#121726]/95 border border-[#e2a84b]/60 text-xs font-medium text-[#f7eedb] shadow-lg whitespace-nowrap">
              {partner.lastEmote.icon} {partner.lastEmote.text}
            </div>
          )}
          <div className="px-2.5 py-0.5 rounded bg-[#0b0e17]/85 border border-white/15 text-[11px] font-medium text-[#e5ebf5] whitespace-nowrap">
            {partner?.name || (partnerRole === 'staines' ? 'Staines' : 'Anika')}
          </div>
        </div>
      </div>

      {/* WebGL Context Lost Banner */}
      {contextLost && (
        <div className="fixed inset-0 z-50 bg-[#0b0e17]/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="font-display text-xl text-[#f7eedb]">Restoring 3D Mansion View...</h2>
          <p className="text-sm text-[#94a0b8] mt-2">
            Your WebGL graphics context paused briefly. Progress is safely synced.
          </p>
        </div>
      )}

      {/* TOP HUD BAR (Compact, single-row, unobstructed center) */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-30 p-2.5 sm:p-4 flex items-start justify-between gap-2">
        {/* Top-Left: Case & Room Info */}
        <div className="pointer-events-auto bg-[#0e1320]/90 border border-white/12 rounded-xl px-3.5 py-2 flex items-center gap-3 shadow-lg max-w-[62vw] sm:max-w-none">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-[#a3afc7]">
              <span className="font-mono-num font-semibold text-[#e2a84b]">
                Case {caseData.level}/30
              </span>
              <span>·</span>
              <span className="capitalize">{caseData.difficulty}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline truncate">{currentRoomName}</span>
            </div>
            <div className="font-display text-xs sm:text-sm font-semibold text-[#f7eedb] truncate">
              {caseData.title}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171f33] hover:bg-[#1f2942] border border-white/10 text-xs font-mono-num text-[#d8e0ef] cursor-pointer shrink-0"
            title="Copy room code for your partner"
          >
            <span>{roomState.code}</span>
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#94a0b8]" />
            )}
          </button>
        </div>

        {/* Top-Right: Partner status + Core HUD buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex items-center gap-2 px-3 h-10 rounded-xl bg-[#0e1320]/90 border border-white/12 text-xs text-[#cfd7e6]">
            <span>
              You: <strong className="text-white">{myRole === 'staines' ? 'Staines' : 'Anika'}</strong>
            </span>
            <span>·</span>
            <span>
              {partnerRole === 'staines' ? 'Staines' : 'Anika'}:{' '}
              <span className={partner?.connected ? 'text-emerald-400' : 'text-[#8c98b0]'}>
                {partner?.connected ? 'Joined' : 'Waiting'}
              </span>
            </span>
            {!wsConnected && (
              <>
                <span>·</span>
                <span className="text-amber-300">Reconnecting</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setNotebookOpen(true)}
            className="h-10 px-3 sm:px-3.5 rounded-xl bg-[#e2a84b] hover:bg-[#edb85d] text-[#0b0e17] font-semibold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Notebook</span>
            <span className="font-mono-num">
              {roomState.discoveredClueIds.length}/{caseData.clues.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPauseTab('map')}
            className="h-10 w-10 sm:w-auto sm:px-3 rounded-xl bg-[#0e1320]/90 hover:bg-[#1a2236] border border-white/12 text-[#e5ebf5] text-xs font-medium flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
            title="Mansion Map (M)"
          >
            <MapIcon className="w-4 h-4" />
            <span className="hidden md:inline">Map</span>
          </button>

          <button
            type="button"
            onClick={() => setPauseTab('hints')}
            className="h-10 w-10 rounded-xl bg-[#0e1320]/90 hover:bg-[#1a2236] border border-white/12 text-[#e2a84b] flex items-center justify-center shadow-lg cursor-pointer"
            title="Hints (H)"
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, muted: !settings.muted })}
            className="hidden sm:flex h-10 w-10 rounded-xl bg-[#0e1320]/90 hover:bg-[#1a2236] border border-white/12 text-[#d5deef] items-center justify-center shadow-lg cursor-pointer"
            title="Toggle Mute"
          >
            {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setPauseTab('pause')}
            className="h-10 w-10 rounded-xl bg-[#0e1320]/90 hover:bg-[#1a2236] border border-white/12 text-[#e5ebf5] flex items-center justify-center shadow-lg cursor-pointer"
            title="Pause Menu (Esc)"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Level 1 Compact Interactive Tutorial Card */}
      {caseData.level === 1 && !tutorialHidden && !roomState.caseOutcome?.won && (
        <div className="pointer-events-auto fixed top-20 left-3 sm:left-4 z-20 w-64 sm:w-72 bg-[#0e1320]/92 border border-white/12 rounded-xl p-3.5 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-[#e2a84b]">Case 1 Tutorial</span>
            <button
              type="button"
              onClick={() => setTutorialHidden(true)}
              className="text-[11px] text-[#8f9cb5] hover:text-white cursor-pointer"
            >
              Hide
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {caseData.tutorialSteps.map((step) => {
              const done = tutorialDoneMap[step.id];
              return (
                <div
                  key={step.id}
                  className={`text-xs flex items-start gap-2 ${
                    done ? 'text-emerald-300/80 line-through' : 'text-[#d5deef]'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">{done ? '✓' : '○'}</span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emote / Ping Toast */}
      {toast && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#121726]/95 border border-[#e2a84b]/50 text-xs sm:text-sm font-medium text-[#f7eedb] shadow-xl">
          {toast}
        </div>
      )}

      {/* BOTTOM HUD: Mobile Touch Joystick + Quick Emotes + Contextual Examine Button */}
      <div className="pointer-events-none fixed bottom-0 inset-x-0 z-30 p-3 sm:p-5 flex items-end justify-between gap-3">
        {/* Bottom-Left: Touch Joystick on mobile/touch or compact key guide on desktop */}
        <div className="pointer-events-auto">
          {isTouchDevice ? (
            <TouchJoystick
              onVectorChange={(x, y) => {
                if (engineRefOut.current) {
                  engineRefOut.current.joystickInput = { joyX: x, joyY: y };
                }
              }}
            />
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0e1320]/88 border border-white/10 text-[11px] text-[#9aa6be]">
              <span>WASD Move</span>
              <span>·</span>
              <span>Drag Orbit</span>
              <span>·</span>
              <span>E Examine</span>
              <span>·</span>
              <span>N Notebook</span>
            </div>
          )}
        </div>

        {/* Bottom-Center: Quick Voice-Free Emote Bar */}
        <div className="pointer-events-auto hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0e1320]/90 border border-white/12 shadow-lg">
          {QUICK_EMOTES.map((em) => (
            <button
              key={em.text}
              type="button"
              onClick={() => {
                soundEngine.playEmotePing();
                onSendEmote(em.icon, em.text);
                setToast(`Sent: ${em.icon} ${em.text}`);
                setTimeout(() => setToast(null), 2200);
              }}
              className="h-9 px-2.5 rounded-lg hover:bg-white/10 text-xs text-[#e5ebf5] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{em.icon}</span>
              <span>{em.text}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              soundEngine.playEmotePing();
              onSendPing(myLastPosRef.current, myPlayer?.roomId || 'foyer');
              setToast(`Beacon pinged in ${currentRoomName}`);
              setTimeout(() => setToast(null), 2200);
            }}
            className="h-9 px-3 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 border border-[#38bdf8]/40 text-xs font-medium text-[#bae6fd] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Ping</span>
          </button>
        </div>

        {/* Bottom-Right: Contextual Examine / Speak + Mobile Emote Toggle */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Mobile compact emote row */}
          <div className="flex md:hidden items-center gap-1 bg-[#0e1320]/90 border border-white/12 rounded-xl p-1">
            {QUICK_EMOTES.slice(0, 3).map((em) => (
              <button
                key={em.text}
                type="button"
                onClick={() => {
                  soundEngine.playEmotePing();
                  onSendEmote(em.icon, em.text);
                }}
                className="w-10 h-10 rounded-lg hover:bg-white/10 text-base flex items-center justify-center cursor-pointer"
                title={em.text}
              >
                {em.icon}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                soundEngine.playEmotePing();
                onSendPing(myLastPosRef.current, myPlayer?.roomId || 'foyer');
              }}
              className="w-10 h-10 rounded-lg bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center cursor-pointer"
              title="Ping Location"
            >
              <Radio className="w-4 h-4" />
            </button>
          </div>

          {nearTarget && (
            <button
              type="button"
              onClick={() => engineRefOut.current?.triggerInteractFromUI()}
              className="h-12 sm:h-11 px-5 rounded-xl bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] font-semibold text-sm flex items-center gap-2 shadow-xl cursor-pointer whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              <span>
                {nearTarget.kind === 'suspect'
                  ? `Question ${nearTarget.suspect.name.split(' ')[0]}`
                  : nearTarget.kind === 'puzzle'
                    ? `Inspect ${nearTarget.puzzle.title}`
                    : nearTarget.visibleToMe
                      ? `Examine ${nearTarget.clue.title}`
                      : 'Partner Spectral Trace'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Interaction Modal */}
      {activeInteract && (
        <InteractionModal
          target={activeInteract}
          caseData={caseData}
          roomState={roomState}
          myRole={myRole}
          onClose={() => setActiveInteract(null)}
          onDiscoverClue={handleDiscoverClue}
          onQuestionSuspect={(id) => onQuestionSuspect(id)}
          onSolvePuzzle={(id) => {
            soundEngine.playPuzzleSolved();
            onSolvePuzzle(id);
          }}
          onPingLocation={(pos, rm) => {
            soundEngine.playEmotePing();
            onSendPing(pos, rm);
          }}
        />
      )}

      {/* Shared Notebook Modal */}
      {notebookOpen && (
        <NotebookModal
          caseData={caseData}
          roomState={roomState}
          myRole={myRole}
          onClose={() => setNotebookOpen(false)}
          onAddNote={onAddNote}
          onTogglePin={onTogglePin}
          onVoteAccusation={onVoteAccusation}
          onSubmitAccusation={handleSubmitAccusation}
        />
      )}

      {/* Pause / Map / Hints / 30 Cases / Settings Modal */}
      {pauseTab && (
        <PauseSettingsModal
          initialTab={pauseTab}
          onTabChange={setPauseTab}
          caseData={caseData}
          roomState={roomState}
          myRole={myRole}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onSelectLevel={onSelectLevel}
          onRevealHint={() => onRevealHint(caseData.maxHints)}
          onSwitchRole={onSwitchRole}
          onToggleSoloPreview={onToggleSoloPreview}
          onLeaveRoom={onLeaveRoom}
          onClose={() => setPauseTab(null)}
        />
      )}

      {/* Case Outcome Overlay */}
      {roomState.caseOutcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070910]/85">
          <div className="w-full max-w-lg bg-[#121726] border border-white/15 rounded-xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#e2a84b]">
              <Sparkles className="w-4 h-4" />
              <span>{roomState.caseOutcome.won ? 'Case Solved' : 'False Accusation'}</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-[#f7eedb]">
              {roomState.caseOutcome.won
                ? `Justice for ${caseData.victimName}`
                : 'The True Culprit Slipped Away'}
            </h2>

            {roomState.caseOutcome.won ? (
              <p className="text-sm text-[#d4dce9] leading-relaxed">
                {caseData.solution.explanation}
              </p>
            ) : (
              <p className="text-sm text-rose-200 leading-relaxed">
                Your accusation ({caseData.suspects.find((s) => s.id === roomState.caseOutcome?.accusation.culpritId)?.name} · {roomState.caseOutcome.accusation.weapon} · {roomState.caseOutcome.accusation.motive}) did not match all three facts. Review the Shared Notebook and check your alibi contradictions!
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {roomState.caseOutcome.won ? (
                roomState.currentLevel < 30 ? (
                  <button
                    type="button"
                    onClick={() => onSelectLevel(roomState.currentLevel + 1)}
                    className="h-11 px-5 rounded-lg bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] font-semibold text-sm cursor-pointer"
                  >
                    Continue to Case {roomState.currentLevel + 1}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPauseTab('levels')}
                    className="h-11 px-5 rounded-lg bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] font-semibold text-sm cursor-pointer"
                  >
                    All 30 Cases Completed! Replay Any Case
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectLevel(roomState.currentLevel)}
                  className="h-11 px-5 rounded-lg bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] font-semibold text-sm cursor-pointer"
                >
                  Reset Case &amp; Re-investigate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
