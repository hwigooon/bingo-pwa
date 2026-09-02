import {
  ArrowLeft,
  Bot,
  Check,
  Dice5,
  Eraser,
  GripVertical,
  Hash,
  Layers3,
  ListPlus,
  LoaderCircle,
  Minus,
  Plus,
  Shuffle,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TOPIC_LABELS, getLocalTopicWords } from "../data/topics";
import {
  generateNumberWords,
  getFreeIndex,
  neededWordCount,
  sanitizeWords,
  shuffle,
  splitWords,
} from "../lib/bingo";
import { suggestRemoteWords } from "../lib/game-service";
import type { BoardConfig, GameMode } from "../types";

interface BuilderScreenProps {
  nickname: string;
  onlineReady: boolean;
  onNicknameChange: (value: string) => void;
  onBack: () => void;
  onCreate: (config: BoardConfig, online: boolean) => Promise<void>;
}

function emptyBoard(size: number, freeCenter: boolean): string[] {
  const freeIndex = getFreeIndex(size, freeCenter);
  return Array.from({ length: size * size }, (_, index) => (index === freeIndex ? "FREE" : ""));
}

export function BuilderScreen({
  nickname,
  onlineReady,
  onNicknameChange,
  onBack,
  onCreate,
}: BuilderScreenProps) {
  const [size, setSize] = useState(5);
  const [mode, setMode] = useState<GameMode>("topic");
  const [topic, setTopic] = useState("과일");
  const [numberMin, setNumberMin] = useState(1);
  const [numberMax, setNumberMax] = useState(75);
  const [freeCenter, setFreeCenter] = useState(true);
  const [pool, setPool] = useState<string[]>(() => getLocalTopicWords("과일"));
  const [board, setBoard] = useState<string[]>(() => emptyBoard(5, true));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [customWords, setCustomWords] = useState("");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [creatingMode, setCreatingMode] = useState<"online" | "local" | null>(null);
  const [message, setMessage] = useState("");

  const requiredWords = neededWordCount(size, freeCenter);
  const filledCount = board.filter((word) => word && word !== "FREE").length;
  const complete = filledCount === requiredWords;
  const usedWords = useMemo(
    () => new Set(board.filter((word) => word && word !== "FREE")),
    [board],
  );
  const availableWords = useMemo(
    () => pool.filter((word) => !usedWords.has(word)),
    [pool, usedWords],
  );

  function changeSize(nextSize: number) {
    const nextFree = nextSize % 2 === 1 ? freeCenter : false;
    setSize(nextSize);
    if (nextSize % 2 === 0) setFreeCenter(false);
    setBoard(emptyBoard(nextSize, nextFree));
    setSelectedCell(null);
    setActiveWord(null);
    setMessage("");
  }

  function changeMode(nextMode: GameMode) {
    setMode(nextMode);
    setBoard(emptyBoard(size, freeCenter));
    setSelectedCell(null);
    setActiveWord(null);
    setMessage("");
    if (nextMode === "numbers") {
      setPool(generateNumberWords(numberMin, numberMax));
    } else {
      setPool(getLocalTopicWords(topic));
    }
  }

  function toggleFreeCenter() {
    if (size % 2 === 0) return;
    const nextFree = !freeCenter;
    const center = getFreeIndex(size, true) as number;
    setFreeCenter(nextFree);
    setBoard((current) => {
      const next = [...current];
      next[center] = nextFree ? "FREE" : "";
      return next;
    });
    setSelectedCell(null);
  }

  async function loadSuggestions() {
    setMessage("");
    if (mode === "numbers") {
      const generated = generateNumberWords(numberMin, numberMax);
      if (generated.length < requiredWords) {
        setMessage(`숫자 범위를 넓혀 주세요. 최소 ${requiredWords}개가 필요합니다.`);
        return;
      }
      setPool(generated);
      return;
    }

    if (!topic.trim()) {
      setMessage("주제를 입력해 주세요.");
      return;
    }

    const localWords = getLocalTopicWords(topic);
    if (localWords.length >= requiredWords) {
      setPool(sanitizeWords([...board, ...localWords]));
      setMessage(`기본 사전에서 ${localWords.length}개 단어를 불러왔습니다.`);
      return;
    }

    if (!onlineReady) {
      setMessage("기본 사전에 없는 주제입니다. 직접 단어를 추가하거나 온라인 AI 추천을 연결해 주세요.");
      return;
    }

    setLoadingSuggestions(true);
    try {
      const suggested = await suggestRemoteWords(topic, Math.min(80, Math.max(requiredWords + 20, 45)));
      setPool(sanitizeWords([...board, ...suggested]));
      setMessage(`AI가 ${suggested.length}개 단어를 추천했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "단어 추천을 불러오지 못했습니다.");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function addCustomWords() {
    const additions = splitWords(customWords);
    if (additions.length === 0) {
      setMessage("추가할 단어를 쉼표나 줄바꿈으로 구분해 입력해 주세요.");
      return;
    }
    setPool((current) => sanitizeWords([...current, ...additions]));
    setCustomWords("");
    setMessage(`${additions.length}개 단어를 추가했습니다.`);
  }

  function placeWord(cellIndex: number, word: string) {
    if (!word || board[cellIndex] === "FREE") return;
    setBoard((current) => {
      const next = [...current];
      const oldIndex = next.findIndex((item, index) => item === word && index !== cellIndex);
      if (oldIndex >= 0) next[oldIndex] = "";
      next[cellIndex] = word;
      return next;
    });
    setSelectedCell(null);
    setActiveWord(null);
    setMessage("");
  }

  function selectCandidate(word: string) {
    if (selectedCell !== null) {
      placeWord(selectedCell, word);
    } else {
      setActiveWord((current) => (current === word ? null : word));
    }
  }

  function selectCell(index: number) {
    if (board[index] === "FREE") return;
    if (activeWord) {
      placeWord(index, activeWord);
    } else {
      setSelectedCell((current) => (current === index ? null : index));
    }
  }

  function autoFill() {
    const emptyIndexes = board.reduce<number[]>((indexes, word, index) => {
      if (!word) indexes.push(index);
      return indexes;
    }, []);
    const candidates = shuffle(availableWords);
    if (candidates.length < emptyIndexes.length) {
      setMessage(`빈 칸을 모두 채우려면 단어가 ${emptyIndexes.length - candidates.length}개 더 필요합니다.`);
      return;
    }
    setBoard((current) => {
      const next = [...current];
      emptyIndexes.forEach((index, candidateIndex) => {
        next[index] = candidates[candidateIndex] as string;
      });
      return next;
    });
    setSelectedCell(null);
    setActiveWord(null);
    setMessage("남은 칸을 무작위로 채웠습니다.");
  }

  function shuffleBoard() {
    const values = shuffle(board.filter((word) => word && word !== "FREE"));
    let valueIndex = 0;
    setBoard((current) =>
      current.map((word) => {
        if (word === "FREE") return word;
        if (!word) return "";
        const nextWord = values[valueIndex] as string;
        valueIndex += 1;
        return nextWord;
      }),
    );
    setMessage("배치된 단어의 위치를 섞었습니다.");
  }

  function clearBoard() {
    setBoard(emptyBoard(size, freeCenter));
    setSelectedCell(null);
    setActiveWord(null);
    setMessage("빙고판을 비웠습니다.");
  }

  function clearSelectedCell() {
    if (selectedCell === null) return;
    setBoard((current) => current.map((word, index) => (index === selectedCell ? "" : word)));
    setSelectedCell(null);
  }

  async function create(online: boolean) {
    if (!nickname.trim()) {
      setMessage("플레이어 이름을 입력해 주세요.");
      return;
    }
    if (!complete) {
      setMessage(`빙고판의 빈 칸 ${requiredWords - filledCount}개를 채워 주세요.`);
      return;
    }

    const displayTopic = mode === "numbers" ? `숫자 ${numberMin}–${numberMax}` : topic.trim();
    const config: BoardConfig = {
      topic: displayTopic,
      mode,
      size,
      wordPool: sanitizeWords([...pool, ...board]),
      board,
      freeCenter,
    };

    setCreatingMode(online ? "online" : "local");
    setMessage("");
    try {
      await onCreate(config, online);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게임을 만들지 못했습니다.");
    } finally {
      setCreatingMode(null);
    }
  }

  return (
    <main className="screen builder-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} /> 돌아가기
      </button>

      <div className="page-title">
        <span className="page-title__icon"><Layers3 size={25} /></span>
        <div>
          <p className="eyebrow">BOARD MAKER</p>
          <h1>내 빙고판 만들기</h1>
        </div>
      </div>

      <div className="builder-layout">
        <section className="builder-settings panel">
          <div className="panel-heading">
            <span>1</span>
            <div><h2>게임 설정</h2><p>크기와 단어 유형을 골라 주세요.</p></div>
          </div>

          <label className="field-label">빙고판 크기</label>
          <div className="size-picker" role="group" aria-label="빙고판 크기">
            {[3, 4, 5, 6].map((value) => (
              <button
                key={value}
                type="button"
                className={size === value ? "active" : ""}
                onClick={() => changeSize(value)}
              >
                <strong>{value} × {value}</strong>
                <small>{value === 5 ? "기본" : `${value * value}칸`}</small>
              </button>
            ))}
          </div>

          <label className="field-label">단어 유형</label>
          <div className="segmented-control">
            <button type="button" className={mode === "topic" ? "active" : ""} onClick={() => changeMode("topic")}>
              <Sparkles size={17} /> 주제 단어
            </button>
            <button type="button" className={mode === "numbers" ? "active" : ""} onClick={() => changeMode("numbers")}>
              <Hash size={17} /> 숫자
            </button>
          </div>

          {mode === "topic" ? (
            <>
              <label className="field-label" htmlFor="topic">주제</label>
              <div className="topic-input-row">
                <input id="topic" value={topic} onChange={(event) => setTopic(event.target.value.slice(0, 40))} placeholder="예: 과일, 복강경 수술" />
                <button className="button button--compact button--secondary" type="button" onClick={loadSuggestions} disabled={loadingSuggestions}>
                  {loadingSuggestions ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                  추천
                </button>
              </div>
              <div className="preset-chips" aria-label="기본 주제">
                {TOPIC_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={topic === label ? "active" : ""}
                    onClick={() => {
                      setTopic(label);
                      setPool(getLocalTopicWords(label));
                      setBoard(emptyBoard(size, freeCenter));
                      setSelectedCell(null);
                      setActiveWord(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="field-label">숫자 범위</label>
              <div className="number-range">
                <input type="number" min={0} max={999} value={numberMin} onChange={(event) => setNumberMin(Number(event.target.value))} />
                <span>부터</span>
                <input type="number" min={1} max={999} value={numberMax} onChange={(event) => setNumberMax(Number(event.target.value))} />
                <button className="icon-button" type="button" onClick={loadSuggestions} aria-label="숫자 목록 적용"><Check size={19} /></button>
              </div>
            </>
          )}

          {size % 2 === 1 && (
            <button className={`free-toggle ${freeCenter ? "active" : ""}`} type="button" onClick={toggleFreeCenter} aria-pressed={freeCenter}>
              <span>{freeCenter ? <Check size={15} /> : <Minus size={15} />}</span>
              가운데 FREE 칸 사용
            </button>
          )}

          <label className="field-label" htmlFor="builder-nickname">플레이어 이름</label>
          <div className="input-with-icon">
            <UserRound size={19} />
            <input id="builder-nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value.slice(0, 20))} placeholder="이름 또는 별명" />
          </div>
        </section>

        <section className="builder-board panel">
          <div className="panel-heading panel-heading--with-status">
            <span>2</span>
            <div><h2>단어 배치</h2><p>칸과 단어를 차례로 누르거나 드래그하세요.</p></div>
            <strong>{filledCount} / {requiredWords}</strong>
          </div>

          <div
            className="builder-grid"
            data-size={size}
            style={{ "--grid-size": size } as React.CSSProperties}
          >
            {board.map((word, index) => (
              <button
                key={index}
                type="button"
                className={`${selectedCell === index ? "selected" : ""} ${word === "FREE" ? "free" : ""}`}
                onClick={() => selectCell(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  placeWord(index, event.dataTransfer.getData("text/plain"));
                }}
                aria-label={`${Math.floor(index / size) + 1}행 ${(index % size) + 1}열 ${word || "빈 칸"}`}
              >
                {word || <Plus size={18} />}
              </button>
            ))}
          </div>

          <div className="board-tools">
            <button type="button" onClick={autoFill}><Dice5 size={17} /> 나머지 자동 채우기</button>
            <button type="button" onClick={shuffleBoard} disabled={filledCount < 2}><Shuffle size={17} /> 위치 섞기</button>
            <button type="button" onClick={clearSelectedCell} disabled={selectedCell === null || board[selectedCell] === ""}><Minus size={17} /> 선택 칸 비우기</button>
            <button type="button" onClick={clearBoard} disabled={filledCount === 0}><Eraser size={17} /> 전체 비우기</button>
          </div>

          {(activeWord || selectedCell !== null) && (
            <div className="selection-guide">
              {activeWord ? <><strong>“{activeWord}”</strong>을 넣을 칸을 선택하세요.</> : <><strong>{(selectedCell as number) + 1}번 칸</strong>에 넣을 단어를 선택하세요.</>}
            </div>
          )}
        </section>

        <section className="word-pool panel">
          <div className="panel-heading panel-heading--with-status">
            <span>3</span>
            <div><h2>추천 단어</h2><p>필요한 단어보다 넉넉하게 준비해 선택할 수 있습니다.</p></div>
            <strong>{availableWords.length}개</strong>
          </div>

          <div className="custom-word-row">
            <textarea
              value={customWords}
              onChange={(event) => setCustomWords(event.target.value)}
              placeholder="직접 추가할 단어를 쉼표 또는 줄바꿈으로 입력"
              rows={2}
            />
            <button className="button button--secondary button--compact" type="button" onClick={addCustomWords}>
              <ListPlus size={18} /> 추가
            </button>
          </div>

          <div className="word-chip-list">
            {availableWords.length === 0 ? (
              <div className="word-pool-empty">
                <Bot size={25} />
                <p>사용할 수 있는 추천 단어가 없습니다.</p>
                <span>주제 추천을 불러오거나 직접 단어를 추가하세요.</span>
              </div>
            ) : (
              availableWords.map((word) => (
                <button
                  key={word}
                  type="button"
                  className={`word-chip ${activeWord === word ? "active" : ""}`}
                  onClick={() => selectCandidate(word)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", word);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  aria-pressed={activeWord === word}
                >
                  <GripVertical size={14} /> {word}
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="builder-submit panel">
        <div>
          <span className={`completion-dot ${complete ? "complete" : ""}`}><Check size={15} /></span>
          <p><strong>{complete ? "빙고판 완성!" : `빈 칸 ${requiredWords - filledCount}개 남음`}</strong><small>{complete ? "게임을 시작하거나 온라인 방을 만드세요." : "추천 단어를 눌러 칸을 채울 수 있습니다."}</small></p>
        </div>
        <div className="builder-submit__actions">
          <button className="button button--secondary" type="button" onClick={() => create(false)} disabled={creatingMode !== null}>
            {creatingMode === "local" ? <LoaderCircle className="spin" size={19} /> : <Dice5 size={19} />}
            혼자 시작
          </button>
          <button className="button button--primary" type="button" onClick={() => create(true)} disabled={!onlineReady || creatingMode !== null}>
            {creatingMode === "online" ? <LoaderCircle className="spin" size={19} /> : <Wifi size={19} />}
            온라인 방 만들기
          </button>
        </div>
      </section>

      {message && <div className="toast-message" role="status">{message}</div>}
    </main>
  );
}
