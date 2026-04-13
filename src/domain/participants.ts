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

  const currentParticipant = participants.find((participant) => participant.id === participantId)
  if (!currentParticipant) {
    throw new Error('参加者が見つかりません。')
  }

  const collision = participants.find(
    (participant) =>
      participant.id !== participantId &&
      participant.assignedBlockIndex === assignedBlockIndex &&
      participant.assignedSeed === assignedSeed,
  )

  return participants.map((participant) =>
    participant.id === participantId
      ? {
          ...participant,
          assignedBlockIndex,
          assignedSeed,
        }
      : collision && participant.id === collision.id
        ? {
            ...participant,
            assignedBlockIndex: currentParticipant.assignedBlockIndex,
            assignedSeed: currentParticipant.assignedSeed,
          }
      : participant,
  )
}
