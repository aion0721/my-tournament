import type { Participant } from './models'

export interface AvailableSlot {
  blockIndex: number
  seed: number
}

export function listAvailableSlots(
  participants: Participant[],
  blockCount: number,
  participantsPerBlock: number,
) {
  const taken = new Set(
    participants.map(
      (participant) => `${participant.assignedBlockIndex}-${participant.assignedSeed}`,
    ),
  )
  const slots: AvailableSlot[] = []

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
    for (let seed = 1; seed <= participantsPerBlock; seed += 1) {
      const key = `${blockIndex}-${seed}`
      if (!taken.has(key)) {
        slots.push({ blockIndex, seed })
      }
    }
  }

  return slots
}

export function assignRandomSlot(
  participants: Participant[],
  blockCount: number,
  participantsPerBlock: number,
  randomValue = Math.random(),
) {
  const slots = listAvailableSlots(participants, blockCount, participantsPerBlock)

  if (slots.length === 0) {
    return null
  }

  const safeIndex = Math.min(Math.floor(randomValue * slots.length), slots.length - 1)
  return slots[safeIndex]
}
