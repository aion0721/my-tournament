import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InviteManagementCard } from '../components/InviteManagementCard'
import { ParticipantList } from '../components/ParticipantList'
import { TournamentView } from '../components/TournamentView'
import { useAppStore } from '../hooks/useAppStore'

export function EventLobbyPage() {
  const { eventId } = useParams()
  const { state, isReady, createInvite, updateBlockQualifiers, updateMatchWinner } = useAppStore()
  const [notice, setNotice] = useState<string | null>(null)

  const eventRecord = useMemo(
    () => state.eventRecords.find((record) => record.event.id === eventId) ?? null,
    [eventId, state.eventRecords],
  )

  if (!isReady) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">読み込み中</div>
          <p className="muted">保存先からイベント情報を取得しています。</p>
        </section>
      </main>
    )
  }

  if (!eventRecord) {
    return (
      <main className="page">
        <section className="section-card">
          <div className="section-title">イベントが見つかりません</div>
          <p className="muted">URL を確認してください。</p>
        </section>
      </main>
    )
  }

  const inviteUrl = `${window.location.origin}/join/${eventRecord.event.shareToken}`
  const isHost = state.currentUserId === eventRecord.event.hostUserId

  return (
    <main className="page">
      <section className="hero-panel stack">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Host View</span>
            <h1>{eventRecord.event.name}</h1>
            <p className="lead">
              {eventRecord.event.blockCount}ブロック / 各ブロック
              {eventRecord.event.participantsPerBlock}人 / 各ブロックから
              {eventRecord.event.winnersPerBlock}人勝ち上がり
            </p>
          </div>
          <div className="topbar-links">
            <Link className="chip-button" to="/">
              イベント一覧へ
            </Link>
            <Link className="chip-button" to={`/join/${eventRecord.event.shareToken}`}>
              通常参加画面へ
            </Link>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">参加状況</div>
            <div className="stat-value">
              {eventRecord.participants.length} / {eventRecord.event.capacity}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">ブロック数</div>
            <div className="stat-value">{eventRecord.event.blockCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">通常参加URL</div>
            <div className="stat-value">{eventRecord.event.shareToken}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">招待人数</div>
            <div className="stat-value">{eventRecord.invites.length}</div>
          </div>
        </div>
        <div className="notice">
          <strong>通常参加URL:</strong> <span className="mono">{inviteUrl}</span>
        </div>
        <div className="button-row">
          <button
            className="button-secondary"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl)
              setNotice('通常参加URLをコピーしました。')
            }}
          >
            通常参加URLをコピー
          </button>
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
            setNotice('招待URLを発行しました。')
          } catch (caught) {
            setNotice(caught instanceof Error ? caught.message : '招待作成に失敗しました。')
          }
        }}
      />

      <ParticipantList participants={eventRecord.participants} />

      <TournamentView
        blocks={eventRecord.blocks}
        matches={eventRecord.matches}
        participants={eventRecord.participants}
        canEdit={isHost}
        onUpdateBlockQualifiers={async (blockId, qualifiedParticipantIds) => {
          try {
            await updateBlockQualifiers(eventRecord.event.id, blockId, qualifiedParticipantIds)
            setNotice('ブロック結果を更新しました。')
          } catch (caught) {
            setNotice(caught instanceof Error ? caught.message : 'ブロック結果更新に失敗しました。')
          }
        }}
        onPickWinner={async (matchId, winnerParticipantId) => {
          try {
            await updateMatchWinner(eventRecord.event.id, matchId, winnerParticipantId)
            setNotice('勝者を更新しました。')
          } catch (caught) {
            setNotice(caught instanceof Error ? caught.message : '勝者更新に失敗しました。')
          }
        }}
      />
    </main>
  )
}
