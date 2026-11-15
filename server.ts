import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AccusationDraft,
  CharacterAppearance,
  NotebookEntry,
  PingBeacon,
  Role,
  RoomSessionState,
} from './src/types/game.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const rooms = new Map<string, RoomSessionState>();
const roomSockets = new Map<string, Set<WebSocket>>();
const socketMeta = new WeakMap<WebSocket, { roomCode: string; role: Role }>();

function loadPersistedRooms() {
  try {
    if (!fs.existsSync(ROOMS_FILE)) return;
    const raw = fs.readFileSync(ROOMS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, RoomSessionState>;
    for (const [code, room] of Object.entries(parsed)) {
      if (room.players.staines) room.players.staines.connected = false;
      if (room.players.anika) room.players.anika.connected = false;
      rooms.set(code, room);
    }
  } catch {
    // ignore corrupt disk file on boot
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const obj: Record<string, RoomSessionState> = {};
      for (const [k, v] of rooms.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // ignore disk write issues
    }
  }, 400);
}

loadPersistedRooms();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createEmptyRoom(code: string, startLevel = 1): RoomSessionState {
  return {
    code,
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
}

function broadcastRoom(code: string, payload: unknown, exclude?: WebSocket) {
  const set = roomSockets.get(code);
  if (!set) return;
  const serialized = JSON.stringify(payload);
  for (const client of set) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({
      code: room.code,
      currentLevel: room.currentLevel,
      unlockedLevel: room.unlockedLevel,
      stainesConnected: Boolean(room.players.staines?.connected),
      anikaConnected: Boolean(room.players.anika?.connected),
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:create' || type === 'room:join') {
        const requestedRole = msg.role === 'anika' ? 'anika' : 'staines';
        const appearance = msg.appearance as CharacterAppearance;
        const requestedCode = String(msg.code || '').toUpperCase().trim();
        let code =
          type === 'room:create'
            ? requestedCode && !rooms.has(requestedCode)
              ? requestedCode
              : generateRoomCode()
            : requestedCode;

        if (type === 'room:join' && !rooms.has(code)) {
          ws.send(JSON.stringify({ type: 'room:error', message: `No mansion room found with code "${code}".` }));
          return;
        }

        let room = rooms.get(code);
        if (!room) {
          const requestedLevel = Number(msg.startLevel) || 1;
          room = createEmptyRoom(code, Math.max(1, Math.min(30, requestedLevel)));
          rooms.set(code, room);
        }

        // If joining and requested role is currently active on another socket, assign the open role
        let assignedRole: Role = requestedRole;
        const otherRole: Role = requestedRole === 'staines' ? 'anika' : 'staines';
        if (
          type === 'room:join' &&
          room.players[requestedRole]?.connected &&
          !room.players[otherRole]?.connected
        ) {
          assignedRole = otherRole;
        }

        // Detach from any previous room
        const prevMeta = socketMeta.get(ws);
        if (prevMeta) {
          roomSockets.get(prevMeta.roomCode)?.delete(ws);
        }

        if (!roomSockets.has(code)) {
          roomSockets.set(code, new Set());
        }
        roomSockets.get(code)!.add(ws);
        socketMeta.set(ws, { roomCode: code, role: assignedRole });

        const existingPlayer = room.players[assignedRole];
        const spawnX = assignedRole === 'staines' ? -1.4 : 1.4;
        room.players[assignedRole] = {
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
        room.updatedAt = Date.now();
        schedulePersist();

        ws.send(JSON.stringify({ type: 'room:joined', role: assignedRole, state: room }));
        broadcastRoom(code, { type: 'room:sync', state: room }, ws);
        return;
      }

      const meta = socketMeta.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;

      if (type === 'player:move') {
        const player = room.players[meta.role];
        if (!player) return;
        const pos = msg.position as [number, number, number];
        if (Array.isArray(pos) && pos.length === 3) {
          player.position = [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0];
          player.rotationY = Number(msg.rotationY) || 0;
          player.moving = Boolean(msg.moving);
          player.roomId = String(msg.roomId || player.roomId);
          broadcastRoom(
            room.code,
            {
              type: 'player:moved',
              role: meta.role,
              position: player.position,
              rotationY: player.rotationY,
              moving: player.moving,
              roomId: player.roomId,
            },
            ws,
          );
        }
        return;
      }

      if (type === 'player:appearance') {
        const player = room.players[meta.role];
        if (!player) return;
        player.appearance = msg.appearance as CharacterAppearance;
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'player:switchRole') {
        const nextRole: Role = msg.role === 'anika' ? 'anika' : 'staines';
        if (nextRole === meta.role) return;
        if (room.players[nextRole]?.connected) {
          ws.send(JSON.stringify({ type: 'room:error', message: `${nextRole === 'staines' ? 'Staines' : 'Anika'} is currently controlled by your partner.` }));
          return;
        }
        const prevPlayer = room.players[meta.role];
        if (prevPlayer) prevPlayer.connected = false;

        const targetExisting = room.players[nextRole];
        const spawnX = nextRole === 'staines' ? -1.4 : 1.4;
        room.players[nextRole] = {
          role: nextRole,
          name: nextRole === 'staines' ? 'Staines' : 'Anika',
          connected: true,
          appearance: (msg.appearance as CharacterAppearance) || targetExisting?.appearance || prevPlayer!.appearance,
          position: targetExisting?.position || [spawnX, 0, 12.2],
          rotationY: targetExisting?.rotationY ?? Math.PI,
          moving: false,
          roomId: targetExisting?.roomId || 'foyer',
        };
        socketMeta.set(ws, { roomCode: room.code, role: nextRole });
        room.updatedAt = Date.now();
        schedulePersist();
        ws.send(JSON.stringify({ type: 'room:joined', role: nextRole, state: room }));
        broadcastRoom(room.code, { type: 'room:sync', state: room }, ws);
        return;
      }

      if (type === 'clue:discover') {
        const clueId = String(msg.clueId || '');
        if (clueId && !room.discoveredClueIds.includes(clueId)) {
          room.discoveredClueIds.push(clueId);
          room.clueFoundBy[clueId] = meta.role;
          if (msg.autoNote) {
            const note = msg.autoNote as Omit<NotebookEntry, 'id' | 'createdAt' | 'authorRole'>;
            if (!room.notebook.some((n) => n.clueId === clueId)) {
              room.notebook.unshift({
                id: `note_${clueId}_${Date.now()}`,
                authorRole: meta.role,
                clueId,
                title: note.title,
                text: note.text,
                pinned: false,
                tag: note.tag || 'note',
                createdAt: Date.now(),
              });
            }
          }
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'suspect:question') {
        const suspectId = String(msg.suspectId || '');
        if (suspectId && !room.questionedSuspectIds.includes(suspectId)) {
          room.questionedSuspectIds.push(suspectId);
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'puzzle:solve') {
        const puzzleId = String(msg.puzzleId || '');
        if (puzzleId && !room.solvedPuzzleIds.includes(puzzleId)) {
          room.solvedPuzzleIds.push(puzzleId);
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'notebook:add') {
        const entry: NotebookEntry = {
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          authorRole: meta.role,
          title: String(msg.title || 'Detective Note').slice(0, 80),
          text: String(msg.text || '').slice(0, 320),
          pinned: Boolean(msg.pinned),
          tag: (msg.tag as NotebookEntry['tag']) || 'note',
          createdAt: Date.now(),
        };
        if (entry.text.trim()) {
          room.notebook.unshift(entry);
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'notebook:togglePin') {
        const entryId = String(msg.entryId || '');
        const found = room.notebook.find((n) => n.id === entryId);
        if (found) {
          found.pinned = !found.pinned;
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'emote:send') {
        const player = room.players[meta.role];
        if (!player) return;
        player.lastEmote = {
          id: `${Date.now()}`,
          text: String(msg.text || ''),
          icon: String(msg.icon || ''),
          at: Date.now(),
        };
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'ping:send') {
        const pos = msg.position as [number, number, number];
        const ping: PingBeacon = {
          id: `ping_${Date.now()}`,
          role: meta.role,
          position: Array.isArray(pos) ? pos : [0, 0, 10],
          roomName: String(msg.roomName || 'Mansion'),
          at: Date.now(),
        };
        room.pings = [...room.pings.slice(-3), ping];
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'hint:reveal') {
        const maxHints = Number(msg.maxHints) || 4;
        if (room.hintsRevealed < maxHints) {
          room.hintsRevealed += 1;
          room.updatedAt = Date.now();
          schedulePersist();
          broadcastRoom(room.code, { type: 'room:sync', state: room });
        }
        return;
      }

      if (type === 'accusation:vote') {
        const draft = msg.draft as AccusationDraft;
        room.accusationVotes[meta.role] = draft;
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'accusation:submit') {
        const draft = msg.draft as AccusationDraft;
        const won = Boolean(msg.won);
        room.caseOutcome = {
          won,
          submittedBy: meta.role,
          accusation: draft,
          at: Date.now(),
        };
        if (won) {
          if (!room.solvedLevels.includes(room.currentLevel)) {
            room.solvedLevels.push(room.currentLevel);
          }
          if (room.currentLevel >= room.unlockedLevel && room.currentLevel < 30) {
            room.unlockedLevel = room.currentLevel + 1;
          }
        }
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'level:select') {
        const nextLevel = Math.max(1, Math.min(30, Number(msg.level) || 1));
        room.currentLevel = nextLevel;
        room.discoveredClueIds = [];
        room.clueFoundBy = {};
        room.questionedSuspectIds = [];
        room.solvedPuzzleIds = [];
        room.notebook = [];
        room.pings = [];
        room.hintsRevealed = 0;
        room.accusationVotes = {};
        room.caseOutcome = null;
        if (room.players.staines) {
          room.players.staines.position = [-1.4, 0, 12.2];
          room.players.staines.roomId = 'foyer';
        }
        if (room.players.anika) {
          room.players.anika.position = [1.4, 0, 12.2];
          room.players.anika.roomId = 'foyer';
        }
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }

      if (type === 'room:soloPreview') {
        room.soloPreviewMode = Boolean(msg.enabled);
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
        return;
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      roomSockets.get(meta.roomCode)?.delete(ws);
      const room = rooms.get(meta.roomCode);
      if (room && room.players[meta.role]) {
        room.players[meta.role]!.connected = false;
        room.updatedAt = Date.now();
        schedulePersist();
        broadcastRoom(room.code, { type: 'room:sync', state: room });
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blackwood Manor server listening on http://localhost:${PORT}`);
  });
}

startServer();
