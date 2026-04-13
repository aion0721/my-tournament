import type {
  AppState,
  CreateInviteInput,
  CreateEventInput,
  EventRecord,
  EventInvite,
  User,
} from '../domain/models'

export interface AppRepository {
  readonly mode: 'local' | 'supabase'
  initialize(): Promise<void>
  getState(): AppState
  subscribe(listener: () => void): () => void
  loginHost(name: string): Promise<User>
  logout(): Promise<void>
  createEvent(hostUserId: string, input: CreateEventInput): Promise<EventRecord>
  deleteEvent(eventId: string): Promise<void>
  createInvite(input: CreateInviteInput): Promise<EventInvite>
  getEventRecordById(eventId: string): Promise<EventRecord | null>
  getEventRecordByShareToken(shareToken: string): Promise<EventRecord | null>
  getInviteByToken(inviteToken: string): Promise<EventInvite | null>
  joinEvent(shareToken: string, participantName: string): Promise<EventRecord>
  joinEventByInvite(inviteToken: string): Promise<EventRecord>
  updateParticipantAssignment(
    eventId: string,
    participantId: string,
    assignedBlockIndex: number,
    assignedSeed: number,
  ): Promise<EventRecord>
  updateBlockQualifiers(
    eventId: string,
    blockId: string,
    qualifiedParticipantIds: string[],
  ): Promise<EventRecord>
  updateMatchWinner(
    eventId: string,
    matchId: string,
    winnerParticipantId: string | null,
  ): Promise<EventRecord>
  getJoinedParticipantId(eventId: string): Promise<string | null>
}
