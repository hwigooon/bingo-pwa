import { CloudOff, Home, Radio } from "lucide-react";

interface AppHeaderProps {
  onlineReady: boolean;
  showHome?: boolean;
  onHome?: () => void;
}

export function AppHeader({ onlineReady, showHome = false, onHome }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button className="brand" type="button" onClick={onHome} aria-label="Bingo Club 홈">
          <span className="brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>BINGO</strong>
            <small>CLUB</small>
          </span>
        </button>

        <div className="app-header__actions">
          <span className={`connection-pill ${onlineReady ? "is-online" : ""}`}>
            {onlineReady ? <Radio size={15} /> : <CloudOff size={15} />}
            {onlineReady ? "온라인 준비됨" : "로컬 모드"}
          </span>
          {showHome && (
            <button className="icon-button" type="button" onClick={onHome} aria-label="홈으로">
              <Home size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
