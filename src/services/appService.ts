import type { CreateEventInput, CreateInviteInput, UserRole } from '../domain/models'
import type { AppRepository } from '../repositories/appRepository'

export class AppService {
  private readonly repository: AppRepository

  constructor(repository: AppRepository) {
    this.repository = repository
  }

  initialize() {
    return this.repository.initialize()
  }

  signInWithOtp(email: string) {
    return this.repository.signInWithOtp(email)
  }

  logout() {
    this.repository.logout()
  }

  logoutParticipant(eventId: string) {
    return this.repository.logoutParticipant(eventId)
  }

  selectParticipantSession(eventId: string, participantId: string) {
    return this.repository.selectParticipantSession(eventId, participantId)
  }

  createEvent(input: CreateEventInput) {
    return this.repository.createEvent(input)
  }

  deleteEvent(eventId: string) {
    return this.repository.deleteEvent(eventId)
  }

  createInvite(input: CreateInviteInput) {
    return this.repository.createInvite(input)
  }

  listProfiles() {
    return this.repository.listProfiles()
  }

  updateUserRole(userId: string, role: UserRole) {
    return this.repository.updateUserRole(userId, role)
  }

  joinEvent(shareToken: string, participantName: string) {
    return this.repository.joinEvent(shareToken, participantName)
  }

  joinEventByInvite(inviteToken: string) {
    return this.repository.joinEventByInvite(inviteToken)
  }

  updateParticipantAssignment(
    eventId: string,
    participantId: string,
    assignedBlockIndex: number,
    assignedSeed: number,
  ) {
    return this.repository.updateParticipantAssignment(
      eventId,
      participantId,
      assignedBlockIndex,
      assignedSeed,
    )
  }

  updateParticipantName(eventId: string, participantId: string, name: string) {
    return this.repository.updateParticipantName(eventId, participantId, name)
  }

  deleteParticipant(eventId: string, participantId: string) {
    return this.repository.deleteParticipant(eventId, participantId)
  }

  updateBlockQualifiers(eventId: string, blockId: string, qualifiedParticipantIds: string[]) {
    return this.repository.updateBlockQualifiers(eventId, blockId, qualifiedParticipantIds)
  }

  updateMatchWinner(eventId: string, matchId: string, winnerParticipantId: string | null) {
    return this.repository.updateMatchWinner(eventId, matchId, winnerParticipantId)
  }
}
