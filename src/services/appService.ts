import type { CreateEventInput, CreateInviteInput } from '../domain/models'
import type { AppRepository } from '../repositories/appRepository'

export class AppService {
  private readonly repository: AppRepository

  constructor(repository: AppRepository) {
    this.repository = repository
  }

  initialize() {
    return this.repository.initialize()
  }

  loginHost(name: string) {
    return this.repository.loginHost(name)
  }

  logout() {
    this.repository.logout()
  }

  logoutParticipant(eventId: string) {
    return this.repository.logoutParticipant(eventId)
  }

  createEvent(hostUserId: string, input: CreateEventInput) {
    return this.repository.createEvent(hostUserId, input)
  }

  deleteEvent(eventId: string) {
    return this.repository.deleteEvent(eventId)
  }

  createInvite(input: CreateInviteInput) {
    return this.repository.createInvite(input)
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

  updateBlockQualifiers(eventId: string, blockId: string, qualifiedParticipantIds: string[]) {
    return this.repository.updateBlockQualifiers(eventId, blockId, qualifiedParticipantIds)
  }

  updateMatchWinner(eventId: string, matchId: string, winnerParticipantId: string | null) {
    return this.repository.updateMatchWinner(eventId, matchId, winnerParticipantId)
  }
}
