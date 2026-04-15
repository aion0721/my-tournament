import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { UserRole } from '../domain/models'
import { useAppStore } from '../hooks/useAppStore'

export function AdminUsersPage() {
  const { state, currentUser, isAdmin, isReady, listProfiles, updateUserRole } = useAppStore()
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'MyTournament：ユーザー管理'
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    void listProfiles().catch((caught) => {
      setNotice(caught instanceof Error ? caught.message : 'ユーザー一覧の取得に失敗しました。')
    })
  }, [isAdmin, listProfiles])

  if (!isReady) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">読み込み中</div>
          <p className="muted">ユーザー情報を取得しています。</p>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <main className="page">
        <section className="section-card stack">
          <div className="section-title">ログインが必要です</div>
          <p className="muted">管理画面を開くには主催者ログインしてください。</p>
          <Link className="chip-button" to="/">
            トップへ戻る
          </Link>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="section-card stack">
          <div className="section-title">アクセス権がありません</div>
          <p className="muted">このページは管理者のみ利用できます。</p>
          <Link className="chip-button" to="/">
            トップへ戻る
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>ユーザー管理</h1>
            <p className="lead">主催者と管理者の権限を管理します。</p>
          </div>
          <div className="topbar-links">
            <Link className="chip-button" to="/">
              一覧へ戻る
            </Link>
          </div>
        </div>
        {notice ? <div className="notice">{notice}</div> : null}
      </section>

      <section className="section-card stack">
        <div>
          <div className="section-title">ユーザー一覧</div>
          <p className="muted">現在は `profiles` テーブルに存在するユーザーのみ表示します。</p>
        </div>
        {state.profiles.length === 0 ? (
          <div className="empty-state">ユーザーが見つかりません。</div>
        ) : (
          <div className="list">
            {state.profiles.map((profile) => (
              <div className="event-link-card section-card" key={profile.id}>
                <div>
                  <strong>{profile.displayName}</strong>
                  <div className="muted">{profile.id}</div>
                </div>
                <div className="button-row">
                  <span className="badge">{profile.role}</span>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={profile.role === 'host'}
                    onClick={async () => {
                      await updateRole(profile.id, 'host')
                    }}
                  >
                    host に変更
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={profile.role === 'admin'}
                    onClick={async () => {
                      await updateRole(profile.id, 'admin')
                    }}
                  >
                    admin に変更
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )

  async function updateRole(userId: string, role: UserRole) {
    try {
      setNotice(null)
      await updateUserRole(userId, role)
      setNotice('ユーザー権限を更新しました。')
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'ユーザー権限の更新に失敗しました。')
    }
  }
}
