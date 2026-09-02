import { ArrowLeft, CalendarDays, Medal, Trophy, UsersRound } from "lucide-react";
import type { HistoryEntry } from "../types";

interface HistoryScreenProps {
  history: HistoryEntry[];
  onBack: () => void;
}

export function HistoryScreen({ history, onBack }: HistoryScreenProps) {
  return (
    <main className="screen history-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} /> 돌아가기
      </button>
      <div className="page-title">
        <span className="page-title__icon"><Trophy size={25} /></span>
        <div>
          <p className="eyebrow">GAME HISTORY</p>
          <h1>게임 기록</h1>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="history-empty">
          <Medal size={38} />
          <h2>아직 완료한 게임이 없습니다</h2>
          <p>게임을 끝내면 빙고 수와 순위가 이 기기에 저장됩니다.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <article className="history-item" key={item.id}>
              <div className="history-item__rank">{item.rank}</div>
              <div className="history-item__main">
                <div>
                  <h2>{item.topic}</h2>
                  <span>{item.size} × {item.size} · {item.roomCode}</span>
                </div>
                <strong>{item.bingoCount} BINGO</strong>
              </div>
              <div className="history-item__meta">
                <span><CalendarDays size={15} /> {new Date(item.finishedAt).toLocaleString("ko-KR")}</span>
                <span><UsersRound size={15} /> {item.playerCount}명 참가</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
