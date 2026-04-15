import { assignRandomSlot } from './assignment'
import { createId, createInviteToken } from './id'
import type { Block, CreateInviteInput, EventInvite, Participant } from './models'

export function createEventInvite(input: CreateInviteInput): EventInvite {
  const displayName = input.displayName.trim()
  if (!displayName) {
    throw new Error('招待する参加者名を入力してください。')
  }

  if ((input.fixedBlockIndex === null) !== (input.fixedSeed === null)) {
    throw new Error('固定枠を使う場合はブロックとシードを両方指定してください。')
  }

  return {
    id: createId('invite'),
    eventId: input.eventId,
    displayName,
    inviteToken: createInviteToken(),
    inviteType: input.inviteType,
    status: 'pending',
    fixedBlockIndex: input.fixedBlockIndex,
    fixedSeed: input.fixedSeed,
    joinedParticipantId: null,
    createdAt: new Date().toISOString(),
  }
}

export function validateInviteSlot(
  invite: EventInvite,
  participants: Participant[],
  blocks: Block[],
) {
  if (invite.fixedBlockIndex === null || invite.fixedSeed === null) {
    return
  }

  const block = blocks.find((candidate) => candidate.index === invite.fixedBlockIndex)
  if (!block) {
    throw new Error('指定されたブロックが存在しません。')
  }

  if (invite.fixedSeed < 1 || invite.fixedSeed > block.participantCapacity) {
    throw new Error('指定されたシードがブロック人数の範囲外です。')
  }

  const taken = participants.some(
    (participant) =>
      participant.assignedBlockIndex === invite.fixedBlockIndex &&
      participant.assignedSeed === invite.fixedSeed,
  )
  if (taken) {
    throw new Error('指定された固定枠はすでに使用されています。')
  }
}

export function createParticipantFromInvite(
  invite: EventInvite,
  participants: Participant[],
  blockCount: number,
  participantsPerBlock: number,
) {
  const slot =
    invite.fixedBlockIndex !== null && invite.fixedSeed !== null
      ? { blockIndex: invite.fixedBlockIndex, seed: invite.fixedSeed }
      : assignRandomSlot(participants, blockCount, participantsPerBlock)

  if (!slot) {
    throw new Error('招待参加者に割り当てる空き枠がありません。')
  }

  const participant: Participant = {
    id: createId('participant'),
    eventId: invite.eventId,
    name: invite.displayName,
    sourceType: 'invite',
    inviteId: invite.id,
    assignedBlockIndex: slot.blockIndex,
    assignedSeed: slot.seed,
    joinedAt: new Date().toISOString(),
  }

  const nextInvite: EventInvite = {
    ...invite,
    status: 'joined',
    joinedParticipantId: participant.id,
  }

  return { participant, nextInvite }
}
