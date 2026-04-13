import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ParticipantJoinForm } from '../components/ParticipantJoinForm'
import { TournamentView } from '../components/TournamentView'
import { getParticipantFirstMatch } from '../domain/tournament'
import { useAppStore } from '../hooks/useAppStore'

export function ParticipantJoinPage() {
  const { shareToken } = useParams()
  const { state, isReady, joinEvent, logoutParticipant } = useAppStore()
  const [notice, setNotice] = useState<string | null>(null)

  const eventRecord = useMemo(
    () => state.eventRecords.find((record) => record.event.shareToken === shareToken) ?? null,
    [shareToken, state.eventRecords],
  )

  const joinedParticipant = useMemo(() => {
    if (!eventRecord) {
      return null
    }
    const participantId = state.joinedParticipantIdsByEventId[eventRecord.event.id]
    return eventRecord.participants.find((participant) => participant.id === participantId) ?? null
  }, [eventRecord, state.joinedParticipantIdsByEventId])

  if (!isReady) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">読み込み中</div>
          <p className="muted">イベント情報を取得しています。</p>
        </section>
      </main>
    )
  }

  if (!eventRecord) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">イベントが見つかりません</div>
          <p className="muted">共有 URL が正しいか確認してください。</p>
        </section>
      </main>
    )
  }

  const firstMatch = joinedParticipant
    ? getParticipantFirstMatch(joinedParticipant, eventRecord.matches)
    : null
  const isFull = eventRecord.participants.length >= eventRecord.event.capacity

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Open Join</span>
            <h1>{eventRecord.event.name}</h1>
            <p className="lead">
              共有 URL から参加できます。名前を入力すると空き枠にランダムで割り当てられます。
            </p>
          </div>
          <div className="topbar-links">
            <Link className="chip-button" to={`/events/${eventRecord.event.id}`}>
              ホスト画面を見る
            </Link>
            <Link className="chip-button" to="/">
              イベント一覧へ
            </Link>
          </div>
        </div>
        {notice ? <div className="notice success">{notice}</div> : null}
      </section>

      <div className="grid-2">
        <ParticipantJoinForm
          isFull={isFull}
          hasJoined={Boolean(joinedParticipant)}
          onJoin={async (name) => {
            try {
              await joinEvent(eventRecord.event.shareToken, name)
              setNotice('イベントに参加しました。')
            } catch (caught) {
              setNotice(
                caught instanceof Error ? caught.message : '参加登録に失敗しました。',
              )
            }
          }}
        />

        <section className="section-card stack">
          <div>
            <div className="section-title">自分の参加情報</div>
            <p className="muted">このブラウザで参加した参加者情報を表示します。</p>
          </div>
          {joinedParticipant ? (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">名前</div>
                  <div className="stat-value">{joinedParticipant.name}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">所属ブロック</div>
                  <div className="stat-value">B{joinedParticipant.assignedBlockIndex + 1}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">シード</div>
                  <div className="stat-value">{joinedParticipant.assignedSeed}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">初戦</div>
                  <div className="stat-value">
                    {firstMatch ? `R${firstMatch.roundIndex + 1}-M${firstMatch.matchIndex + 1}` : '-'}
                  </div>
                </div>
              </div>
              <div className="notice success">
                Block {joinedParticipant.assignedBlockIndex + 1} / Seed{' '}
                {joinedParticipant.assignedSeed} に参加中です。
              </div>
              <div className="button-row">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={async () => {
                    await logoutParticipant(eventRecord.event.id)
                    setNotice('このブラウザの参加セッションを解除しました。')
                  }}
                >
                  参加者ログアウト
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              参加後に自分のブロックと初戦情報を表示します。
            </div>
          )}
        </section>
      </div>

      <TournamentView
        blocks={eventRecord.blocks}
        matches={eventRecord.matches}
        participants={eventRecord.participants}
        canEdit={false}
        onUpdateBlockQualifiers={() => {}}
        onPickWinner={() => {}}
      />
    </main>
  )
}
