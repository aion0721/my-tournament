import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EventCreateForm } from '../components/EventCreateForm'
import { HostAuthCard } from '../components/HostAuthCard'
import { useAppStore } from '../hooks/useAppStore'

export function EventCreatePage() {
  const navigate = useNavigate()
  const { state, currentUserName, isReady, loginHost, logout, createEvent } = useAppStore()
  const [error, setError] = useState<string | null>(null)

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId) ?? null,
    [state.currentUserId, state.users],
  )

  const hostEvents = useMemo(
    () =>
      state.eventRecords.filter(
        (eventRecord) => eventRecord.event.hostUserId === state.currentUserId,
      ),
    [state.eventRecords, state.currentUserId],
  )

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Tournament MVP</span>
            <h1>大会作成から参加導線までを、ひとつの画面群で管理</h1>
            <p className="lead">
              React + TypeScript で構成したトーナメント管理MVPです。
              ブロック戦、共有URL参加、ランダム割当、決勝トーナメント反映まで実装しています。
            </p>
          </div>
        </div>
        {error ? <div className="notice">{error}</div> : null}
      </section>

      <div className="grid-2">
        <HostAuthCard
          currentUserName={currentUserName}
          onLogin={async (name) => {
            try {
              setError(null)
              await loginHost(name)
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'ログインに失敗しました。')
            }
          }}
          onLogout={() => void logout()}
        />
        <EventCreateForm
          disabled={!isReady || !currentUser}
          onSubmit={async (input) => {
            if (!currentUser) {
              setError('イベント作成には主催者ログインが必要です。')
              return
            }

            try {
              setError(null)
              const eventId = await createEvent(currentUser.id, input)
              navigate(`/events/${eventId}`)
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'イベント作成に失敗しました。')
            }
          }}
        />
      </div>

      <section className="section-card stack">
        <div>
          <div className="section-title">主催イベント</div>
          <p className="muted">
            ログイン中の主催者が作成したイベントを一覧できます。現在の保存先は
            {state.storageMode === 'supabase' ? ' Supabase' : ' localStorage'}です。
          </p>
        </div>
        {hostEvents.length === 0 ? (
          <div className="empty-state">作成済みイベントはまだありません。</div>
        ) : (
          <div className="list">
            {hostEvents.map(({ event, participants }) => (
              <div className="event-link-card section-card" key={event.id}>
                <div>
                  <strong>{event.name}</strong>
                  <div className="muted">
                    {participants.length} / {event.capacity} 参加済み
                  </div>
                </div>
                <div className="topbar-links">
                  <Link className="chip-button" to={`/events/${event.id}`}>
                    ホスト画面
                  </Link>
                  <Link className="chip-button" to={`/join/${event.shareToken}`}>
                    参加画面
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
