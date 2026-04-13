import { Handle, Position, type NodeProps } from '@xyflow/react'

export interface FlowMatchNodeData {
  title: string
  stageLabel: string
  participantLabels: string[]
  participantIds: string[]
  qualifiedParticipantIds: string[]
  player1Label?: string
  player2Label?: string
  player1Id?: string | null
  player2Id?: string | null
  winnerParticipantId?: string | null
  canEdit: boolean
  mode: 'block' | 'final'
  blockWinnersCount?: number
  onPickWinner: (matchId: string, winnerParticipantId: string | null) => void
  onUpdateBlockQualifiers: (blockId: string, qualifiedParticipantIds: string[]) => void
  matchId: string
  blockId?: string | null
}

export function FlowMatchNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowMatchNodeData

  return (
    <article className="flow-match-node">
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className="flow-match-header">
        <div className="flow-match-stage">{nodeData.stageLabel}</div>
        <strong>{nodeData.title}</strong>
      </div>

      <div className="flow-match-slots">
        {nodeData.mode === 'block'
          ? nodeData.participantLabels.map((label, index) => {
              const participantId = nodeData.participantIds[index]
              const isQualified = nodeData.qualifiedParticipantIds.includes(participantId)
              const nextSelection = isQualified
                ? nodeData.qualifiedParticipantIds.filter((id) => id !== participantId)
                : [...nodeData.qualifiedParticipantIds, participantId].slice(
                    0,
                    nodeData.blockWinnersCount ?? 1,
                  )

              return (
                <button
                  key={participantId}
                  type="button"
                  className={`flow-slot ${isQualified ? 'is-winner' : ''}`}
                  disabled={!nodeData.canEdit}
                  onClick={() =>
                    nodeData.onUpdateBlockQualifiers(
                      nodeData.blockId ?? nodeData.matchId,
                      nextSelection,
                    )
                  }
                >
                  {label}
                </button>
              )
            })
          : (
            <>
              <button
                type="button"
                className={`flow-slot ${nodeData.winnerParticipantId === nodeData.player1Id ? 'is-winner' : ''}`}
                disabled={!nodeData.canEdit || !nodeData.player1Id}
                onClick={() => nodeData.onPickWinner(nodeData.matchId, nodeData.player1Id ?? null)}
              >
                {nodeData.player1Label}
              </button>
              <button
                type="button"
                className={`flow-slot ${nodeData.winnerParticipantId === nodeData.player2Id ? 'is-winner' : ''}`}
                disabled={!nodeData.canEdit || !nodeData.player2Id}
                onClick={() => nodeData.onPickWinner(nodeData.matchId, nodeData.player2Id ?? null)}
              >
                {nodeData.player2Label}
              </button>
            </>
          )}
      </div>
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </article>
  )
}
