import { useState } from 'react';
import type { InteractTarget } from '../three/mansionScene.ts';
import type { CaseData, Role, RoomSessionState } from '../types/game.ts';
import { EyeOff, KeyRound, Lock, MessageSquare, Sparkles, X } from 'lucide-react';

interface InteractionModalProps {
  target: InteractTarget;
  caseData: CaseData;
  roomState: RoomSessionState;
  myRole: Role;
  onClose: () => void;
  onDiscoverClue: (clueId: string) => void;
  onQuestionSuspect: (suspectId: string) => void;
  onSolvePuzzle: (puzzleId: string) => void;
  onPingLocation: (pos: [number, number, number], roomName: string) => void;
}

export function InteractionModal({
  target,
  caseData,
  roomState,
  myRole,
  onClose,
  onDiscoverClue,
  onQuestionSuspect,
  onSolvePuzzle,
  onPingLocation,
}: InteractionModalProps) {
  const [selectedClueId, setSelectedClueId] = useState<string>('');
  const [puzzleError, setPuzzleError] = useState<string | null>(null);

  if (target.kind === 'clue') {
    const { clue, visibleToMe, lockedReason } = target;
    const alreadyDiscovered = roomState.discoveredClueIds.includes(clue.id);
    const partnerName = myRole === 'staines' ? 'Anika' : 'Staines';

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070910]/75">
        <div className="w-full max-w-lg bg-[#121726] border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#e2a84b] font-medium">
                {clue.category === 'cipher'
                  ? 'Spectral Cipher'
                  : clue.category === 'document'
                    ? 'Manor Document'
                    : clue.category === 'witness'
                      ? 'Witness Record'
                      : 'Physical Evidence'}
                {' · '}
                {clue.visibility === 'both'
                  ? 'Shared Sight'
                  : clue.visibility === 'staines'
                    ? 'Staines Only'
                    : 'Anika Only'}
              </p>
              <h2 className="font-display text-xl font-semibold text-[#f7eedb] mt-1">
                {visibleToMe ? clue.title : 'Spectral Trace'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-white/10 bg-[#1a2135] hover:bg-[#242e47] flex items-center justify-center text-[#d5deef] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!visibleToMe ? (
            <div className="p-4 rounded-lg bg-[#171d2f] border border-white/10 flex flex-col gap-3 text-sm text-[#b9c4d9]">
              <div className="flex items-center gap-2 font-medium text-[#38bdf8]">
                <EyeOff className="w-4 h-4" />
                <span>Attuned to {partnerName}’s Sight</span>
              </div>
              <p>
                Only {partnerName} can clearly perceive and read this clue. Send a beacon ping so they know where to look!
              </p>
              <button
                type="button"
                onClick={() => {
                  onPingLocation(clue.position, clue.roomId);
                  onClose();
                }}
                className="h-10 px-4 rounded-lg bg-[#38bdf8] hover:bg-[#5ecbfa] text-[#0b0e17] font-semibold text-xs cursor-pointer self-start"
              >
                Ping Location for {partnerName}
              </button>
            </div>
          ) : lockedReason ? (
            <div className="p-4 rounded-lg bg-[#171d2f] border border-amber-400/30 flex flex-col gap-2 text-sm text-[#d4dceb]">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <Lock className="w-4 h-4" />
                <span>Sealed Evidence</span>
              </div>
              <p>{lockedReason}</p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-[#0d111d] border border-white/10 text-sm text-[#dde3f0] leading-relaxed">
                {clue.detail}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-[#94a0b8]">
                  {alreadyDiscovered
                    ? 'Logged in your Shared Notebook.'
                    : 'Log this discovery so your partner can read it too.'}
                </span>
                {!alreadyDiscovered ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDiscoverClue(clue.id);
                      onClose();
                    }}
                    className="h-10 px-5 rounded-lg bg-[#e2a84b] hover:bg-[#eeb85f] text-[#0b0e17] font-semibold text-xs sm:text-sm cursor-pointer whitespace-nowrap"
                  >
                    Log to Shared Notebook
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-5 rounded-lg bg-[#1d253b] hover:bg-[#27314d] text-white font-medium text-xs sm:text-sm cursor-pointer"
                  >
                    Done
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (target.kind === 'suspect') {
    const { suspect } = target;
    const discoveredClues = caseData.clues.filter((c) =>
      roomState.discoveredClueIds.includes(c.id),
    );
    const reaction = selectedClueId ? suspect.clueReactions[selectedClueId] : null;

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070910]/75">
        <div className="w-full max-w-lg bg-[#121726] border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#7dd3fc]">{suspect.title}</p>
              <h2 className="font-display text-xl font-semibold text-[#f7eedb] mt-0.5">
                {suspect.name}
              </h2>
              <p className="text-xs text-[#8f9cb5] mt-0.5">
                Demeanor: {suspect.personality}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-white/10 bg-[#1a2135] hover:bg-[#242e47] flex items-center justify-center text-[#d5deef] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-lg bg-[#0d111d] border border-white/10">
            <div className="text-xs font-semibold text-[#e2a84b] mb-1">Stated Alibi</div>
            <p className="text-sm text-[#dde3f0] leading-relaxed">“{suspect.alibi}”</p>
            <p className="text-xs text-[#8f9cb5] mt-2">{suspect.secretFact}</p>
          </div>

          {discoveredClues.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#a3afc7] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask about discovered evidence:</span>
              </label>
              <select
                value={selectedClueId}
                onChange={(e) => setSelectedClueId(e.target.value)}
                className="h-10 px-3 rounded-lg bg-[#181f33] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-[#7dd3fc]"
              >
                <option value="">Select a clue to confront {suspect.name.split(' ')[0]}...</option>
                {discoveredClues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {selectedClueId && (
                <div className="p-3 rounded-lg bg-[#161e31] border border-white/10 text-xs sm:text-sm text-[#cfd8ea]">
                  “{reaction || 'I have nothing further to say on that matter, detective.'}”
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                onQuestionSuspect(suspect.id);
                onClose();
              }}
              className="h-10 px-5 rounded-lg bg-[#7dd3fc] hover:bg-[#9ee0fe] text-[#0b0e17] font-semibold text-xs sm:text-sm cursor-pointer"
            >
              Record Testimony
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Puzzle Mechanism
  const { puzzle, solved } = target;
  const showStainesHalf = myRole === 'staines' || roomState.soloPreviewMode;
  const showAnikaHalf = myRole === 'anika' || roomState.soloPreviewMode;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070910]/75">
      <div className="w-full max-w-lg bg-[#121726] border border-white/15 rounded-xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#38bdf8] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Co-op Mechanism</span>
            </p>
            <h2 className="font-display text-xl font-semibold text-[#f7eedb] mt-0.5">
              {puzzle.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/10 bg-[#1a2135] hover:bg-[#242e47] flex items-center justify-center text-[#d5deef] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-[#cdd6e6]">{puzzle.prompt}</p>

        <div className="flex flex-col gap-2">
          {showStainesHalf && (
            <div className="p-3 rounded-lg bg-[#1a1f2e] border border-[#e2a84b]/35 text-xs sm:text-sm text-[#f5dfb3]">
              {puzzle.hintForStaines}
            </div>
          )}
          {showAnikaHalf && (
            <div className="p-3 rounded-lg bg-[#152232] border border-[#38bdf8]/35 text-xs sm:text-sm text-[#bae6fd]">
              {puzzle.hintForAnika}
            </div>
          )}
          {!roomState.soloPreviewMode && (
            <p className="text-xs text-[#8f9cb5]">
              Combine what Staines sees with what Anika sees to choose the true sequence!
            </p>
          )}
        </div>

        {solved ? (
          <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-400/40 text-sm text-emerald-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>Mechanism unlocked! Hidden evidence in the mansion is now accessible.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {puzzle.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (opt === puzzle.correctCode) {
                    setPuzzleError(null);
                    onSolvePuzzle(puzzle.id);
                  } else {
                    setPuzzleError('The mechanism clicks and resets—check both partners’ inscriptions.');
                  }
                }}
                className="h-11 px-4 rounded-lg border border-white/15 bg-[#182035] hover:border-[#38bdf8] hover:bg-[#1f2944] text-sm font-medium text-white transition-colors cursor-pointer"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {puzzleError && (
          <p className="text-xs text-rose-300">{puzzleError}</p>
        )}
      </div>
    </div>
  );
}
