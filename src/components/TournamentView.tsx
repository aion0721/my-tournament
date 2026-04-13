import { useState } from 'react'
import type { Block, Match, Participant } from '../domain/models'
import { BlockBracket } from './BlockBracket'
import { FlowTournamentView } from './FlowTournamentView'

interface TournamentViewProps {
  blocks: Block[]
  matches: Match[]
  participants: Participant[]
  canEdit: boolean
  selectedParticipantId?: string | null
  onSelectParticipantSession?: (participantId: string) => void
  onUpdateBlockQualifiers: (blockId: string, qualifiedParticipantIds: string[]) => void
  onPickWinner: (matchId: string, winnerParticipantId: string | null) => void
}

export function TournamentView({
  blocks,
  matches,
  participants,
  canEdit,
  selectedParticipantId,
  onSelectParticipantSession,
  onUpdateBlockQualifiers,
  onPickWinner,
}: TournamentViewProps) {
  const [viewMode, setViewMode] = useState<'flow' | 'classic'>('flow')
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]))
  const groupedByStage = matches.reduce<Record<number, Match[]>>((groups, match) => {
    groups[match.roundIndex] = [...(groups[match.roundIndex] ?? []), match]
    return groups
  }, {})
  const stageIndices = Object.keys(groupedByStage).map(Number).sort((a, b) => a - b)

  return (
    <section className="section-card stack">
      <div className="page-heading">
        <div>
          <div className="section-title">トーナメント表示</div>
          <p className="muted">
            メインは React Flow 表示です。必要なら従来のカード型ブラケットへ切り替えられます。
          </p>
        </div>
        <div className="button-row">
          <button
            className={viewMode === 'flow' ? 'button' : 'button-secondary'}
            type="button"
            onClick={() => setViewMode('flow')}
          >
            Flow
          </button>
          <button
            className={viewMode === 'classic' ? 'button' : 'button-secondary'}
            type="button"
            onClick={() => setViewMode('classic')}
          >
            Classic
          </button>
        </div>
      </div>

      {viewMode === 'flow' ? (
        <FlowTournamentView
          blocks={blocks}
          matches={matches}
          participants={participants}
          canEdit={canEdit}
          selectedParticipantId={selectedParticipantId}
          onSelectParticipantSession={onSelectParticipantSession}
          onUpdateBlockQualifiers={onUpdateBlockQualifiers}
          onPickWinner={onPickWinner}
        />
      ) : (
        <div className="tournament-layout">
          {stageIndices.map((stageIndex) => (
            <section className="stack" key={stageIndex}>
              <div className="round-title">
                {groupedByStage[stageIndex].some((match) => match.isFinalStage)
                  ? `Final Stage ${stageIndex + 1}`
                  : `Stage ${stageIndex + 1}`}
              </div>
              <div className="block-grid">
                {groupedByStage[stageIndex]
                  .slice()
                  .sort((left, right) => left.matchIndex - right.matchIndex)
                  .map((match) => (
                    <BlockBracket
                      key={match.id}
                      block={{
                        id: match.blockId ?? match.id,
                        eventId: match.eventId,
                        index: match.matchIndex,
                        participantCapacity: match.participantSources.length,
                        winnersCount: match.advanceCount,
                      }}
                      match={match}
                      participantMap={participantMap}
                      canEdit={canEdit}
                      selectedParticipantId={selectedParticipantId}
                      onSelectParticipantSession={onSelectParticipantSession}
                      onUpdateQualifiers={onUpdateBlockQualifiers}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
