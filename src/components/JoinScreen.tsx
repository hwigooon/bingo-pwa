import { ArrowLeft, ArrowRight, CloudOff, Hash, LoaderCircle, UserRound } from "lucide-react";
import { useState } from "react";
import { normalizeRoomCode } from "../lib/bingo";

interface JoinScreenProps {
  initialCode: string;
  nickname: string;
  onlineReady: boolean;
  onNicknameChange: (value: string) => void;
  onBack: () => void;
  onJoin: (code: string) => Promise<void>;
}

export function JoinScreen({
  initialCode,
  nickname,
  onlineReady,
  onNicknameChange,
  onBack,
  onJoin,
}: JoinScreenProps) {
  const [code, setCode] = useState(normalizeRoomCode(initialCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setError("플레이어 이름을 입력해 주세요.");
      return;
    }
    if (code.length < 4) {
      setError("방 코드를 확인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onJoin(code);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "방에 참가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen narrow-screen">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={18} /> 돌아가기
      </button>

      <section className="form-card join-card">
        <span className="form-card__icon"><Hash size={26} /></span>
        <p className="eyebrow">게임 참가</p>
        <h1>방 코드를 입력하세요</h1>
        <p className="form-card__description">방장이 공유한 6자리 코드나 초대 링크로 참가할 수 있습니다.</p>

        {!onlineReady ? (
          <div className="notice notice--warning">
            <CloudOff size={20} />
            <div>
              <strong>온라인 연결이 필요합니다</strong>
              <p>Supabase 설정을 완료하면 여러 기기에서 같은 방에 참가할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="field-label" htmlFor="join-nickname">플레이어 이름</label>
            <div className="input-with-icon">
              <UserRound size={19} />
              <input
                id="join-nickname"
                value={nickname}
                onChange={(event) => onNicknameChange(event.target.value.slice(0, 20))}
                placeholder="이름 또는 별명"
                autoComplete="nickname"
              />
            </div>

            <label className="field-label" htmlFor="room-code">방 코드</label>
            <input
              className="room-code-input"
              id="room-code"
              value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
            />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="button button--primary button--large button--full" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={20} /> : <Hash size={20} />}
              {busy ? "참가하는 중…" : "게임방 참가"}
              {!busy && <ArrowRight className="button__end-icon" size={19} />}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
