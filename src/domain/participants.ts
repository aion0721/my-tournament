import type { Block, Participant } from './models'

export function reassignParticipantSlot(
  participants: Participant[],
  blocks: Block[],
  participantId: string,
  assignedBlockIndex: number,
  assignedSeed: number,
) {
  const targetBlock = blocks.find((block) => block.index === assignedBlockIndex)
  if (!targetBlock) {
    throw new Error('指定されたブロックが存在しません。')
  }
  if (assignedSeed < 1 || assignedSeed > targetBlock.participantCapacity) {
    throw new Error('指定されたシードが範囲外です。')
  }

  const collision = participants.find(
    (participant) =>
      participant.id !== participantId &&
      participant.assignedBlockIndex === assignedBlockIndex &&
      participant.assignedSeed === assignedSeed,
  )
  if (collision) {
    throw new Error('そのブロック・シードはすでに使用されています。')
  }

  const exists = participants.some((participant) => participant.id === participantId)
  if (!exists) {
    throw new Error('参加者が見つかりません。')
  }

  return participants.map((participant) =>
    participant.id === participantId
      ? {
          ...participant,
          assignedBlockIndex,
          assignedSeed,
        }
      : participant,
  )
}
