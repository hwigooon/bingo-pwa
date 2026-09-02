import { describe, expect, it } from "vitest";
import {
  countBingos,
  createBoard,
  defaultMarks,
  generateNumberWords,
  getFreeIndex,
  neededWordCount,
  normalizeRoomCode,
  sanitizeWords,
} from "./bingo";

describe("bingo helpers", () => {
  it("creates a complete board with a free center", () => {
    const pool = Array.from({ length: 30 }, (_, index) => `단어 ${index + 1}`);
    const board = createBoard(pool, 5, true);
    expect(board).toHaveLength(25);
    expect(board[getFreeIndex(5, true) as number]).toBe("FREE");
    expect(defaultMarks(board)).toEqual([12]);
    expect(neededWordCount(5, true)).toBe(24);
  });

  it("counts rows, columns, and diagonals", () => {
    const marks = [0, 1, 2, 3, 4, 5, 10, 15, 20];
    expect(countBingos(5, marks)).toBe(2);
  });

  it("normalizes words, room codes, and number ranges", () => {
    expect(sanitizeWords([" 사과 ", "사과", "배  ", "FREE", ""])).toEqual(["사과", "배"]);
    expect(normalizeRoomCode("ab-c 12!")) .toBe("ABC12");
    expect(generateNumberWords(3, 1)).toEqual(["1", "2", "3"]);
  });
});
