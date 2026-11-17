import { Server, routePartykitRequest } from 'partyserver';
import type { Connection, WSMessage } from 'partyserver';
import type {
  AccusationDraft,
  CharacterAppearance,
  NotebookEntry,
  PingBeacon,
  Role,
  RoomSessionState,
} from '../src/types/game.ts';

type Env = {
  Main: DurableObjectNamespace<BlackwoodPartyServer>;
};

export class BlackwoodPartyServer extends Server<Env> {
  private connRoles = new Map<string, Role>();

  private async getState(startLevel = 1): Promise<RoomSessionState> {
    const existing = await this.ctx.storage.get<RoomSessionState>('state');
    if (existing) return existing;
    const fresh: RoomSessionState = {
      code: this.name.toUpperCase(),
      currentLevel: startLevel,
      unlockedLevel: startLevel,
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
    await this.ctx.storage.put('state', fresh);
    return fresh;
  }

  private async saveAndBroadcast(state: RoomSessionState, excludeId?: string) {
    state.updatedAt = Date.now();
    await this.ctx.storage.put('state', state);
    this.broadcast(JSON.stringify({ type: 'room:sync', state }), excludeId ? [excludeId] : undefined);
  }

  async onMessage(sender: Connection, rawMessage: WSMessage) {
    if (typeof rawMessage !== 'string') return;
    const message = rawMessage;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    const type = String(msg.type || '');

    if (type === 'room:create' || type === 'room:join') {
      const requestedRole: Role = msg.role === 'anika' ? 'anika' : 'staines';
      const appearance = msg.appearance as CharacterAppearance;
      const state = await this.getState(Math.max(1, Math.min(30, Number(msg.startLevel) || 1)));

      let assignedRole: Role = requestedRole;
      const otherRole: Role = requestedRole === 'staines' ? 'anika' : 'staines';
      if (
        type === 'room:join' &&
        state.players[requestedRole]?.connected &&
        !state.players[otherRole]?.connected
      ) {
        assignedRole = otherRole;
      }

      this.connRoles.set(sender.id, assignedRole);
      const existingPlayer = state.players[assignedRole];
      const spawnX = assignedRole === 'staines' ? -1.4 : 1.4;
      state.players[assignedRole] = {
        role: assignedRole,
        name: assignedRole === 'staines' ? 'Staines' : 'Anika',
        connected: true,
        appearance: appearance || existingPlayer?.appearance,
        position: existingPlayer?.position || [spawnX, 0, 12.2],
        rotationY: existingPlayer?.rotationY ?? Math.PI,
        moving: false,
        roomId: existingPlayer?.roomId || 'foyer',
        lastEmote: existingPlayer?.lastEmote,
      };
      state.updatedAt = Date.now();
      await this.ctx.storage.put('state', state);
      sender.send(JSON.stringify({ type: 'room:joined', role: assignedRole, state }));
      this.broadcast(JSON.stringify({ type: 'room:sync', state }), [sender.id]);
      return;
    }

    const role = this.connRoles.get(sender.id);
    if (!role) return;
    const state = await this.getState();

    if (type === 'player:move') {
      const player = state.players[role];
      if (!player) return;
      const pos = msg.position as [number, number, number];
      if (Array.isArray(pos) && pos.length === 3) {
        player.position = [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0];
        player.rotationY = Number(msg.rotationY) || 0;
        player.moving = Boolean(msg.moving);
        player.roomId = String(msg.roomId || player.roomId);
        this.broadcast(
          JSON.stringify({
            type: 'player:moved',
            role,
            position: player.position,
            rotationY: player.rotationY,
            moving: player.moving,
            roomId: player.roomId,
          }),
          [sender.id],
        );
      }
      return;
    }

    if (type === 'player:appearance') {
      if (!state.players[role]) return;
      state.players[role]!.appearance = msg.appearance as CharacterAppearance;
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'player:switchRole') {
      const nextRole: Role = msg.role === 'anika' ? 'anika' : 'staines';
      if (nextRole === role) return;
      if (state.players[nextRole]?.connected) {
        sender.send(
          JSON.stringify({
            type: 'room:error',
            message: `${nextRole === 'staines' ? 'Staines' : 'Anika'} is currently controlled by your partner.`,
          }),
        );
        return;
      }
      if (state.players[role]) state.players[role]!.connected = false;
      const targetExisting = state.players[nextRole];
      const spawnX = nextRole === 'staines' ? -1.4 : 1.4;
      state.players[nextRole] = {
        role: nextRole,
        name: nextRole === 'staines' ? 'Staines' : 'Anika',
        connected: true,
        appearance: (msg.appearance as CharacterAppearance) || targetExisting?.appearance || state.players[role]!.appearance,
        position: targetExisting?.position || [spawnX, 0, 12.2],
        rotationY: targetExisting?.rotationY ?? Math.PI,
        moving: false,
        roomId: targetExisting?.roomId || 'foyer',
      };
      this.connRoles.set(sender.id, nextRole);
      state.updatedAt = Date.now();
      await this.ctx.storage.put('state', state);
      sender.send(JSON.stringify({ type: 'room:joined', role: nextRole, state }));
      this.broadcast(JSON.stringify({ type: 'room:sync', state }), [sender.id]);
      return;
    }

    if (type === 'clue:discover') {
      const clueId = String(msg.clueId || '');
      if (clueId && !state.discoveredClueIds.includes(clueId)) {
        state.discoveredClueIds.push(clueId);
        state.clueFoundBy[clueId] = role;
        if (msg.autoNote) {
          const note = msg.autoNote as Omit<NotebookEntry, 'id' | 'createdAt' | 'authorRole'>;
          if (!state.notebook.some((n) => n.clueId === clueId)) {
            state.notebook.unshift({
              id: `note_${clueId}_${Date.now()}`,
              authorRole: role,
              clueId,
              title: note.title,
              text: note.text,
              pinned: false,
              tag: note.tag || 'note',
              createdAt: Date.now(),
            });
          }
        }
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'suspect:question') {
      const suspectId = String(msg.suspectId || '');
      if (suspectId && !state.questionedSuspectIds.includes(suspectId)) {
        state.questionedSuspectIds.push(suspectId);
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'puzzle:solve') {
      const puzzleId = String(msg.puzzleId || '');
      if (puzzleId && !state.solvedPuzzleIds.includes(puzzleId)) {
        state.solvedPuzzleIds.push(puzzleId);
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'notebook:add') {
      const text = String(msg.text || '').slice(0, 320);
      if (text.trim()) {
        state.notebook.unshift({
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          authorRole: role,
          title: String(msg.title || 'Detective Note').slice(0, 80),
          text,
          pinned: Boolean(msg.pinned),
          tag: (msg.tag as NotebookEntry['tag']) || 'note',
          createdAt: Date.now(),
        });
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'notebook:togglePin') {
      const found = state.notebook.find((n) => n.id === String(msg.entryId || ''));
      if (found) {
        found.pinned = !found.pinned;
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'emote:send') {
      if (!state.players[role]) return;
      state.players[role]!.lastEmote = {
        id: `${Date.now()}`,
        text: String(msg.text || ''),
        icon: String(msg.icon || ''),
        at: Date.now(),
      };
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'ping:send') {
      const pos = msg.position as [number, number, number];
      const ping: PingBeacon = {
        id: `ping_${Date.now()}`,
        role,
        position: Array.isArray(pos) ? pos : [0, 0, 10],
        roomName: String(msg.roomName || 'Mansion'),
        at: Date.now(),
      };
      state.pings = [...state.pings.slice(-3), ping];
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'hint:reveal') {
      const maxHints = Number(msg.maxHints) || 4;
      if (state.hintsRevealed < maxHints) {
        state.hintsRevealed += 1;
        await this.saveAndBroadcast(state);
      }
      return;
    }

    if (type === 'accusation:vote') {
      state.accusationVotes[role] = msg.draft as AccusationDraft;
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'accusation:submit') {
      const draft = msg.draft as AccusationDraft;
      const won = Boolean(msg.won);
      state.caseOutcome = {
        won,
        submittedBy: role,
        accusation: draft,
        at: Date.now(),
      };
      if (won) {
        if (!state.solvedLevels.includes(state.currentLevel)) {
          state.solvedLevels.push(state.currentLevel);
        }
        if (state.currentLevel >= state.unlockedLevel && state.currentLevel < 30) {
          state.unlockedLevel = state.currentLevel + 1;
        }
      }
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'level:select') {
      const nextLevel = Math.max(1, Math.min(30, Number(msg.level) || 1));
      state.currentLevel = nextLevel;
      state.discoveredClueIds = [];
      state.clueFoundBy = {};
      state.questionedSuspectIds = [];
      state.solvedPuzzleIds = [];
      state.notebook = [];
      state.pings = [];
      state.hintsRevealed = 0;
      state.accusationVotes = {};
      state.caseOutcome = null;
      if (state.players.staines) {
        state.players.staines.position = [-1.4, 0, 12.2];
        state.players.staines.roomId = 'foyer';
      }
      if (state.players.anika) {
        state.players.anika.position = [1.4, 0, 12.2];
        state.players.anika.roomId = 'foyer';
      }
      await this.saveAndBroadcast(state);
      return;
    }

    if (type === 'room:soloPreview') {
      state.soloPreviewMode = Boolean(msg.enabled);
      await this.saveAndBroadcast(state);
    }
  }

  async onClose(connection: Connection) {
    const role = this.connRoles.get(connection.id);
    if (!role) return;
    this.connRoles.delete(connection.id);
    const state = await this.ctx.storage.get<RoomSessionState>('state');
    if (state && state.players[role]) {
      state.players[role]!.connected = false;
      await this.saveAndBroadcast(state);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response('Blackwood Manor multiplayer server is running.');
    }
    const routed = await routePartykitRequest(request, env);
    return routed || new Response('Not found', { status: 404 });
  },
};
