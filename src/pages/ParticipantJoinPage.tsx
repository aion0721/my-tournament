import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ParticipantNameEditor } from '../components/ParticipantNameEditor'
import { ParticipantJoinForm } from '../components/ParticipantJoinForm'
import { TournamentView } from '../components/TournamentView'
import { getParticipantFirstMatch } from '../domain/tournament'
import { useAppStore } from '../hooks/useAppStore'

export function ParticipantJoinPage() {
  const { shareToken } = useParams()
  const {
    state,
    isReady,
    joinEvent,
    joinEventByInvite,
    logoutParticipant,
    selectParticipantSession,
    updateParticipantName,
  } = useAppStore()
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

  useEffect(() => {
    document.title = eventRecord ? `MyTournament：${eventRecord.event.name}` : 'MyTournament'
  }, [eventRecord])

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
  const presetInvites = eventRecord.invites.filter(
    (invite) => invite.inviteType === 'preset' && invite.status === 'pending',
  )

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Open Join</span>
            <h1>{eventRecord.event.name}</h1>
            <p className="lead">
              共有 URL から参加できます。トーナメント上の名前を押すと、その参加者として表示を切り替えられます。
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
            <p className="muted">このブラウザで表示中の参加者情報です。</p>
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
              <ParticipantNameEditor
                key={joinedParticipant.id}
                inputId="self-participant-name"
                initialName={joinedParticipant.name}
                onSubmit={async (name) => {
                  try {
                    await updateParticipantName(
                      eventRecord.event.id,
                      joinedParticipant.id,
                      name,
                    )
                    setNotice('参加者名を更新しました。')
                  } catch (caught) {
                    setNotice(
                      caught instanceof Error
                        ? caught.message
                        : '参加者名の更新に失敗しました。',
                    )
                  }
                }}
              />
              <div className="notice success">
                Block {joinedParticipant.assignedBlockIndex + 1} / Seed{' '}
                {joinedParticipant.assignedSeed} を表示中です。
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
              参加後、またはトーナメント上の名前を押すと参加者情報を表示します。
            </div>
          )}
        </section>
      </div>

      <section className="section-card stack">
        <div>
          <div className="section-title">事前登録参加者</div>
          <p className="muted">
            ホストがあらかじめ登録した参加者です。自分の名前を押すとその参加者として参加できます。
          </p>
        </div>
        {presetInvites.length === 0 ? (
          <div className="empty-state">事前登録された参加者はいません。</div>
        ) : (
          <div className="list">
            {presetInvites.map((invite) => (
              <div className="participant-row" key={invite.id}>
                <div>
                  <strong>{invite.displayName}</strong>
                  <div className="muted">
                    {invite.fixedBlockIndex !== null && invite.fixedSeed !== null
                      ? `固定枠: Block ${invite.fixedBlockIndex + 1} / Seed ${invite.fixedSeed}`
                      : '枠は参加時に確定'}
                  </div>
                </div>
                <div className="button-row">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await joinEventByInvite(invite.inviteToken)
                        setNotice(`${invite.displayName} として参加しました。`)
                      } catch (caught) {
                        setNotice(
                          caught instanceof Error ? caught.message : '事前登録参加に失敗しました。',
                        )
                      }
                    }}
                  >
                    この名前で参加
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <TournamentView
        blocks={eventRecord.blocks}
        matches={eventRecord.matches}
        participants={eventRecord.participants}
        canEdit={false}
        selectedParticipantId={joinedParticipant?.id ?? null}
        onSelectParticipantSession={async (participantId) => {
          await selectParticipantSession(eventRecord.event.id, participantId)
          const participant = eventRecord.participants.find((item) => item.id === participantId)
          setNotice(
            participant
              ? `${participant.name} を表示中の参加者に切り替えました。`
              : '表示対象の参加者を切り替えました。',
          )
        }}
        onUpdateBlockQualifiers={() => {}}
        onPickWinner={() => {}}
      />
    </main>
  )
}
