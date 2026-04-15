import { createBlocksForEvent } from './blocks'
import { createId, createShareToken } from './id'
import type {
  Block,
  CreateEventInput,
  CreateEventValidationResult,
  Event,
  Match,
  MatchSlotSource,
  Participant,
} from './models'

function distributeCount(total: number, bucketCount: number) {
  const base = Math.floor(total / bucketCount)
  const remainder = total % bucketCount
  return Array.from({ length: bucketCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function validateCreateEventInput(
  input: CreateEventInput,
): CreateEventValidationResult {
  const issues: string[] = []
  const blockCount = input.participantsPerBlock > 0
    ? input.capacity / input.participantsPerBlock
    : 0

  if (!input.name.trim()) {
    issues.push('イベント名は必須です。')
  }
  if (input.capacity <= 1) {
    issues.push('参加人数は2以上にしてください。')
  }
  if (input.participantsPerBlock <= 1) {
    issues.push('1ブロックあたりの人数は2以上にしてください。')
  }
  if (input.winnersPerBlock <= 0) {
    issues.push('勝ち上がり人数は1以上にしてください。')
  }
  if (input.winnersPerBlock > input.participantsPerBlock) {
    issues.push('勝ち上がり人数はブロック人数以下にしてください。')
  }
  if (input.capacity % input.participantsPerBlock !== 0) {
    issues.push('参加人数は1ブロックあたりの人数で割り切れる必要があります。')
  }
  if (input.winnersPerBlock >= input.participantsPerBlock) {
    issues.push('勝ち上がり人数はブロック人数より小さくしてください。')
  }
  if (!Number.isInteger(blockCount) || blockCount <= 0) {
    issues.push('ブロック数を計算できません。入力値を確認してください。')
  }

  return {
    valid: issues.length === 0,
    blockCount: Number.isInteger(blockCount) ? blockCount : 0,
    issues,
  }
}

function createInitialEvent(hostUserId: string, hostAuthUserId: string, input: CreateEventInput) {
  const validation = validateCreateEventInput(input)
  if (!validation.valid) {
    throw new Error(validation.issues[0])
  }

  const event: Event = {
    id: createId('event'),
    name: input.name.trim(),
    hostUserId,
    hostAuthUserId,
    capacity: input.capacity,
    participantsPerBlock: input.participantsPerBlock,
    winnersPerBlock: input.winnersPerBlock,
    blockCount: validation.blockCount,
    shareToken: createShareToken(),
    createdAt: new Date().toISOString(),
  }

  return { event, blocks: createBlocksForEvent(event) }
}

function createStageBlock(params: {
  eventId: string
  blockId: string | null
  roundIndex: number
  matchIndex: number
  participantSources: MatchSlotSource[]
  advanceCount: number
  isFinalStage: boolean
}) {
  return {
    id: createId('match'),
    eventId: params.eventId,
    blockId: params.blockId,
    stageType: 'block' as const,
    roundIndex: params.roundIndex,
    matchIndex: params.matchIndex,
    slot1Source: params.participantSources[0] ?? {
      type: 'participant' as const,
      blockIndex: params.matchIndex,
      seed: 1,
    },
    slot2Source: params.participantSources[1] ?? {
      type: 'participant' as const,
      blockIndex: params.matchIndex,
      seed: 2,
    },
    participantSources: params.participantSources,
    advanceCount: params.advanceCount,
    isFinalStage: params.isFinalStage,
    participantIds: [],
    qualifiedParticipantIds: [],
    player1ParticipantId: null,
    player2ParticipantId: null,
    winnerParticipantId: null,
    nextMatchId: null,
    nextSlot: null,
  } satisfies Match
}

function buildStagePlan(event: Event, blocks: Block[]) {
  const allStages: Match[] = []
  let currentParticipantCount = event.capacity
  let roundIndex = 0
  let previousStageBlocks: Match[] = []

  while (true) {
    const canFitInSingleBlock = currentParticipantCount <= event.participantsPerBlock
    const defaultBlockCount = Math.ceil(currentParticipantCount / event.participantsPerBlock)
    const defaultNextCount = defaultBlockCount * event.winnersPerBlock
    const shouldForceFinalSingleBlock =
      roundIndex > 0 && (canFitInSingleBlock || defaultNextCount >= currentParticipantCount)

    const blockCount = shouldForceFinalSingleBlock ? 1 : defaultBlockCount
    const blockSizes = distributeCount(currentParticipantCount, blockCount)
    const isFinalStage = blockCount === 1 && roundIndex > 0

    let sourceCursor = 0
    const previousStageSources = previousStageBlocks.flatMap((block) =>
      Array.from({ length: block.advanceCount }, (_, qualifierIndex) => ({
        type: 'blockQualifier' as const,
        blockId: block.id,
        qualifierIndex,
      })),
    )

    const stageBlocks = blockSizes.map((blockSize, matchIndex) => {
      const participantSources =
        roundIndex === 0
          ? Array.from({ length: blockSize }, (_, seedOffset) => ({
              type: 'participant' as const,
              blockIndex: matchIndex,
              seed: seedOffset + 1,
            }))
          : previousStageSources.slice(sourceCursor, sourceCursor + blockSize)

      sourceCursor += blockSize

      return createStageBlock({
        eventId: event.id,
        blockId: roundIndex === 0 ? blocks[matchIndex]?.id ?? null : null,
        roundIndex,
        matchIndex,
        participantSources,
        advanceCount: isFinalStage ? 1 : Math.min(event.winnersPerBlock, blockSize - 1),
        isFinalStage,
      })
    })

    allStages.push(...stageBlocks)

    if (isFinalStage) {
      break
    }

    previousStageBlocks = stageBlocks
    currentParticipantCount = stageBlocks.reduce((total, stageBlock) => total + stageBlock.advanceCount, 0)
    roundIndex += 1
  }

  return allStages
}

export function buildEventTournament(hostUserId: string, hostAuthUserId: string, input: CreateEventInput) {
  const { event, blocks } = createInitialEvent(hostUserId, hostAuthUserId, input)
  const matches = buildStagePlan(event, blocks)

  return {
    event,
    blocks,
    matches: recomputeMatches(blocks, [], matches),
  }
}

function getBlockParticipants(participants: Participant[], blockIndex: number) {
  return participants
    .filter((participant) => participant.assignedBlockIndex === blockIndex)
    .sort((left, right) => left.assignedSeed - right.assignedSeed)
    .map((participant) => participant.id)
}

function resolveSourceParticipantId(
  source: MatchSlotSource,
  participants: Participant[],
  blocksById: Map<string, Match>,
) {
  if (source.type === 'participant') {
    const ids = getBlockParticipants(participants, source.blockIndex)
    return ids[source.seed - 1] ?? null
  }
  if (source.type === 'matchWinner') {
    return blocksById.get(source.matchId)?.winnerParticipantId ?? null
  }
  if (source.blockId === 'missing') {
    return null
  }

  const qualifiers = blocksById.get(source.blockId)?.qualifiedParticipantIds ?? []
  return qualifiers[source.qualifierIndex] ?? null
}

export function recomputeMatches(blocks: Block[], participants: Participant[], matches: Match[]) {
  const sorted = [...matches].sort((left, right) => {
    if (left.roundIndex !== right.roundIndex) {
      return left.roundIndex - right.roundIndex
    }
    return left.matchIndex - right.matchIndex
  })

  const nextMatches = sorted.map((match) => ({ ...match }))
  const blocksById = new Map<string, Match>()

  nextMatches.forEach((match) => {
    const participantIds = match.participantSources
      .map((source) => resolveSourceParticipantId(source, participants, blocksById))
      .filter((value): value is string => Boolean(value))

    match.participantIds = participantIds
    match.player1ParticipantId = participantIds[0] ?? null
    match.player2ParticipantId = participantIds[1] ?? null
    match.qualifiedParticipantIds = match.qualifiedParticipantIds
      .filter((id) => participantIds.includes(id))
      .slice(0, match.advanceCount)
    match.winnerParticipantId = match.qualifiedParticipantIds[0] ?? null

    blocksById.set(match.id, match)
    if (match.blockId) {
      blocksById.set(match.blockId, match)
    }
  })

  void blocks

  return matches.map(
    (match) => nextMatches.find((candidate) => candidate.id === match.id) ?? match,
  )
}

export function setBlockQualifiers(
  blocks: Block[],
  participants: Participant[],
  matches: Match[],
  matchId: string,
  qualifiedParticipantIds: string[],
) {
  const target = matches.find((match) => match.id === matchId || match.blockId === matchId)
  if (!target) {
    throw new Error('ブロックが見つかりません。')
  }

  const everyParticipantIsInBlock = qualifiedParticipantIds.every((id) =>
    target.participantIds.includes(id),
  )
  if (!everyParticipantIsInBlock) {
    throw new Error('ブロック外の参加者は勝ち上がりに設定できません。')
  }
  if (qualifiedParticipantIds.length > target.advanceCount) {
    throw new Error('勝ち上がり人数の上限を超えています。')
  }

  const nextMatches = matches.map((match) =>
    match.id === target.id
      ? {
          ...match,
          qualifiedParticipantIds,
          winnerParticipantId: qualifiedParticipantIds[0] ?? null,
        }
      : { ...match },
  )

  return recomputeMatches(blocks, participants, nextMatches)
}

export function setMatchWinner(
  blocks: Block[],
  participants: Participant[],
  matches: Match[],
  matchId: string,
  winnerParticipantId: string | null,
) {
  const nextMatches = matches.map((match) =>
    match.id === matchId
      ? {
          ...match,
          qualifiedParticipantIds: winnerParticipantId ? [winnerParticipantId] : [],
          winnerParticipantId,
        }
      : { ...match },
  )

  return recomputeMatches(blocks, participants, nextMatches)
}

export function getParticipantFirstMatch(participant: Participant, matches: Match[]) {
  return (
    matches.find((match) => match.participantIds.includes(participant.id)) ?? null
  )
}
