import { useMemo } from 'react'
import dagre from '@dagrejs/dagre'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  Position,
} from '@xyflow/react'
import type { Block, Match, Participant } from '../domain/models'
import { FlowMatchNode, type FlowMatchNodeData } from './FlowMatchNode'

interface FlowTournamentViewProps {
  blocks: Block[]
  matches: Match[]
  participants: Participant[]
  canEdit: boolean
  selectedParticipantId?: string | null
  onSelectParticipantSession?: (participantId: string) => void
  onUpdateBlockQualifiers: (blockId: string, qualifiedParticipantIds: string[]) => void
  onPickWinner: (matchId: string, winnerParticipantId: string | null) => void
}

const nodeTypes: NodeTypes = {
  match: FlowMatchNode,
}

const matchNodeWidth = 260
const matchNodeHeight = 188

function getParticipantLabel(participantId: string | null, participantMap: Map<string, Participant>) {
  if (!participantId) {
    return 'TBD / BYE'
  }
  return participantMap.get(participantId)?.name ?? 'Unknown'
}

function buildLayout(matches: Match[], blocks: Block[]) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'BT',
    ranksep: 120,
    nodesep: 52,
    marginx: 24,
    marginy: 24,
  })

  matches.forEach((match) => {
    graph.setNode(match.id, { width: matchNodeWidth, height: matchNodeHeight })
  })

  const blockMatchByBlockId = new Map(
    blocks
      .map((block) => matches.find((match) => match.blockId === block.id))
      .filter((match): match is Match => Boolean(match))
      .map((match) => [match.blockId as string, match]),
  )

  matches.forEach((match) => {
    match.participantSources.forEach((source) => {
      if (source.type !== 'blockQualifier') {
        return
      }
      const sourceMatch = blockMatchByBlockId.get(source.blockId) ??
        matches.find((candidate) => candidate.id === source.blockId)
      if (sourceMatch) {
        graph.setEdge(sourceMatch.id, match.id)
      }
    })
  })

  dagre.layout(graph)

  return {
    positioned: new Map(
      matches.map((match) => {
        const node = graph.node(match.id)
        return [
          match.id,
          {
            x: node.x - matchNodeWidth / 2,
            y: node.y - matchNodeHeight / 2,
          },
        ] as const
      }),
    ),
    blockMatchByBlockId,
  }
}

export function FlowTournamentView({
  blocks,
  matches,
  participants,
  canEdit,
  selectedParticipantId,
  onSelectParticipantSession,
  onUpdateBlockQualifiers,
  onPickWinner,
}: FlowTournamentViewProps) {
  const { nodes, edges } = useMemo(() => {
    const participantMap = new Map(participants.map((participant) => [participant.id, participant]))
    const sortedBlocks = blocks.slice().sort((left, right) => left.index - right.index)
    const { positioned, blockMatchByBlockId } = buildLayout(matches, sortedBlocks)
    const nextNodes: Node[] = []
    const nextEdges: Edge[] = []

    matches.forEach((match) => {
      const position = positioned.get(match.id)
      if (!position) {
        return
      }

      const block = blocks.find((candidate) => candidate.id === match.blockId)
      const participantLabels = match.participantIds.map((participantId) =>
        getParticipantLabel(participantId, participantMap),
      )

      nextNodes.push({
        id: match.id,
        type: 'match',
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        position,
        data: {
          title:
            match.isFinalStage ? `Final Block` : `Block Battle`,
          stageLabel:
            match.isFinalStage
              ? `Final / Stage ${match.roundIndex + 1}`
              : `Stage ${match.roundIndex + 1} / Block ${match.matchIndex + 1}`,
          participantLabels,
          participantIds: match.participantIds,
          qualifiedParticipantIds: match.qualifiedParticipantIds,
          player1Label: getParticipantLabel(match.player1ParticipantId, participantMap),
          player2Label: getParticipantLabel(match.player2ParticipantId, participantMap),
          player1Id: match.player1ParticipantId,
          player2Id: match.player2ParticipantId,
          winnerParticipantId: match.winnerParticipantId,
          canEdit,
          selectedParticipantId,
          onSelectParticipantSession,
          mode: match.stageType,
          blockWinnersCount: block?.winnersCount,
          onPickWinner,
          onUpdateBlockQualifiers,
          matchId: match.id,
          blockId: match.blockId,
        } satisfies FlowMatchNodeData,
      })
    })

    matches.forEach((match) => {
      match.participantSources.forEach((source, sourceIndex) => {
        if (source.type !== 'blockQualifier') {
          return
        }
        const sourceMatch = blockMatchByBlockId.get(source.blockId) ??
          matches.find((candidate) => candidate.id === source.blockId)
        if (!sourceMatch) {
          return
        }

        nextEdges.push({
          id: `${sourceMatch.id}-${match.id}-${sourceIndex}`,
          source: sourceMatch.id,
          target: match.id,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: match.isFinalStage ? '#0d7a5f' : '#b64d2d',
          },
          style: {
            stroke: match.isFinalStage ? '#0d7a5f' : '#b64d2d',
            strokeWidth: 2,
          },
        })
      })
    })

    return { nodes: nextNodes, edges: nextEdges }
  }, [
    blocks,
    canEdit,
    matches,
    onPickWinner,
    onSelectParticipantSession,
    onUpdateBlockQualifiers,
    participants,
    selectedParticipantId,
  ])

  return (
    <div className="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.45}
        maxZoom={1.4}
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="rgba(75, 52, 35, 0.12)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
