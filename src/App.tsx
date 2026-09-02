import { useCallback, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { BuilderScreen } from "./components/BuilderScreen";
import { GameScreen } from "./components/GameScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { HomeScreen } from "./components/HomeScreen";
import { JoinScreen } from "./components/JoinScreen";
import { countBingos, defaultMarks } from "./lib/bingo";
import { createRemoteGame, joinRemoteGame } from "./lib/game-service";
import { loadHistory, loadNickname, saveHistory, saveNickname } from "./lib/storage";
import { hasSupabaseConfig } from "./lib/supabase";
import type { BoardConfig, GameSnapshot, HistoryEntry } from "./types";

type View = "home" | "builder" | "join" | "game" | "history";

function makeLocalSnapshot(config: BoardConfig, nickname: string): GameSnapshot {
  const now = new Date().toISOString();
  const gameId = `local-${Date.now()}`;
  const userId = `local-user-${crypto.randomUUID?.() ?? Date.now()}`;
  const marks = defaultMarks(config.board);
  const player = {
    id: `local-player-${Date.now()}`,
    gameId,
    userId,
    nickname: nickname.trim(),
    board: config.board,
    marks,
    bingoCount: countBingos(config.size, marks),
    joinedAt: now,
    updatedAt: now,
  };

  return {
    game: {
      id: gameId,
      roomCode: "SOLO",
      hostId: userId,
      topic: config.topic,
      mode: config.mode,
      size: config.size,
      wordPool: config.wordPool,
      freeCenter: config.freeCenter,
      status: "playing",
      createdAt: now,
      startedAt: now,
      endedAt: null,
    },
    players: [player],
    myPlayer: player,
    events: [
      {
        id: `local-event-${Date.now()}`,
        gameId,
        userId,
        nickname: nickname.trim(),
        eventType: "started",
        payload: {},
        createdAt: now,
      },
    ],
  };
}

export default function App() {
  const inviteCode = useMemo(
    () => new URLSearchParams(window.location.search).get("room") ?? "",
    [],
  );
  const [view, setView] = useState<View>(inviteCode ? "join" : "home");
  const [nickname, setNicknameState] = useState(loadNickname);
  const [history, setHistory] = useState(loadHistory);
  const [session, setSession] = useState<{ snapshot: GameSnapshot; remote: boolean } | null>(null);

  function setNickname(value: string) {
    setNicknameState(value);
    saveNickname(value);
  }

  function setRoomInUrl(roomCode?: string) {
    const url = new URL(window.location.href);
    if (roomCode && roomCode !== "SOLO") url.searchParams.set("room", roomCode);
    else url.searchParams.delete("room");
    window.history.replaceState({}, "", url);
  }

  function goHome() {
    setSession(null);
    setRoomInUrl();
    setView("home");
  }

  async function handleCreate(config: BoardConfig, online: boolean) {
    saveNickname(nickname);
    const snapshot = online
      ? await createRemoteGame(config, nickname.trim())
      : makeLocalSnapshot(config, nickname.trim());
    setSession({ snapshot, remote: online });
    if (online) setRoomInUrl(snapshot.game.roomCode);
    setView("game");
  }

  async function handleJoin(code: string) {
    saveNickname(nickname);
    const snapshot = await joinRemoteGame(code, nickname.trim());
    setSession({ snapshot, remote: true });
    setRoomInUrl(snapshot.game.roomCode);
    setView("game");
  }

  const handleSaveHistory = useCallback((entry: HistoryEntry) => {
    setHistory(saveHistory(entry));
  }, []);

  return (
    <div className="app-shell">
      <AppHeader
        onlineReady={hasSupabaseConfig}
        showHome={view !== "home"}
        onHome={goHome}
      />

      {view === "home" && (
        <HomeScreen
          nickname={nickname}
          onlineReady={hasSupabaseConfig}
          history={history}
          onNicknameChange={setNickname}
          onCreate={() => setView("builder")}
          onJoin={() => setView("join")}
          onHistory={() => setView("history")}
        />
      )}

      {view === "builder" && (
        <BuilderScreen
          nickname={nickname}
          onlineReady={hasSupabaseConfig}
          onNicknameChange={setNickname}
          onBack={goHome}
          onCreate={handleCreate}
        />
      )}

      {view === "join" && (
        <JoinScreen
          initialCode={inviteCode}
          nickname={nickname}
          onlineReady={hasSupabaseConfig}
          onNicknameChange={setNickname}
          onBack={goHome}
          onJoin={handleJoin}
        />
      )}

      {view === "history" && <HistoryScreen history={history} onBack={goHome} />}

      {view === "game" && session && (
        <GameScreen
          initialSnapshot={session.snapshot}
          remote={session.remote}
          onHome={goHome}
          onSaveHistory={handleSaveHistory}
        />
      )}
    </div>
  );
}
