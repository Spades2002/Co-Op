/**
 * Optional PartyKit companion server for static Vercel deployments.
 * Mirrors the exact Blackwood Manor WebSocket message protocol.
 * Deploy via `npx partykit deploy partykit/server.ts` and set VITE_PARTYKIT_HOST.
 */

export default class BlackwoodPartyServer {
  // Minimal structural reference when deploying with PartyKit CLI
  room: { id: string; storage: { get: (k: string) => Promise<unknown>; put: (k: string, v: unknown) => Promise<void> }; broadcast: (msg: string, without?: string[]) => void };

  constructor(room: BlackwoodPartyServer['room']) {
    this.room = room;
  }

  async onMessage(message: string, sender: { id: string; send: (msg: string) => void }) {
    const parsed = JSON.parse(message);
    const stored = (await this.room.storage.get('state')) as Record<string, unknown> | undefined;
    if (!stored && parsed.type === 'room:create') {
      const initial = {
        code: this.room.id,
        currentLevel: parsed.startLevel || 1,
        unlockedLevel: parsed.startLevel || 1,
        solvedLevels: [],
        players: {},
        discoveredClueIds: [],
        clueFoundBy: {},
        questionedSuspectIds: [],
        solvedPuzzleIds: [],
        notebook: [],
        pings: [],
        hintsRevealed: 0,
        accusationVotes: {},
        caseOutcome: null,
        soloPreviewMode: false,
        updatedAt: Date.now(),
      };
      await this.room.storage.put('state', initial);
      sender.send(JSON.stringify({ type: 'room:joined', role: parsed.role || 'staines', state: initial }));
      return;
    }
    this.room.broadcast(message, [sender.id]);
  }
}
