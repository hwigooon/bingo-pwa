import { ArrowRight, Clock3, Gamepad2, Plus, Radio, UserRound } from "lucide-react";
import type { HistoryEntry } from "../types";

interface HomeScreenProps {
  nickname: string;
  onlineReady: boolean;
  history: HistoryEntry[];
  onNicknameChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onHistory: () => void;
}

export function HomeScreen({
  nickname,
  onlineReady,
  history,
  onNicknameChange,
  onCreate,
  onJoin,
  onHistory,
}: HomeScreenProps) {
  const recent = history.slice(0, 3);

  return (
    <main className="screen home-screen">
      <section className="home-stage">
        <div className="home-stage__intro">
          <span className="eyebrow">
            <Gamepad2 size={16} /> 나만의 빙고 게임
          </span>
          <h1>
            단어를 고르고,
            <br />친구와 함께 <em>BINGO!</em>
          </h1>
          <p>
            원하는 크기와 주제로 빙고판을 만들고 방 코드 하나로 함께 플레이하세요.
          </p>

          <label className="field-label" htmlFor="nickname">
            플레이어 이름
          </label>
          <div className="input-with-icon home-name-input">
            <UserRound size={20} />
            <input
              id="nickname"
              value={nickname}
              onChange={(event) => onNicknameChange(event.target.value.slice(0, 20))}
              placeholder="이름 또는 별명"
              autoComplete="nickname"
            />
          </div>

          <div className="home-actions">
            <button className="button button--primary button--large" type="button" onClick={onCreate}>
              <Plus size={21} /> 새 게임 만들기
              <ArrowRight className="button__end-icon" size={19} />
            </button>
            <button
              className="button button--secondary button--large"
              type="button"
              onClick={onJoin}
              disabled={!onlineReady}
              title={onlineReady ? undefined : "Supabase 연결 후 사용할 수 있습니다."}
            >
              <Radio size={20} /> 방 코드로 참가
            </button>
          </div>

          {!onlineReady && (
            <p className="mode-note">
              지금은 이 기기에서 혼자 플레이할 수 있습니다. 온라인 설정을 연결하면 여러 휴대폰이
              같은 방에 참가할 수 있습니다.
            </p>
          )}
        </div>

        <div className="sample-board-card" aria-label="빙고판 미리보기">
          <div className="sample-board-card__top">
            <span>오늘의 빙고</span>
            <strong>2 BINGO</strong>
          </div>
          <div className="sample-board" aria-hidden="true">
            {["사과", "포도", "딸기", "수박", "망고", "키위", "FREE", "레몬", "체리"].map(
              (word, index) => (
                <span key={word} className={index === 0 || index === 4 || index === 6 ? "marked" : ""}>
                  {word}
                </span>
              ),
            )}
          </div>
          <div className="sample-board-card__footer">
            <span className="avatar-stack" aria-hidden="true">
              <i>범</i>
              <i>희</i>
              <i>민</i>
            </span>
            <span>친구 3명이 함께 플레이 중</span>
          </div>
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><Clock3 size={15} /> 최근 게임</span>
            <h2>지난 기록</h2>
          </div>
          {history.length > 0 && (
            <button className="text-button" type="button" onClick={onHistory}>
              전체 보기 <ArrowRight size={16} />
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <button className="empty-record" type="button" onClick={onCreate}>
            <span><Plus size={20} /></span>
            <strong>첫 빙고를 시작해 보세요</strong>
            <small>완료한 게임은 이곳에 저장됩니다.</small>
          </button>
        ) : (
          <div className="record-grid">
            {recent.map((item) => (
              <article className="record-card" key={item.id}>
                <div>
                  <span>{item.size} × {item.size}</span>
                  <time>{new Date(item.finishedAt).toLocaleDateString("ko-KR")}</time>
                </div>
                <h3>{item.topic}</h3>
                <p>{item.bingoCount} BINGO · {item.rank}위 / {item.playerCount}명</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
