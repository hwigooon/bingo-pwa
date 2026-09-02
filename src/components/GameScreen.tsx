import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  DoorOpen,
  History,
  LoaderCircle,
  Play,
  QrCode,
  RefreshCw,
  Share2,
  Sparkles,
  StopCircle,
  Trophy,
  UsersRound,
  Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countBingos,
  createBoard,
  defaultMarks,
  getCompletedLines,
} from "../lib/bingo";
import {
  finishRemoteGame,
  getRemoteSnapshot,
  reshuffleRemoteBoard,
  startRemoteGame,
  subscribeToRemoteGame,
  updateRemoteMarks,
} from "../lib/game-service";
import { buildInviteUrl } from "../lib/invite";
import type { GameEventRecord, GameSnapshot, HistoryEntry, PlayerRecord } from "../types";

interface GameScreenProps {
  initialSnapshot: GameSnapshot;
  remote: boolean;
  onHome: () => void;
  onSaveHistory: (entry: HistoryEntry) => void;
}

function localEvent(
  snapshot: GameSnapshot,
  eventType: GameEventRecord["eventType"],
  payload: Record<string, unknown> = {},
): GameEventRecord {
  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    gameId: snapshot.game.id,
    userId: snapshot.myPlayer.userId,
    nickname: snapshot.myPlayer.nickname,
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function describeEvent(event: GameEventRecord): string {
  const word = typeof event.payload.word === "string" ? event.payload.word : "칸";
  const count = typeof event.payload.bingoCount === "number" ? event.payload.bingoCount : 0;
  switch (event.eventType) {
    case "joined": return `${event.nickname}님이 참가했습니다.`;
    case "started": return "게임을 시작했습니다.";
    case "marked": return `${event.nickname}님이 ‘${word}’을 표시했습니다.`;
    case "unmarked": return `${event.nickname}님이 ‘${word}’ 표시를 취소했습니다.`;
    case "bingo": return `${event.nickname}님이 ${count} BINGO를 달성했습니다!`;
    case "finished": return "게임을 종료했습니다.";
  }
}

function updateMyPlayer(snapshot: GameSnapshot, nextPlayer: PlayerRecord): GameSnapshot {
  return {
    ...snapshot,
    myPlayer: nextPlayer,
    players: snapshot.players.map((player) => (player.id === nextPlayer.id ? nextPlayer : player)),
  };
}

export function GameScreen({ initialSnapshot, remote, onHome, onSaveHistory }: GameScreenProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busyAction, setBusyAction] = useState<"mark" | "start" | "finish" | "shuffle" | null>(null);
  const [notice, setNotice] = useState("");
  const [celebration, setCelebration] = useState<number | null>(null);
  const savedHistory = useRef(false);
  const refreshTimer = useRef<number | null>(null);

  const isHost = snapshot.game.hostId === snapshot.myPlayer.userId;
  const isWaiting = snapshot.game.status === "waiting";
  const isPlaying = snapshot.game.status === "playing";
  const isFinished = snapshot.game.status === "finished";
  const inviteUrl = useMemo(() => {
    return buildInviteUrl(window.location.origin, import.meta.env.BASE_URL, snapshot.game.roomCode);
  }, [snapshot.game.roomCode]);

  const winningCells = useMemo(
    () => new Set(getCompletedLines(snapshot.game.size, snapshot.myPlayer.marks).flat()),
    [snapshot.game.size, snapshot.myPlayer.marks],
  );
  const ranking = useMemo(
    () => [...snapshot.players].sort((a, b) => b.bingoCount - a.bingoCount || a.updatedAt.localeCompare(b.updatedAt)),
    [snapshot.players],
  );

  const refresh = useCallback(async () => {
    if (!remote) return;
    try {
      const next = await getRemoteSnapshot(snapshot.game.id);
      setSnapshot(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "방 상태를 새로 불러오지 못했습니다.");
    }
  }, [remote, snapshot.game.id]);

  useEffect(() => {
    if (!remote) return undefined;
    const unsubscribe = subscribeToRemoteGame(snapshot.game.id, () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => void refresh(), 120);
    });
    return () => {
      unsubscribe();
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    };
  }, [refresh, remote, snapshot.game.id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isFinished || savedHistory.current) return;
    const rank = ranking.findIndex((player) => player.id === snapshot.myPlayer.id) + 1;
    onSaveHistory({
      id: `${snapshot.game.id}:${snapshot.myPlayer.id}`,
      roomCode: snapshot.game.roomCode,
      topic: snapshot.game.topic,
      size: snapshot.game.size,
      nickname: snapshot.myPlayer.nickname,
      bingoCount: snapshot.myPlayer.bingoCount,
      rank: Math.max(1, rank),
      playerCount: snapshot.players.length,
      finishedAt: snapshot.game.endedAt ?? new Date().toISOString(),
    });
    savedHistory.current = true;
  }, [isFinished, onSaveHistory, ranking, snapshot]);

  async function toggleCell(index: number) {
    if (!isPlaying || busyAction === "mark" || snapshot.myPlayer.board[index] === "FREE") return;
    const currentlyMarked = snapshot.myPlayer.marks.includes(index);
    const nextMarks = currentlyMarked
      ? snapshot.myPlayer.marks.filter((mark) => mark !== index)
      : [...snapshot.myPlayer.marks, index].sort((a, b) => a - b);
    const nextBingoCount = countBingos(snapshot.game.size, nextMarks);
    const previous = snapshot;
    const nextPlayer: PlayerRecord = {
      ...snapshot.myPlayer,
      marks: nextMarks,
      bingoCount: nextBingoCount,
      updatedAt: new Date().toISOString(),
    };

    setSnapshot((current) => updateMyPlayer(current, nextPlayer));
    setBusyAction("mark");
    try {
      if (remote) {
        await updateRemoteMarks(previous, nextMarks, index, !currentlyMarked);
        await refresh();
      } else {
        const markEvent = localEvent(previous, currentlyMarked ? "unmarked" : "marked", {
          cellIndex: index,
          word: previous.myPlayer.board[index] ?? "",
          bingoCount: nextBingoCount,
        });
        const events = [markEvent];
        for (let milestone = previous.myPlayer.bingoCount + 1; milestone <= nextBingoCount; milestone += 1) {
          events.unshift(localEvent(previous, "bingo", { bingoCount: milestone }));
        }
        setSnapshot((current) => ({ ...current, events: [...events, ...current.events] }));
      }

      if (nextBingoCount > previous.myPlayer.bingoCount) {
        setCelebration(nextBingoCount);
        window.setTimeout(() => setCelebration(null), 1800);
        navigator.vibrate?.([40, 30, 80]);
      }
    } catch (error) {
      setSnapshot(previous);
      setNotice(error instanceof Error ? error.message : "표시 상태를 저장하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function startGame() {
    if (!isHost || busyAction) return;
    setBusyAction("start");
    try {
      if (remote) {
        await startRemoteGame(snapshot);
        await refresh();
      } else {
        setSnapshot((current) => ({
          ...current,
          game: { ...current.game, status: "playing", startedAt: new Date().toISOString() },
          events: [localEvent(current, "started"), ...current.events],
        }));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "게임을 시작하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function finishGame() {
    if (!isHost || busyAction) return;
    setBusyAction("finish");
    try {
      if (remote) {
        await finishRemoteGame(snapshot);
        await refresh();
      } else {
        const endedAt = new Date().toISOString();
        setSnapshot((current) => ({
          ...current,
          game: { ...current.game, status: "finished", endedAt },
          events: [localEvent(current, "finished"), ...current.events],
        }));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "게임을 종료하지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reshuffleBoard() {
    if (!isWaiting || busyAction) return;
    setBusyAction("shuffle");
    try {
      if (remote) {
        const next = await reshuffleRemoteBoard(snapshot);
        setSnapshot(next);
      } else {
        const board = createBoard(snapshot.game.wordPool, snapshot.game.size, snapshot.game.freeCenter);
        const marks = defaultMarks(board);
        const player = { ...snapshot.myPlayer, board, marks, bingoCount: 0 };
        setSnapshot((current) => updateMyPlayer(current, player));
      }
      setNotice("내 빙고판을 새로 섞었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "빙고판을 섞지 못했습니다.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${snapshot.game.topic} 빙고에 참여하세요!\n${inviteUrl}`);
      setNotice("초대 링크를 복사했습니다.");
    } catch {
      setNotice("주소창의 링크를 복사해 공유해 주세요.");
    }
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${snapshot.game.topic} 빙고 초대`,
          text: `${snapshot.game.topic} 빙고에 참여하세요! 방 코드: ${snapshot.game.roomCode}`,
          url: inviteUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        await copyInvite();
        return;
      }
    }
    await copyInvite();
  }

  return (
    <main className="screen game-screen">
      <section className="game-toolbar">
        <div>
          <span className={`game-status game-status--${snapshot.game.status}`}>
            {isWaiting ? <Clock3 size={15} /> : isPlaying ? <Wifi size={15} /> : <CheckCircle2 size={15} />}
            {isWaiting ? "시작 대기" : isPlaying ? "게임 진행 중" : "게임 종료"}
          </span>
          <h1>{snapshot.game.topic}</h1>
          <p>{snapshot.game.size} × {snapshot.game.size} 빙고 · 방 코드 <strong>{snapshot.game.roomCode}</strong></p>
        </div>
        <div className="score-badge">
          <span>현재 기록</span>
          <strong>{snapshot.myPlayer.bingoCount}</strong>
          <em>BINGO</em>
        </div>
      </section>

      {isFinished && (
        <section className="result-banner">
          <span><Trophy size={28} /></span>
          <div>
            <p>게임 결과</p>
            <h2>{ranking.findIndex((player) => player.id === snapshot.myPlayer.id) + 1}위 · {snapshot.myPlayer.bingoCount} BINGO</h2>
          </div>
          <button className="button button--primary" type="button" onClick={onHome}><DoorOpen size={18} /> 처음으로</button>
        </section>
      )}

      <div className="game-layout">
        <section className="play-panel panel">
          <div className="play-panel__heading">
            <div>
              <h2>{snapshot.myPlayer.nickname}님의 빙고판</h2>
              <p>{isWaiting ? "게임 시작 전까지 배치를 다시 섞을 수 있습니다." : isPlaying ? "칸을 누르면 표시되고, 다시 누르면 취소됩니다." : "최종 빙고판입니다."}</p>
            </div>
            {isWaiting && (
              <button className="button button--ghost button--compact" type="button" onClick={reshuffleBoard} disabled={busyAction !== null}>
                {busyAction === "shuffle" ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                다시 섞기
              </button>
            )}
          </div>

          <div
            className="play-grid"
            data-size={snapshot.game.size}
            style={{ "--grid-size": snapshot.game.size } as React.CSSProperties}
          >
            {snapshot.myPlayer.board.map((word, index) => {
              const marked = snapshot.myPlayer.marks.includes(index);
              return (
                <button
                  key={`${word}-${index}`}
                  type="button"
                  className={`${marked ? "marked" : ""} ${winningCells.has(index) ? "winning" : ""} ${word === "FREE" ? "free" : ""}`}
                  onClick={() => void toggleCell(index)}
                  aria-pressed={marked}
                  disabled={!isPlaying || busyAction === "mark" || word === "FREE"}
                >
                  <span>{word}</span>
                  {marked && <i><Check size={snapshot.game.size >= 6 ? 16 : 21} strokeWidth={3} /></i>}
                </button>
              );
            })}
          </div>

          {isPlaying && isHost && (
            <button className="button button--danger game-finish-button" type="button" onClick={finishGame} disabled={busyAction !== null}>
              {busyAction === "finish" ? <LoaderCircle className="spin" size={18} /> : <StopCircle size={18} />}
              게임 종료
            </button>
          )}
        </section>

        <aside className="game-sidebar">
          {isWaiting && remote && (
            <section className="invite-card panel">
              <div className="invite-card__heading"><QrCode size={20} /><h2>친구 초대</h2></div>
              <div className="qr-frame"><QRCodeSVG value={inviteUrl} size={168} level="M" bgColor="#ffffff" fgColor="#101525" /></div>
              <strong className="invite-code">{snapshot.game.roomCode}</strong>
              <p>QR을 스캔하거나 링크를 공유하세요.</p>
              <div className="invite-url-row">
                <input value={inviteUrl} readOnly aria-label="게임 초대 링크" onFocus={(event) => event.currentTarget.select()} />
                <button type="button" onClick={copyInvite} aria-label="초대 링크 복사"><Copy size={17} /></button>
              </div>
              <div className="invite-actions">
                <button type="button" onClick={copyInvite}><Copy size={17} /> 링크 복사</button>
                <button type="button" onClick={shareInvite}><Share2 size={17} /> 공유</button>
              </div>
              {isHost && (
                <button className="button button--primary button--full" type="button" onClick={startGame} disabled={busyAction !== null}>
                  {busyAction === "start" ? <LoaderCircle className="spin" size={19} /> : <Play size={19} />}
                  게임 시작
                </button>
              )}
            </section>
          )}

          <section className="players-card panel">
            <div className="sidebar-heading"><UsersRound size={19} /><h2>참가자</h2><span>{snapshot.players.length}</span></div>
            <div className="player-list">
              {ranking.map((player, index) => (
                <div className={`player-row ${player.id === snapshot.myPlayer.id ? "is-me" : ""}`} key={player.id}>
                  <span className="player-avatar">{player.nickname.trim().slice(0, 1) || "?"}</span>
                  <div><strong>{player.nickname}</strong><small>{player.id === snapshot.myPlayer.id ? "나" : `${index + 1}위`}</small></div>
                  {player.userId === snapshot.game.hostId && <Crown className="host-crown" size={16} />}
                  <b>{player.bingoCount}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="events-card panel">
            <div className="sidebar-heading"><History size={18} /><h2>게임 기록</h2></div>
            <div className="event-list">
              {snapshot.events.length === 0 ? (
                <p className="event-empty">아직 기록된 동작이 없습니다.</p>
              ) : (
                snapshot.events.slice(0, 10).map((event) => (
                  <div className={`event-row event-row--${event.eventType}`} key={event.id}>
                    <i />
                    <div><p>{describeEvent(event)}</p><time>{new Date(event.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {celebration !== null && (
        <div className="bingo-celebration" role="status">
          <Sparkles size={34} />
          <strong>BINGO!</strong>
          <span>{celebration}줄 완성</span>
        </div>
      )}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </main>
  );
}
