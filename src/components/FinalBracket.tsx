import type { Match, Participant } from '../domain/models'
import { MatchCard } from './MatchCard'

interface FinalBracketProps {
  matches: Match[]
  participantMap: Map<string, Participant>
  canEdit: boolean
  onPickWinner: (matchId: string, winnerParticipantId: string | null) => void
}

function groupByRound(matches: Match[]) {
  return matches.reduce<Record<number, Match[]>>((groups, match) => {
    groups[match.roundIndex] = [...(groups[match.roundIndex] ?? []), match]
    return groups
  }, {})
}

export function FinalBracket({
  matches,
  participantMap,
  canEdit,
  onPickWinner,
}: FinalBracketProps) {
  const grouped = groupByRound(matches)
  const roundIndices = Object.keys(grouped)
    .map(Number)
    .sort((left, right) => left - right)

  return (
    <section className="bracket-card stack">
      <div>
        <div className="section-title">決勝トーナメント</div>
        <p className="muted">各ブロックの勝ち上がり枠が埋まると自動で反映されます。</p>
      </div>
      {matches.length === 0 ? (
        <div className="empty-state">決勝トーナメントの対象がまだありません。</div>
      ) : (
        <div className="bracket-rounds">
          {roundIndices.map((roundIndex) => (
            <div className="round-column" key={roundIndex}>
              <div className="round-title">Round {roundIndex + 1}</div>
              {grouped[roundIndex]
                .slice()
                .sort((left, right) => left.matchIndex - right.matchIndex)
                .map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participantMap={participantMap}
                    canEdit={canEdit}
                    onPickWinner={onPickWinner}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
