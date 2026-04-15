import type {
  AppState,
  CreateInviteInput,
  CreateEventInput,
  EventRecord,
  EventInvite,
  UserProfile,
  UserRole,
} from '../domain/models'

export interface AppRepository {
  readonly mode: 'local' | 'supabase'
  initialize(): Promise<void>
  getState(): AppState
  subscribe(listener: () => void): () => void
  signInWithOtp(email: string): Promise<void>
  logout(): Promise<void>
  logoutParticipant(eventId: string): Promise<void>
  selectParticipantSession(eventId: string, participantId: string): Promise<void>
  createEvent(input: CreateEventInput): Promise<EventRecord>
  deleteEvent(eventId: string): Promise<void>
  createInvite(input: CreateInviteInput): Promise<EventInvite>
  listProfiles(): Promise<UserProfile[]>
  updateUserRole(userId: string, role: UserRole): Promise<void>
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
  updateParticipantName(
    eventId: string,
    participantId: string,
    name: string,
  ): Promise<EventRecord>
  deleteParticipant(eventId: string, participantId: string): Promise<EventRecord>
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
