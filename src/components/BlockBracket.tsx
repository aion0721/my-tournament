import type { Block, Match, Participant } from '../domain/models'

interface BlockBracketProps {
  block: Block
  match: Match | null
  participantMap: Map<string, Participant>
  canEdit: boolean
  selectedParticipantId?: string | null
  onSelectParticipantSession?: (participantId: string) => void
  onUpdateQualifiers: (blockId: string, qualifiedParticipantIds: string[]) => void
}

function getParticipantName(participantId: string, participantMap: Map<string, Participant>) {
  return participantMap.get(participantId)?.name ?? 'Unknown'
}

export function BlockBracket({
  block,
  match,
  participantMap,
  canEdit,
  selectedParticipantId,
  onSelectParticipantSession,
  onUpdateQualifiers,
}: BlockBracketProps) {
  const participantIds = match?.participantIds ?? []
  const selectedIds = match?.qualifiedParticipantIds ?? []

  return (
    <section className="bracket-card stack">
      <div>
        <div className="section-title">Block {block.index + 1}</div>
        <p className="muted">
          {block.participantCapacity}人同時対戦 / 勝ち上がり {block.winnersCount}人
        </p>
      </div>

      {participantIds.length === 0 ? (
        <div className="empty-state">まだ参加者が揃っていません。</div>
      ) : (
        <div className="list">
          {participantIds.map((participantId) => {
            const isSelected = selectedIds.includes(participantId)
            const isCurrentParticipant = selectedParticipantId === participantId
            const nextSelection = isSelected
              ? selectedIds.filter((id) => id !== participantId)
              : [...selectedIds, participantId].slice(0, block.winnersCount)

            return (
              <button
                key={participantId}
                type="button"
                disabled={!canEdit && !onSelectParticipantSession}
                className={`slot-button ${isSelected ? 'is-winner' : ''} ${isCurrentParticipant ? 'is-current-participant' : ''}`}
                onClick={() => {
                  if (canEdit) {
                    onUpdateQualifiers(block.id, nextSelection)
                    return
                  }

                  onSelectParticipantSession?.(participantId)
                }}
              >
                {getParticipantName(participantId, participantMap)}
                {!canEdit && isCurrentParticipant ? ' (表示中)' : ''}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
