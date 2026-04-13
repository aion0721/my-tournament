import { useState } from 'react'

interface HostAuthCardProps {
  currentUserName: string | null
  onLogin: (name: string) => void
  onLogout: () => void
}

export function HostAuthCard({
  currentUserName,
  onLogin,
  onLogout,
}: HostAuthCardProps) {
  const [name, setName] = useState(currentUserName ?? '')

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">主催者ログイン</div>
        <p className="muted">
          MVP では簡易ログインです。主催者名を入力するとイベント作成と管理を行えます。
        </p>
      </div>
      {currentUserName ? (
        <div className="stack">
          <div className="notice success">
            現在の主催者: <strong>{currentUserName}</strong>
          </div>
          <div className="button-row">
            <button className="button-secondary" type="button" onClick={onLogout}>
              ログアウト
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor="host-name">主催者名</label>
            <input
              id="host-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: Tournament Ops"
            />
          </div>
          <div className="button-row">
            <button className="button" type="button" onClick={() => onLogin(name)}>
              ログイン
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
