export type UserRole = 'host' | 'admin'
export type MatchStageType = 'block' | 'final'
export type MatchSlotPosition = 1 | 2

export interface UserProfile {
  id: string
  displayName: string
  role: UserRole
}

export interface Event {
  id: string
  name: string
  hostUserId: string
  hostAuthUserId: string
  capacity: number
  participantsPerBlock: number
  winnersPerBlock: number
  blockCount: number
  shareToken: string
  createdAt: string
}

export interface Participant {
  id: string
  eventId: string
  name: string
  sourceType?: 'open' | 'invite'
  inviteId?: string | null
  assignedBlockIndex: number
  assignedSeed: number
  joinedAt: string
}

export type EventInviteStatus = 'pending' | 'joined'
export type EventInviteType = 'private' | 'preset'

export interface EventInvite {
  id: string
  eventId: string
  displayName: string
  inviteToken: string
  inviteType: EventInviteType
  status: EventInviteStatus
  fixedBlockIndex: number | null
  fixedSeed: number | null
  joinedParticipantId: string | null
  createdAt: string
}

export interface Block {
  id: string
  eventId: string
  index: number
  participantCapacity: number
  winnersCount: number
}

export type MatchSlotSource =
  | {
      type: 'participant'
      blockIndex: number
      seed: number
    }
  | {
      type: 'matchWinner'
      matchId: string
    }
  | {
      type: 'blockQualifier'
      blockId: string
      qualifierIndex: number
    }

export interface Match {
  id: string
  eventId: string
  blockId: string | null
  stageType: MatchStageType
  roundIndex: number
  matchIndex: number
  slot1Source: MatchSlotSource
  slot2Source: MatchSlotSource
  participantSources: MatchSlotSource[]
  advanceCount: number
  isFinalStage: boolean
  participantIds: string[]
  qualifiedParticipantIds: string[]
  player1ParticipantId: string | null
  player2ParticipantId: string | null
  winnerParticipantId: string | null
  nextMatchId: string | null
  nextSlot: MatchSlotPosition | null
}

export interface EventRecord {
  event: Event
  blocks: Block[]
  participants: Participant[]
  invites: EventInvite[]
  matches: Match[]
}

export interface AppState {
  profiles: UserProfile[]
  currentUser: UserProfile | null
  currentAuthUserId: string | null
  joinedParticipantIdsByEventId: Record<string, string>
  eventRecords: EventRecord[]
  storageMode?: 'local' | 'supabase'
}

export interface CreateEventInput {
  name: string
  capacity: number
  participantsPerBlock: number
  winnersPerBlock: number
}

export interface CreateEventValidationResult {
  valid: boolean
  blockCount: number
  issues: string[]
}

export interface CreateInviteInput {
  eventId: string
  displayName: string
  inviteType: EventInviteType
  fixedBlockIndex: number | null
  fixedSeed: number | null
}
