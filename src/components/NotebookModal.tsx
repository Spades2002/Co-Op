import { useState } from 'react';
import { MOTIVES, WEAPONS } from '../data/caseGenerator.ts';
import type {
  AccusationDraft,
  CaseData,
  Role,
  RoomSessionState,
} from '../types/game.ts';
import { Check, Gavel, Pin, Send, UserCheck, X } from 'lucide-react';

interface NotebookModalProps {
  caseData: CaseData;
  roomState: RoomSessionState;
  myRole: Role;
  onClose: () => void;
  onAddNote: (title: string, text: string, tag: 'suspect' | 'weapon' | 'motive' | 'alibi' | 'note') => void;
  onTogglePin: (entryId: string) => void;
  onVoteAccusation: (draft: AccusationDraft) => void;
  onSubmitAccusation: (draft: AccusationDraft) => void;
}

export function NotebookModal({
  caseData,
  roomState,
  myRole,
  onClose,
  onAddNote,
  onTogglePin,
  onVoteAccusation,
  onSubmitAccusation,
}: NotebookModalProps) {
  const [tab, setTab] = useState<'clues' | 'suspects' | 'accuse'>('clues');
  const [noteText, setNoteText] = useState('');
  const [noteTag, setNoteTag] = useState<'suspect' | 'weapon' | 'motive' | 'alibi' | 'note'>('note');

  const myVote = roomState.accusationVotes[myRole] || {
    culpritId: caseData.suspects[0]?.id || '',
    weapon: WEAPONS[0].name,
    motive: MOTIVES[0].name,
  };
  const partnerRole: Role = myRole === 'staines' ? 'anika' : 'staines';
  const partnerVote = roomState.accusationVotes[partnerRole];
  const partnerConnected = Boolean(roomState.players[partnerRole]?.connected);

  const [draft, setDraft] = useState<AccusationDraft>(myVote);

  const updateDraft = (patch: Partial<AccusationDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onVoteAccusation(next);
  };

  const votesMatch =
    !partnerConnected ||
    (partnerVote &&
      partnerVote.culpritId === draft.culpritId &&
      partnerVote.weapon === draft.weapon &&
      partnerVote.motive === draft.motive);

  const discoveredClues = caseData.clues.filter((c) =>
    roomState.discoveredClueIds.includes(c.id),
  );

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onAddNote(
      `${myRole === 'staines' ? 'Staines' : 'Anika'}’s Note`,
      noteText.trim(),
      noteTag,
    );
    setNoteText('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#070910]/80">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#121726] border border-white/15 rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-[#f7eedb]">
              Shared Detective Notebook
            </h2>
            <p className="text-xs text-[#94a0b8]">
              {caseData.title} · Victim: {caseData.victimName} · {discoveredClues.length}/{caseData.clues.length} Clues Found
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-lg border border-white/10 bg-[#1a2135] hover:bg-[#232c45] flex items-center justify-center text-[#d4dced] cursor-pointer"
            aria-label="Close notebook"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-2 border-b border-white/10 bg-[#0e1320]">
          {(
            [
              { id: 'clues', label: `Shared Evidence (${roomState.notebook.length})` },
              { id: 'suspects', label: `Suspects (${caseData.suspects.length})` },
              { id: 'accuse', label: 'Final Accusation' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                tab === t.id
                  ? 'bg-[#e2a84b] text-[#0b0e17]'
                  : 'text-[#a3afc7] hover:text-white hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto manor-scroll p-5">
          {tab === 'clues' && (
            <div className="flex flex-col gap-5">
              {/* Quick Note Composer for voice-free co-op */}
              <form
                onSubmit={handleSendNote}
                className="p-3.5 rounded-lg bg-[#0d111d] border border-white/10 flex flex-col sm:flex-row gap-2.5"
              >
                <select
                  value={noteTag}
                  onChange={(e) => setNoteTag(e.target.value as typeof noteTag)}
                  className="h-10 px-3 rounded-lg bg-[#181f33] border border-white/10 text-xs text-[#e5ebf5] focus:outline-none"
                >
                  <option value="note">Observation</option>
                  <option value="suspect">Suspect</option>
                  <option value="alibi">Alibi</option>
                  <option value="weapon">Weapon</option>
                  <option value="motive">Motive</option>
                </select>
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Share a clue description or theory with your partner..."
                  className="flex-1 h-10 px-3 rounded-lg bg-[#181f33] border border-white/10 text-sm text-white placeholder:text-[#69758f] focus:outline-none focus:border-[#e2a84b]"
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg bg-[#e2a84b] hover:bg-[#eab65c] text-[#0b0e17] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Note</span>
                </button>
              </form>

              {roomState.notebook.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#8a97b0]">
                  No clues or notes logged yet. Explore the rooms and examine shimmering objects—clues you discover appear here for both of you.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[...roomState.notebook]
                    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          entry.pinned
                            ? 'bg-[#1a2236] border-[#e2a84b]/60'
                            : 'bg-[#161c2e] border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[#f7eedb] truncate">
                              {entry.title}
                            </h3>
                            <p className="text-[11px] text-[#8f9cb5] mt-0.5">
                              {entry.authorRole === 'staines' ? 'Logged by Staines' : 'Logged by Anika'}
                              {entry.tag ? ` · ${entry.tag}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onTogglePin(entry.id)}
                            className={`w-8 h-8 rounded-md flex items-center justify-center border cursor-pointer shrink-0 ${
                              entry.pinned
                                ? 'border-[#e2a84b] bg-[#e2a84b]/20 text-[#e2a84b]'
                                : 'border-white/10 text-[#8894ad] hover:text-white'
                            }`}
                            title={entry.pinned ? 'Unpin note' : 'Pin key evidence'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs sm:text-sm text-[#cfd7e6] mt-2 leading-relaxed">
                          {entry.text}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {tab === 'suspects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {caseData.suspects.map((s) => {
                const questioned = roomState.questionedSuspectIds.includes(s.id);
                const cleared = discoveredClues.some((c) => c.eliminatesSuspectId === s.id);
                const implicated = discoveredClues.some((c) => c.pointsToSuspectId === s.id);

                return (
                  <div
                    key={s.id}
                    className="p-4 rounded-lg bg-[#161c2e] border border-white/10 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base font-semibold text-[#f7eedb]">
                          {s.name}
                        </h3>
                        <p className="text-xs text-[#8f9cb5]">
                          {s.title} · {questioned ? 'Questioned' : 'Not yet questioned'}
                        </p>
                      </div>
                      {cleared && (
                        <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          Alibi Verified
                        </span>
                      )}
                      {!cleared && implicated && (
                        <span className="text-xs font-medium text-amber-400">
                          Suspicious Lead
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#c5cede] leading-relaxed">
                      {questioned
                        ? `"${s.alibi}"`
                        : 'Speak with this ghost in the mansion to record their alibi.'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'accuse' && (
            <div className="flex flex-col gap-5 max-w-2xl mx-auto">
              <div className="p-4 rounded-lg bg-[#161c2e] border border-white/10 text-xs sm:text-sm text-[#c9d2e3] leading-relaxed">
                Choose the culprit, murder weapon, and motive. When both partners are connected, sync your votes below so you agree before locking in the accusation.
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                    1. Who is the Culprit?
                  </label>
                  <select
                    value={draft.culpritId}
                    onChange={(e) => updateDraft({ culpritId: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg bg-[#0d111d] border border-white/15 text-sm text-white focus:outline-none focus:border-[#e2a84b]"
                  >
                    {caseData.suspects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                    2. What Weapon Was Used?
                  </label>
                  <select
                    value={draft.weapon}
                    onChange={(e) => updateDraft({ weapon: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg bg-[#0d111d] border border-white/15 text-sm text-white focus:outline-none focus:border-[#e2a84b]"
                  >
                    {WEAPONS.map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#a3afc7] mb-1.5">
                    3. What Was the Motive?
                  </label>
                  <select
                    value={draft.motive}
                    onChange={(e) => updateDraft({ motive: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg bg-[#0d111d] border border-white/15 text-sm text-white focus:outline-none focus:border-[#e2a84b]"
                  >
                    {MOTIVES.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {partnerConnected && (
                <div className="p-3.5 rounded-lg bg-[#0d111d] border border-white/10 text-xs">
                  <div className="font-semibold text-[#e5ebf5] mb-1">
                    {partnerRole === 'staines' ? 'Staines' : 'Anika'}’s Current Selection
                  </div>
                  {partnerVote ? (
                    <div className="text-[#9eb0cc] flex items-center justify-between gap-2">
                      <span>
                        {caseData.suspects.find((s) => s.id === partnerVote.culpritId)?.name || '—'} ·{' '}
                        {partnerVote.weapon} · {partnerVote.motive}
                      </span>
                      {votesMatch && (
                        <span className="text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          Agreed
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#78859e]">Partner has not selected an accusation yet.</span>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={partnerConnected && !votesMatch}
                onClick={() => onSubmitAccusation(draft)}
                className="h-12 px-6 rounded-lg bg-[#e2a84b] hover:bg-[#edb960] text-[#0b0e17] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Gavel className="w-4 h-4" />
                <span>
                  {partnerConnected && !votesMatch
                    ? 'Align Both Votes to Submit Accusation'
                    : 'Submit Final Accusation'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
