import type { Match, Participant } from '../domain/models'

interface MatchCardProps {
  match: Match
  participantMap: Map<string, Participant>
  canEdit: boolean
  onPickWinner: (matchId: string, winnerParticipantId: string | null) => void
}

function getParticipantLabel(participantId: string | null, participantMap: Map<string, Participant>) {
  if (!participantId) {
    return 'TBD / BYE'
  }
  return participantMap.get(participantId)?.name ?? 'Unknown'
}

export function MatchCard({
  match,
  participantMap,
  canEdit,
  onPickWinner,
}: MatchCardProps) {
  const slot1Disabled = !canEdit || !match.player1ParticipantId
  const slot2Disabled = !canEdit || !match.player2ParticipantId
  const hasManualChoice = Boolean(match.player1ParticipantId && match.player2ParticipantId)

  return (
    <article className={`match-card ${hasManualChoice ? 'winner-ready' : ''}`}>
      <div className="match-header">
        <span>
          Round {match.roundIndex + 1} / Match {match.matchIndex + 1}
        </span>
        {match.winnerParticipantId ? <span className="badge">Winner set</span> : null}
      </div>
      {canEdit ? (
        <>
          <button
            type="button"
            className={`slot-button ${match.winnerParticipantId === match.player1ParticipantId ? 'is-winner' : ''} ${!match.player1ParticipantId ? 'empty-slot' : ''}`}
            onClick={() => onPickWinner(match.id, match.player1ParticipantId)}
            disabled={slot1Disabled}
          >
            {getParticipantLabel(match.player1ParticipantId, participantMap)}
          </button>
          <button
            type="button"
            className={`slot-button ${match.winnerParticipantId === match.player2ParticipantId ? 'is-winner' : ''} ${!match.player2ParticipantId ? 'empty-slot' : ''}`}
            onClick={() => onPickWinner(match.id, match.player2ParticipantId)}
            disabled={slot2Disabled}
          >
            {getParticipantLabel(match.player2ParticipantId, participantMap)}
          </button>
        </>
      ) : (
        <>
          <div
            className={`slot-label ${match.winnerParticipantId === match.player1ParticipantId ? 'is-winner' : ''} ${!match.player1ParticipantId ? 'empty-slot' : ''}`}
          >
            {getParticipantLabel(match.player1ParticipantId, participantMap)}
          </div>
          <div
            className={`slot-label ${match.winnerParticipantId === match.player2ParticipantId ? 'is-winner' : ''} ${!match.player2ParticipantId ? 'empty-slot' : ''}`}
          >
            {getParticipantLabel(match.player2ParticipantId, participantMap)}
          </div>
        </>
      )}
    </article>
  )
}
