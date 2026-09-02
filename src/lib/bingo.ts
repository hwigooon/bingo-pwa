const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomIndex(max: number): number {
  if (max <= 0) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return (value[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex] as T, result[index] as T];
  }
  return result;
}

export function sanitizeWords(words: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawWord of words) {
    const word = rawWord.trim().replace(/\s+/g, " ").slice(0, 30);
    const key = word.toLocaleLowerCase("ko-KR");
    if (!word || word === "FREE" || seen.has(key)) continue;
    seen.add(key);
    result.push(word);
  }
  return result;
}

export function getFreeIndex(size: number, freeCenter: boolean): number | null {
  if (!freeCenter || size % 2 === 0) return null;
  return Math.floor((size * size) / 2);
}

export function neededWordCount(size: number, freeCenter: boolean): number {
  return size * size - (getFreeIndex(size, freeCenter) === null ? 0 : 1);
}

export function createBoard(
  pool: readonly string[],
  size: number,
  freeCenter: boolean,
): string[] {
  const words = shuffle(sanitizeWords(pool));
  const needed = neededWordCount(size, freeCenter);
  if (words.length < needed) {
    throw new Error(`빙고판을 채우려면 단어가 ${needed}개 이상 필요합니다.`);
  }

  const freeIndex = getFreeIndex(size, freeCenter);
  const board: string[] = [];
  let wordIndex = 0;

  for (let index = 0; index < size * size; index += 1) {
    if (index === freeIndex) {
      board.push("FREE");
    } else {
      board.push(words[wordIndex] as string);
      wordIndex += 1;
    }
  }
  return board;
}

export function defaultMarks(board: readonly string[]): number[] {
  return board.reduce<number[]>((marks, word, index) => {
    if (word === "FREE") marks.push(index);
    return marks;
  }, []);
}

export function getWinningLines(size: number): number[][] {
  const lines: number[][] = [];

  for (let row = 0; row < size; row += 1) {
    lines.push(Array.from({ length: size }, (_, column) => row * size + column));
  }
  for (let column = 0; column < size; column += 1) {
    lines.push(Array.from({ length: size }, (_, row) => row * size + column));
  }

  lines.push(Array.from({ length: size }, (_, index) => index * size + index));
  lines.push(Array.from({ length: size }, (_, index) => index * size + (size - index - 1)));
  return lines;
}

export function getCompletedLines(size: number, marks: readonly number[]): number[][] {
  const marked = new Set(marks);
  return getWinningLines(size).filter((line) => line.every((index) => marked.has(index)));
}

export function countBingos(size: number, marks: readonly number[]): number {
  return getCompletedLines(size, marks).length;
}

export function generateNumberWords(min: number, max: number): string[] {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  return Array.from({ length: safeMax - safeMin + 1 }, (_, index) => String(safeMin + index));
}

export function makeRoomCode(length = 6): string {
  return Array.from({ length }, () => ROOM_ALPHABET[randomIndex(ROOM_ALPHABET.length)]).join("");
}

export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function splitWords(value: string): string[] {
  return sanitizeWords(value.split(/[\n,;|]+/));
}
