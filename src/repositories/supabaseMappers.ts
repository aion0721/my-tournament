import { createBlocksForEvent } from '../domain/blocks'
import type { Event, EventInvite, EventRecord, Match, Participant } from '../domain/models'
import type { Database, Json } from '../lib/supabase'

type EventRow = Database['public']['Tables']['events']['Row']
type EventInviteRow = Database['public']['Tables']['event_invites']['Row']
type MatchRow = Database['public']['Tables']['matches']['Row']
type ParticipantRow = Database['public']['Tables']['participants']['Row']

export function mapEventRow(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    hostUserId: row.host_user_id,
    hostAuthUserId: row.host_auth_user_id,
    capacity: row.capacity,
    participantsPerBlock: row.participants_per_block,
    winnersPerBlock: row.winners_per_block,
    blockCount: row.block_count,
    shareToken: row.share_token,
    createdAt: row.created_at,
  }
}

export function mapParticipantRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    sourceType: row.source_type,
    inviteId: row.invite_id,
    assignedBlockIndex: row.assigned_block_index,
    assignedSeed: row.assigned_seed,
    joinedAt: row.joined_at,
  }
}

export function mapInviteRow(row: EventInviteRow): EventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    inviteToken: row.invite_token,
    status: row.status,
    fixedBlockIndex: row.fixed_block_index,
    fixedSeed: row.fixed_seed,
    joinedParticipantId: row.joined_participant_id,
    createdAt: row.created_at,
  }
}

export function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    eventId: row.event_id,
    blockId: row.block_id,
    stageType: row.stage_type,
    roundIndex: row.round_index,
    matchIndex: row.match_index,
    slot1Source: row.slot1_source as Match['slot1Source'],
    slot2Source: row.slot2_source as Match['slot2Source'],
    participantSources: (row.participant_sources as Match['participantSources'] | null) ?? [],
    advanceCount: row.advance_count ?? 1,
    isFinalStage: row.is_final_stage ?? false,
    participantIds: (row.participant_ids as string[] | null) ?? [],
    qualifiedParticipantIds: (row.qualified_participant_ids as string[] | null) ?? [],
    player1ParticipantId: row.player1_participant_id,
    player2ParticipantId: row.player2_participant_id,
    winnerParticipantId: row.winner_participant_id,
    nextMatchId: row.next_match_id,
    nextSlot: (row.next_slot as Match['nextSlot']) ?? null,
  }
}

export function mapEventToInsert(event: Event): Database['public']['Tables']['events']['Insert'] {
  return {
    id: event.id,
    name: event.name,
    host_user_id: event.hostUserId,
    host_auth_user_id: event.hostAuthUserId ?? null,
    capacity: event.capacity,
    participants_per_block: event.participantsPerBlock,
    winners_per_block: event.winnersPerBlock,
    block_count: event.blockCount,
    share_token: event.shareToken,
    created_at: event.createdAt,
  }
}

export function mapParticipantToInsert(
  participant: Participant,
): Database['public']['Tables']['participants']['Insert'] {
  return {
    id: participant.id,
    event_id: participant.eventId,
    name: participant.name,
    source_type: participant.sourceType ?? 'open',
    invite_id: participant.inviteId ?? null,
    assigned_block_index: participant.assignedBlockIndex,
    assigned_seed: participant.assignedSeed,
    joined_at: participant.joinedAt,
  }
}

export function mapInviteToInsert(
  invite: EventInvite,
): Database['public']['Tables']['event_invites']['Insert'] {
  return {
    id: invite.id,
    event_id: invite.eventId,
    display_name: invite.displayName,
    invite_token: invite.inviteToken,
    status: invite.status,
    fixed_block_index: invite.fixedBlockIndex,
    fixed_seed: invite.fixedSeed,
    joined_participant_id: invite.joinedParticipantId,
    created_at: invite.createdAt,
  }
}

export function mapMatchToInsert(match: Match): Database['public']['Tables']['matches']['Insert'] {
  return {
    id: match.id,
    event_id: match.eventId,
    block_id: match.blockId,
    stage_type: match.stageType,
    round_index: match.roundIndex,
    match_index: match.matchIndex,
    slot1_source: match.slot1Source as Json,
    slot2_source: match.slot2Source as Json,
    participant_sources: match.participantSources as Json,
    advance_count: match.advanceCount,
    is_final_stage: match.isFinalStage,
    participant_ids: match.participantIds as Json,
    qualified_participant_ids: match.qualifiedParticipantIds as Json,
    player1_participant_id: match.player1ParticipantId,
    player2_participant_id: match.player2ParticipantId,
    winner_participant_id: match.winnerParticipantId,
    next_match_id: match.nextMatchId,
    next_slot: match.nextSlot,
  }
}

export function buildEventRecords(
  events: EventRow[],
  participants: ParticipantRow[],
  invites: EventInviteRow[],
  matches: MatchRow[],
): EventRecord[] {
  const mappedEvents = events.map(mapEventRow)
  const mappedParticipants = participants.map(mapParticipantRow)
  const mappedInvites = invites.map(mapInviteRow)
  const mappedMatches = matches.map(mapMatchRow)

  return mappedEvents.map((event) => ({
    event,
    blocks: createBlocksForEvent(event),
    participants: mappedParticipants.filter((participant) => participant.eventId === event.id),
    invites: mappedInvites.filter((invite) => invite.eventId === event.id),
    matches: mappedMatches.filter((match) => match.eventId === event.id),
  }))
}
