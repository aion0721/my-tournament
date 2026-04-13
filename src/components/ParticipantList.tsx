import type { Participant } from '../domain/models'

interface ParticipantListProps {
  participants: Participant[]
}

export function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <section className="section-card stack">
      <div>
        <div className="section-title">参加者一覧</div>
        <p className="muted">参加済みメンバーの現在の割当状況を表示します。</p>
      </div>
      {participants.length === 0 ? (
        <div className="empty-state">まだ参加者はいません。</div>
      ) : (
        <div className="list">
          {participants
            .slice()
            .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
            .map((participant) => (
              <div className="participant-row" key={participant.id}>
                <div>
                  <strong>{participant.name}</strong>
                  <div className="muted">Block {participant.assignedBlockIndex + 1}</div>
                </div>
                <div className="badge">Seed {participant.assignedSeed}</div>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}
