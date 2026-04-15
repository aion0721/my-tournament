import { useEffect, useState } from 'react'
import type { UserProfile } from '../domain/models'

interface HostAuthCardProps {
  currentUser: UserProfile | null
  onSignInWithOtp: (email: string) => void
  onLogout: () => void
}

export function HostAuthCard({
  currentUser,
  onSignInWithOtp,
  onLogout,
}: HostAuthCardProps) {
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!currentUser) {
      return
    }

    setEmail('')
  }, [currentUser])

  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">主催者ログイン</div>
        <p className="muted">
          主催者はユーザー登録済みのメールアドレスでログインします。参加者は認証不要です。
        </p>
      </div>
      {currentUser ? (
        <div className="stack">
          <div className="notice success">
            現在の主催者: <strong>{currentUser.displayName}</strong> ({currentUser.role})
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
            <label htmlFor="host-email">メールアドレス</label>
            <input
              id="host-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="host@example.com"
            />
          </div>
          <div className="button-row">
            <button className="button" type="button" onClick={() => onSignInWithOtp(email)}>
              ログインリンクを送信
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
