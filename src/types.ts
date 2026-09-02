export type GameMode = "topic" | "numbers";
export type GameStatus = "waiting" | "playing" | "finished";

export interface GameRecord {
  id: string;
  roomCode: string;
  hostId: string;
  topic: string;
  mode: GameMode;
  size: number;
  wordPool: string[];
  freeCenter: boolean;
  status: GameStatus;
  currentTurnUserId: string | null;
  turnNumber: number;
  calledWords: string[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface PlayerRecord {
  id: string;
  gameId: string;
  userId: string;
  nickname: string;
  board: string[];
  marks: number[];
  bingoCount: number;
  joinedAt: string;
  updatedAt: string;
}

export interface GameEventRecord {
  id: string;
  gameId: string;
  userId: string;
  nickname: string;
  eventType: "joined" | "started" | "called" | "marked" | "unmarked" | "bingo" | "finished";
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GameSnapshot {
  game: GameRecord;
  players: PlayerRecord[];
  events: GameEventRecord[];
  myPlayer: PlayerRecord;
}

export interface BoardConfig {
  topic: string;
  mode: GameMode;
  size: number;
  wordPool: string[];
  board: string[];
  freeCenter: boolean;
}

export interface HistoryEntry {
  id: string;
  roomCode: string;
  topic: string;
  size: number;
  nickname: string;
  bingoCount: number;
  rank: number;
  playerCount: number;
  finishedAt: string;
}
