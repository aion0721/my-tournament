import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { InviteManagementCard } from '../components/InviteManagementCard'
import { ParticipantList } from '../components/ParticipantList'
import { QrCodeModal } from '../components/QrCodeModal'
import { TournamentView } from '../components/TournamentView'
import { useAppStore } from '../hooks/useAppStore'

export function EventLobbyPage() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const {
    state,
    isReady,
    createInvite,
    deleteEvent,
    deleteParticipant,
    updateParticipantAssignment,
    updateParticipantName,
    updateBlockQualifiers,
    updateMatchWinner,
  } = useAppStore()
  const [notice, setNotice] = useState<string | null>(null)
  const [isQrOpen, setIsQrOpen] = useState(false)

  const eventRecord = useMemo(
    () => state.eventRecords.find((record) => record.event.id === eventId) ?? null,
    [eventId, state.eventRecords],
  )

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

  const participantJoinUrl = `${window.location.origin}/join/${eventRecord.event.shareToken}`
  const isHost = state.currentUserId === eventRecord.event.hostUserId

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div className="stack">
            <img className="app-logo" src="/logo.png" alt="MyTournament logo" />
            <div>
              <span className="eyebrow">Host View</span>
              <h1>{eventRecord.event.name}</h1>
              <p className="lead">
                {eventRecord.event.blockCount} ブロック / 1ブロック
                {eventRecord.event.participantsPerBlock} 人 / 各ブロックから
                {eventRecord.event.winnersPerBlock} 人勝ち上がり
              </p>
            </div>
          </div>
          <div className="topbar-links">
            <Link className="chip-button" to="/">
              一覧へ戻る
            </Link>
            <Link className="chip-button" to={`/join/${eventRecord.event.shareToken}`}>
              参加画面
            </Link>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">参加人数</div>
            <div className="stat-value">
              {eventRecord.participants.length} / {eventRecord.event.capacity}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">ブロック数</div>
            <div className="stat-value">{eventRecord.event.blockCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">共有コード</div>
            <div className="stat-value">{eventRecord.event.shareToken}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">招待数</div>
            <div className="stat-value">{eventRecord.invites.length}</div>
          </div>
        </div>

        <div className="notice">
          <strong>通常参加 URL:</strong> <span className="mono">{participantJoinUrl}</span>
        </div>

        <div className="button-row">
          <button
            className="button-secondary"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(participantJoinUrl)
              setNotice('通常参加 URL をコピーしました。')
            }}
          >
            参加 URL をコピー
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setIsQrOpen(true)}
          >
            QRコードで表示
          </button>
          {isHost ? (
            <button
              className="button-secondary"
              type="button"
              onClick={async () => {
                const shouldDelete = window.confirm(
                  `「${eventRecord.event.name}」を削除します。元に戻せません。`,
                )
                if (!shouldDelete) {
                  return
                }

                try {
                  await deleteEvent(eventRecord.event.id)
                  navigate('/')
                } catch (caught) {
                  setNotice(
                    caught instanceof Error
                      ? caught.message
                      : 'イベント削除に失敗しました。',
                  )
                }
              }}
            >
              イベント削除
            </button>
          ) : null}
        </div>

        {notice ? <div className="notice success">{notice}</div> : null}
      </section>

      <InviteManagementCard
        eventRecord={eventRecord}
        canEdit={isHost}
        onCreateInvite={async (displayName, fixedBlockIndex, fixedSeed) => {
          try {
            await createInvite({
              eventId: eventRecord.event.id,
              displayName,
              fixedBlockIndex,
              fixedSeed,
            })
            setNotice('招待 URL を発行しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error ? caught.message : '招待作成に失敗しました。',
            )
          }
        }}
      />

      <ParticipantList
        participants={eventRecord.participants}
        canEdit={isHost}
        maxBlockCount={eventRecord.event.blockCount}
        maxSeed={eventRecord.event.participantsPerBlock}
        onUpdateAssignment={async (participantId, assignedBlockIndex, assignedSeed) => {
          try {
            await updateParticipantAssignment(
              eventRecord.event.id,
              participantId,
              assignedBlockIndex,
              assignedSeed,
            )
            setNotice('参加者の配置を更新しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error
                ? caught.message
                : '参加者の配置更新に失敗しました。',
            )
          }
        }}
        onUpdateName={async (participantId, name) => {
          try {
            await updateParticipantName(eventRecord.event.id, participantId, name)
            setNotice('参加者名を更新しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error ? caught.message : '参加者名の更新に失敗しました。',
            )
          }
        }}
        onDeleteParticipant={async (participant) => {
          const shouldDelete = window.confirm(
            `「${participant.name}」を参加者一覧から削除します。`,
          )
          if (!shouldDelete) {
            return
          }

          try {
            await deleteParticipant(eventRecord.event.id, participant.id)
            setNotice('参加者を削除しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error ? caught.message : '参加者の削除に失敗しました。',
            )
          }
        }}
      />

      <TournamentView
        blocks={eventRecord.blocks}
        matches={eventRecord.matches}
        participants={eventRecord.participants}
        canEdit={isHost}
        onUpdateBlockQualifiers={async (blockId, qualifiedParticipantIds) => {
          try {
            await updateBlockQualifiers(eventRecord.event.id, blockId, qualifiedParticipantIds)
            setNotice('勝ち上がり設定を更新しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error
                ? caught.message
                : '勝ち上がり設定の更新に失敗しました。',
            )
          }
        }}
        onPickWinner={async (matchId, winnerParticipantId) => {
          try {
            await updateMatchWinner(eventRecord.event.id, matchId, winnerParticipantId)
            setNotice('試合結果を更新しました。')
          } catch (caught) {
            setNotice(
              caught instanceof Error ? caught.message : '試合結果の更新に失敗しました。',
            )
          }
        }}
      />

      <QrCodeModal
        title="通常参加 QRコード"
        value={participantJoinUrl}
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
      />
    </main>
  )
}
