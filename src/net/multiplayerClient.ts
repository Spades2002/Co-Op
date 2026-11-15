import type {
  AccusationDraft,
  CharacterAppearance,
  NotebookEntry,
  Role,
  RoomSessionState,
} from '../types/game.ts';

type Listener = {
  onJoined?: (role: Role, state: RoomSessionState) => void;
  onSync?: (state: RoomSessionState) => void;
  onPartnerMoved?: (payload: {
    role: Role;
    position: [number, number, number];
    rotationY: number;
    moving: boolean;
    roomId: string;
  }) => void;
  onError?: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
};

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private listeners: Listener = {};
  private pendingMessages: string[] = [];
  private reconnectTimer: number | null = null;
  private lastJoinPayload: {
    mode: 'create' | 'join';
    code?: string;
    role: Role;
    appearance: CharacterAppearance;
    startLevel?: number;
  } | null = null;
  private intentionalClose = false;

  public setListeners(listeners: Listener) {
    this.listeners = listeners;
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private getWsUrl(roomCode?: string): string {
    const partyHost = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PARTYKIT_HOST;
    if (partyHost) {
      const cleanHost = partyHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const proto = cleanHost.startsWith('localhost') || cleanHost.startsWith('127.') ? 'ws:' : 'wss:';
      return `${proto}//${cleanHost}/party/${roomCode || 'lobby'}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  public connectAndJoin(params: {
    mode: 'create' | 'join';
    code?: string;
    role: Role;
    appearance: CharacterAppearance;
    startLevel?: number;
  }) {
    this.intentionalClose = false;
    const resolvedCode =
      params.mode === 'create'
        ? params.code || this.generateShortCode()
        : (params.code || '').toUpperCase().trim();
    const nextParams = { ...params, code: resolvedCode };
    this.lastJoinPayload = nextParams;
    this.openSocket(nextParams);
  }

  private openSocket(params: {
    mode: 'create' | 'join';
    code?: string;
    role: Role;
    appearance: CharacterAppearance;
    startLevel?: number;
  }) {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    let didOpen = false;
    const url = this.getWsUrl(params.code);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      didOpen = true;
      this.listeners.onConnectionChange?.(true);
      const joinMsg = {
        type: params.mode === 'create' ? 'room:create' : 'room:join',
        code: params.code,
        role: params.role,
        appearance: params.appearance,
        startLevel: params.startLevel || 1,
      };
      ws.send(JSON.stringify(joinMsg));

      while (this.pendingMessages.length > 0) {
        const queued = this.pendingMessages.shift();
        if (queued) ws.send(queued);
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'room:joined') {
          if (this.lastJoinPayload) {
            this.lastJoinPayload = {
              ...this.lastJoinPayload,
              mode: 'join',
              code: msg.state.code,
              role: msg.role,
            };
          }
          this.listeners.onJoined?.(msg.role, msg.state);
        } else if (msg.type === 'room:sync') {
          this.listeners.onSync?.(msg.state);
        } else if (msg.type === 'player:moved') {
          this.listeners.onPartnerMoved?.(msg);
        } else if (msg.type === 'room:error') {
          this.listeners.onError?.(msg.message);
        }
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.listeners.onConnectionChange?.(false);
      if (!didOpen && !this.intentionalClose) {
        const hasParty = Boolean(
          (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PARTYKIT_HOST,
        );
        this.listeners.onError?.(
          hasParty
            ? 'Could not reach the PartyKit multiplayer server. Check VITE_PARTYKIT_HOST.'
            : 'WebSocket server unavailable. Run with `npm start` or configure VITE_PARTYKIT_HOST for Vercel.',
        );
        return;
      }
      if (!this.intentionalClose && this.lastJoinPayload) {
        if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = window.setTimeout(() => {
          if (this.lastJoinPayload && !this.intentionalClose) {
            this.openSocket(this.lastJoinPayload);
          }
        }, 1800);
      }
    };

    ws.onerror = () => {
      // handled by onclose
    };
  }

  public disconnect() {
    this.intentionalClose = true;
    this.lastJoinPayload = null;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.onConnectionChange?.(false);
  }

  private send(payload: Record<string, unknown>, queueIfClosed = true) {
    const raw = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else if (queueIfClosed) {
      this.pendingMessages.push(raw);
    }
  }

  public sendMove(position: [number, number, number], rotationY: number, moving: boolean, roomId: string) {
    // Never queue stale movement packets while offline
    this.send({ type: 'player:move', position, rotationY, moving, roomId }, false);
  }

  public updateAppearance(appearance: CharacterAppearance) {
    this.send({ type: 'player:appearance', appearance });
  }

  public switchRole(role: Role, appearance: CharacterAppearance) {
    this.send({ type: 'player:switchRole', role, appearance });
  }

  public discoverClue(
    clueId: string,
    autoNote?: Omit<NotebookEntry, 'id' | 'createdAt' | 'authorRole'>,
  ) {
    this.send({ type: 'clue:discover', clueId, autoNote });
  }

  public questionSuspect(suspectId: string) {
    this.send({ type: 'suspect:question', suspectId });
  }

  public solvePuzzle(puzzleId: string) {
    this.send({ type: 'puzzle:solve', puzzleId });
  }

  public addNote(title: string, text: string, tag: NotebookEntry['tag'] = 'note') {
    this.send({ type: 'notebook:add', title, text, tag });
  }

  public togglePin(entryId: string) {
    this.send({ type: 'notebook:togglePin', entryId });
  }

  public sendEmote(icon: string, text: string) {
    this.send({ type: 'emote:send', icon, text });
  }

  public sendPing(position: [number, number, number], roomName: string) {
    this.send({ type: 'ping:send', position, roomName });
  }

  public revealHint(maxHints: number) {
    this.send({ type: 'hint:reveal', maxHints });
  }

  public voteAccusation(draft: AccusationDraft) {
    this.send({ type: 'accusation:vote', draft });
  }

  public submitAccusation(draft: AccusationDraft, won: boolean) {
    this.send({ type: 'accusation:submit', draft, won });
  }

  public selectLevel(level: number) {
    this.send({ type: 'level:select', level });
  }

  public setSoloPreview(enabled: boolean) {
    this.send({ type: 'room:soloPreview', enabled });
  }
}

export const multiplayerClient = new MultiplayerClient();
