import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  BoardConfig,
  GameEventRecord,
  GameRecord,
  GameSnapshot,
  PlayerRecord,
} from "../types";
import {
  countBingos,
  createBoard,
  defaultMarks,
  makeRoomCode,
  normalizeRoomCode,
  sanitizeWords,
} from "./bingo";
import { ensureUserId, requireSupabase } from "./supabase";

type GameRow = {
  id: string;
  room_code: string;
  host_id: string;
  topic: string;
  mode: "topic" | "numbers";
  board_size: number;
  word_pool: unknown;
  free_center: boolean;
  status: "waiting" | "playing" | "finished";
  current_turn_user_id: string | null;
  turn_number: number;
  called_words: unknown;
  target_bingo_count: number;
  winner_user_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

type PlayerRow = {
  id: string;
  game_id: string;
  user_id: string;
  nickname: string;
  board: unknown;
  marked_cells: unknown;
  bingo_count: number;
  joined_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  game_id: string;
  user_id: string;
  nickname: string;
  event_type: GameEventRecord["eventType"];
  payload: unknown;
  created_at: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isInteger(item))
    : [];
}

function asPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapGame(row: GameRow): GameRecord {
  return {
    id: row.id,
    roomCode: row.room_code,
    hostId: row.host_id,
    topic: row.topic,
    mode: row.mode,
    size: row.board_size,
    wordPool: asStringArray(row.word_pool),
    freeCenter: row.free_center,
    status: row.status,
    currentTurnUserId: row.current_turn_user_id,
    turnNumber: row.turn_number,
    calledWords: asStringArray(row.called_words),
    targetBingoCount: row.target_bingo_count,
    winnerUserId: row.winner_user_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapPlayer(row: PlayerRow): PlayerRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    nickname: row.nickname,
    board: asStringArray(row.board),
    marks: asNumberArray(row.marked_cells),
    bingoCount: row.bingo_count,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): GameEventRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    nickname: row.nickname,
    eventType: row.event_type,
    payload: asPayload(row.payload),
    createdAt: row.created_at,
  };
}

async function addEvents(
  events: Array<{
    game_id: string;
    user_id: string;
    nickname: string;
    event_type: GameEventRecord["eventType"];
    payload?: Record<string, unknown>;
  }>,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("game_events").insert(
    events.map((event) => ({
      ...event,
      payload: event.payload ?? {},
    })),
  );
  if (error) throw error;
}

