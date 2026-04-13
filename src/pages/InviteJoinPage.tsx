import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ParticipantNameEditor } from '../components/ParticipantNameEditor'
import { TournamentView } from '../components/TournamentView'
import { getParticipantFirstMatch } from '../domain/tournament'
import { useAppStore } from '../hooks/useAppStore'

export function InviteJoinPage() {
  const { inviteToken } = useParams()
  const {
    state,
    isReady,
    joinEventByInvite,
    logoutParticipant,
    selectParticipantSession,
    updateParticipantName,
  } = useAppStore()
  const [notice, setNotice] = useState<string | null>(null)

  const invite = useMemo(
    () =>
      state.eventRecords
        .flatMap((record) => record.invites)
        .find((candidate) => candidate.inviteToken === inviteToken) ?? null,
    [inviteToken, state.eventRecords],
  )

  const eventRecord = useMemo(
    () =>
      invite
        ? state.eventRecords.find((record) => record.event.id === invite.eventId) ?? null
        : null,
    [invite, state.eventRecords],
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
          <p className="muted">招待情報を取得しています。</p>
        </section>
      </main>
    )
  }

  if (!invite || !eventRecord) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">招待が見つかりません</div>
          <p className="muted">招待 URL が正しいか確認してください。</p>
        </section>
      </main>
    )
  }

  const firstMatch = joinedParticipant
    ? getParticipantFirstMatch(joinedParticipant, eventRecord.matches)
    : null

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Invite Join</span>
            <h1>{eventRecord.event.name}</h1>
            <p className="lead">
              {invite.displayName} さん向けの招待参加ページです。トーナメント上の名前を押すと、その参加者として表示を切り替えられます。
            </p>
          </div>
          <div className="topbar-links">
            <Link className="chip-button" to={`/events/${eventRecord.event.id}`}>
              ホスト画面を見る
            </Link>
            <Link className="chip-button" to={`/join/${eventRecord.event.shareToken}`}>
              通常参加画面
            </Link>
          </div>
        </div>
        {notice ? <div className="notice success">{notice}</div> : null}
      </section>

      <div className="grid-2">
        <section className="section-card stack">
          <div>
            <div className="section-title">招待参加を確定</div>
            <p className="muted">
              主催者が登録した名前で参加します。名前入力は不要です。
            </p>
          </div>
          <div className="notice">
            <strong>{invite.displayName}</strong>
          </div>
          <div className="button-row">
            <button
              className="button"
              type="button"
              disabled={invite.status === 'joined'}
              onClick={async () => {
                try {
                  await joinEventByInvite(invite.inviteToken)
                  setNotice('招待参加を確定しました。')
                } catch (caught) {
                  setNotice(
                    caught instanceof Error ? caught.message : '招待参加に失敗しました。',
                  )
                }
              }}
            >
              {invite.status === 'joined' ? '参加済み' : '招待参加する'}
            </button>
          </div>
        </section>

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
                inputId="invite-participant-name"
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
              招待参加後、またはトーナメント上の名前を押すと参加者情報を表示します。
            </div>
          )}
        </section>
      </div>

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
