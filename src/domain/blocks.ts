import type { Block, Event } from './models'

export function createBlocksForEvent(event: Event): Block[] {
  return Array.from({ length: event.blockCount }, (_, index) => ({
    id: `${event.id}_block_${index + 1}`,
    eventId: event.id,
    index,
    participantCapacity: event.participantsPerBlock,
    winnersCount: event.winnersPerBlock,
  }))
}