export async function getRemoteSnapshot(gameId: string): Promise<GameSnapshot> {
  const client = requireSupabase();
  const userId = await ensureUserId();
  const [gameResult, playersResult, eventsResult] = await Promise.all([
    client.from("games").select("*").eq("id", gameId).single(),
    client.from("game_players").select("*").eq("game_id", gameId).order("joined_at"),
    client
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  if (gameResult.error) throw gameResult.error;
  if (playersResult.error) throw playersResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const game = mapGame(gameResult.data as GameRow);
  const players = (playersResult.data as PlayerRow[]).map(mapPlayer);
  const myPlayer = players.find((player) => player.userId === userId);
  if (!myPlayer) throw new Error("이 방의 내 빙고판을 찾지 못했습니다.");

  return {
    game,
    players,
    myPlayer,
    events: (eventsResult.data as EventRow[]).map(mapEvent),
  };
}

export async function createRemoteGame(
  config: BoardConfig,
  nickname: string,
): Promise<GameSnapshot> {
  const client = requireSupabase();
  const userId = await ensureUserId();
  const pool = sanitizeWords(config.wordPool);
  let gameRow: GameRow | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roomCode = makeRoomCode();
    const { data, error } = await client
      .from("games")
      .insert({
        room_code: roomCode,
        host_id: userId,
        topic: config.topic,
        mode: config.mode,
        board_size: config.size,
        word_pool: pool,
        free_center: config.freeCenter,
        target_bingo_count: config.targetBingoCount,
        status: "waiting",
      })
      .select("*")
      .single();

    if (!error) {
      gameRow = data as GameRow;
      break;
    }
    if (error.code !== "23505") throw error;
  }

  if (!gameRow) throw new Error("방 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");

  const marks = defaultMarks(config.board);
  const { error: playerError } = await client.from("game_players").insert({
    game_id: gameRow.id,
    user_id: userId,
    nickname: nickname.trim(),
    board: config.board,
    marked_cells: marks,
    bingo_count: countBingos(config.size, marks),
  });
  if (playerError) throw playerError;

  await addEvents([
    {
      game_id: gameRow.id,
      user_id: userId,
      nickname: nickname.trim(),
      event_type: "joined",
      payload: { host: true },
    },
  ]);

  return getRemoteSnapshot(gameRow.id);
}

export async function joinRemoteGame(roomCode: string, nickname: string): Promise<GameSnapshot> {
  const client = requireSupabase();
  const userId = await ensureUserId();
  const normalizedCode = normalizeRoomCode(roomCode);
  const { data: rawGame, error: gameError } = await client
    .from("games")
    .select("*")
    .eq("room_code", normalizedCode)
    .maybeSingle();

  if (gameError) throw gameError;
  if (!rawGame) throw new Error("방 코드를 찾을 수 없습니다.");
  const game = mapGame(rawGame as GameRow);

  const { data: existing, error: existingError } = await client
    .from("game_players")
    .select("*")
    .eq("game_id", game.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await client
      .from("game_players")
      .update({ nickname: nickname.trim() })
      .eq("id", (existing as PlayerRow).id);
    if (error) throw error;
    return getRemoteSnapshot(game.id);
  }

  if (game.status !== "waiting") {
    throw new Error("이미 시작되었거나 종료된 게임에는 새로 참가할 수 없습니다.");
  }

  const board = createBoard(game.wordPool, game.size, game.freeCenter);
  const marks = defaultMarks(board);
  const { error: playerError } = await client.from("game_players").insert({
    game_id: game.id,
    user_id: userId,
    nickname: nickname.trim(),
    board,
    marked_cells: marks,
    bingo_count: countBingos(game.size, marks),
  });
  if (playerError) throw playerError;

  await addEvents([
    {
      game_id: game.id,
      user_id: userId,
      nickname: nickname.trim(),
      event_type: "joined",
    },
  ]);
  return getRemoteSnapshot(game.id);
}

export async function reshuffleRemoteBoard(snapshot: GameSnapshot): Promise<GameSnapshot> {
  if (snapshot.game.status !== "waiting") throw new Error("게임 시작 전까지만 섞을 수 있습니다.");
  const client = requireSupabase();
  const userId = await ensureUserId();
  const board = createBoard(
    snapshot.game.wordPool,
    snapshot.game.size,
    snapshot.game.freeCenter,
  );
  const marks = defaultMarks(board);
  const { error } = await client
    .from("game_players")
    .update({ board, marked_cells: marks, bingo_count: 0 })
    .eq("id", snapshot.myPlayer.id)
    .eq("user_id", userId);
  if (error) throw error;
  return getRemoteSnapshot(snapshot.game.id);
}

export async function startRemoteGame(snapshot: GameSnapshot): Promise<void> {
  const client = requireSupabase();
  const userId = await ensureUserId();
  const firstPlayer = [...snapshot.players].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
  if (!firstPlayer) throw new Error("참가자가 없어 게임을 시작할 수 없습니다.");
  const { error } = await client
    .from("games")
    .update({
      status: "playing",
      started_at: new Date().toISOString(),
      current_turn_user_id: firstPlayer.userId,
      turn_number: 1,
      called_words: [],
    })
    .eq("id", snapshot.game.id)
    .eq("host_id", userId);
  if (error) throw error;
  await addEvents([
    {
      game_id: snapshot.game.id,
      user_id: userId,
      nickname: snapshot.myPlayer.nickname,
      event_type: "started",
    },
  ]);
}

export async function finishRemoteGame(snapshot: GameSnapshot): Promise<void> {
  const client = requireSupabase();
  const userId = await ensureUserId();
  const { error } = await client
    .from("games")
    .update({ status: "finished", ended_at: new Date().toISOString() })
    .eq("id", snapshot.game.id)
    .eq("host_id", userId);
  if (error) throw error;
  await addEvents([
    {
      game_id: snapshot.game.id,
      user_id: userId,
      nickname: snapshot.myPlayer.nickname,
      event_type: "finished",
    },
  ]);
}

export async function callRemoteWord(snapshot: GameSnapshot, word: string): Promise<void> {
  const client = requireSupabase();
  await ensureUserId();
  const { error } = await client.rpc("submit_bingo_turn", {
    target_game_id: snapshot.game.id,
    called_word: word,
  });
  if (error) {
    if (error.message.includes("not your turn")) throw new Error("현재 내 차례가 아닙니다.");
    if (error.message.includes("already called")) throw new Error("이미 나온 단어입니다.");
    throw error;
  }
}

export function subscribeToRemoteGame(gameId: string, onChange: () => void): () => void {
  const client = requireSupabase();
  let channel: RealtimeChannel | null = client
    .channel(`bingo-room:${gameId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
      onChange,
    )
    .subscribe();

  return () => {
    if (channel) {
      void client.removeChannel(channel);
      channel = null;
    }
  };
}

export async function suggestRemoteWords(topic: string, count: number): Promise<string[]> {
  const client = requireSupabase();
  await ensureUserId();
  const { data, error } = await client.functions.invoke("suggest-words", {
    body: { topic: topic.trim(), count },
  });
  if (error) throw error;
  const words = sanitizeWords(Array.isArray(data?.words) ? data.words : []);
  if (words.length === 0) throw new Error("추천 단어를 받지 못했습니다.");
  return words;
}
