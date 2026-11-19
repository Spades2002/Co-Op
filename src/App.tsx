import { useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine.ts';
import { GameView } from './components/GameView.tsx';
import { LobbyScreen } from './components/LobbyScreen.tsx';
import { PauseSettingsModal } from './components/PauseSettingsModal.tsx';
import {
  clearLastSession,
  loadLastSession,
  loadSavedAppearance,
  loadSettings,
  saveAppearance,
  saveLastSession,
  saveSettings,
} from './data/customizationOptions.ts';
import { multiplayerClient } from './net/multiplayerClient.ts';
import type { MansionSceneEngine } from './three/mansionScene.ts';
import type {
  CharacterAppearance,
  PlayerSettings,
  Role,
  RoomSessionState,
} from './types/game.ts';

export default function App() {
  const [role, setRole] = useState<Role>(() => loadLastSession()?.role || 'staines');
  const [appearances, setAppearances] = useState<Record<Role, CharacterAppearance>>(() => ({
    staines: loadSavedAppearance('staines'),
    anika: loadSavedAppearance('anika'),
  }));
  const [settings, setSettings] = useState<PlayerSettings>(() => loadSettings());
  const [roomState, setRoomState] = useState<RoomSessionState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lobbySettingsOpen, setLobbySettingsOpen] = useState(false);
  const [lastSession, setLastSession] = useState(() => loadLastSession());

  const engineRef = useRef<MansionSceneEngine | null>(null);

  useEffect(() => {
    soundEngine.updateSettings(settings);
    saveSettings(settings);
  }, [settings]);

  // Music only plays in the lobby. Once a level loads it stops and only sound effects remain.
  const musicScene = !roomState ? 'lobby' : 'none';
  useEffect(() => {
    soundEngine.setMusicScene(musicScene);
  }, [musicScene]);

  // Browsers only allow sound after a tap or key press, so start on the first one
  useEffect(() => {
    const unlock = () => soundEngine.unlockAndStartMusic();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    multiplayerClient.setListeners({
      onJoined: (assignedRole, state) => {
        setConnecting(false);
        setErrorMsg(null);
        setRole(assignedRole);
        setRoomState(state);
        saveLastSession(state.code, assignedRole);
        setLastSession({ roomCode: state.code, role: assignedRole });
      },
      onSync: (state) => {
        setRoomState(state);
      },
      onPartnerMoved: (payload) => {
        engineRef.current?.updatePartnerPositionDirect(
          payload.position,
          payload.rotationY,
          payload.moving,
        );
      },
      onError: (message) => {
        setConnecting(false);
        setErrorMsg(message);
      },
      onConnectionChange: (connected) => {
        setWsConnected(connected);
      },
    });
  }, []);

  const currentAppearance = appearances[role];

  const handleChangeAppearance = (next: CharacterAppearance) => {
    setAppearances((prev) => ({ ...prev, [role]: next }));
    saveAppearance(role, next);
    if (roomState) {
      multiplayerClient.updateAppearance(next);
    }
  };

  const handleCreateRoom = (startLevel: number) => {
    soundEngine.unlockAndStartMusic();
    soundEngine.playClick();
    setErrorMsg(null);
    setConnecting(true);
    multiplayerClient.connectAndJoin({
      mode: 'create',
      role,
      appearance: currentAppearance,
      startLevel,
    });
  };

  const handleJoinRoom = (code: string) => {
    soundEngine.unlockAndStartMusic();
    soundEngine.playClick();
    setErrorMsg(null);
    setConnecting(true);
    multiplayerClient.connectAndJoin({
      mode: 'join',
      code,
      role,
      appearance: currentAppearance,
    });
  };

  const handleLeaveRoom = () => {
    multiplayerClient.disconnect();
    setRoomState(null);
    clearLastSession();
    setLastSession(null);
  };

  if (!roomState) {
    return (
      <>
        <LobbyScreen
          role={role}
          onChangeRole={(r) => {
            soundEngine.playClick();
            setRole(r);
          }}
          appearance={currentAppearance}
          onChangeAppearance={handleChangeAppearance}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          lastSession={lastSession}
          errorMsg={errorMsg}
          connecting={connecting}
          settings={settings}
          onOpenSettings={() => setLobbySettingsOpen(true)}
          onToggleMute={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
        />
        {lobbySettingsOpen && (
          <PauseSettingsModal
            initialTab="settings"
            onTabChange={() => {}}
            caseData={null}
            roomState={null}
            myRole={role}
            settings={settings}
            onUpdateSettings={setSettings}
            onSelectLevel={() => {}}
            onRevealHint={() => {}}
            onSwitchRole={() => {}}
            onToggleSoloPreview={() => {}}
            onLeaveRoom={() => {}}
            onClose={() => setLobbySettingsOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <GameView
      roomState={roomState}
      myRole={role}
      myAppearance={currentAppearance}
      settings={settings}
      wsConnected={wsConnected}
      onUpdateSettings={setSettings}
      onLocalMove={(pos, rotY, moving, roomId) =>
        multiplayerClient.sendMove(pos, rotY, moving, roomId)
      }
      onDiscoverClue={(clueId, title, summary, tag) =>
        multiplayerClient.discoverClue(clueId, {
          clueId,
          title,
          text: summary,
          pinned: false,
          tag,
        })
      }
      onQuestionSuspect={(id) => multiplayerClient.questionSuspect(id)}
      onSolvePuzzle={(id) => multiplayerClient.solvePuzzle(id)}
      onAddNote={(title, text, tag) => multiplayerClient.addNote(title, text, tag)}
      onTogglePin={(id) => multiplayerClient.togglePin(id)}
      onSendEmote={(icon, text) => multiplayerClient.sendEmote(icon, text)}
      onSendPing={(pos, roomName) => multiplayerClient.sendPing(pos, roomName)}
      onRevealHint={(max) => multiplayerClient.revealHint(max)}
      onVoteAccusation={(draft) => multiplayerClient.voteAccusation(draft)}
      onSubmitAccusation={(draft, won) => multiplayerClient.submitAccusation(draft, won)}
      onSelectLevel={(lvl) => multiplayerClient.selectLevel(lvl)}
      onSwitchRole={(nextRole) => {
        multiplayerClient.switchRole(nextRole, appearances[nextRole]);
      }}
      onToggleSoloPreview={(enabled) => multiplayerClient.setSoloPreview(enabled)}
      onLeaveRoom={handleLeaveRoom}
      engineRefOut={engineRef}
    />
  );
}
