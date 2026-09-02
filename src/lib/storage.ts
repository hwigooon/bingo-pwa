import type { HistoryEntry } from "../types";

const NICKNAME_KEY = "bingo-club:nickname";
const HISTORY_KEY = "bingo-club:history";

export function loadNickname(): string {
  try {
    return window.localStorage.getItem(NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(nickname: string): void {
  try {
    window.localStorage.setItem(NICKNAME_KEY, nickname.trim());
  } catch {
    // Storage can be unavailable in private browsing; the current session still works.
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.id !== entry.id)].slice(0, 30);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // The result screen remains available even when local storage is blocked.
  }
  return next;
}
