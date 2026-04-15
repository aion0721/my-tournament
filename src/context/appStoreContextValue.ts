import { createContext } from 'react'
import type { AppState, CreateEventInput, CreateInviteInput, UserProfile, UserRole } from '../domain/models'

export interface AppStoreValue {
  state: AppState
  currentUser: UserProfile | null
  currentUserName: string | null
  isAdmin: boolean
  isReady: boolean
  signInWithOtp: (email: string) => Promise<void>
  logout: () => Promise<void>
  logoutParticipant: (eventId: string) => Promise<void>
  selectParticipantSession: (eventId: string, participantId: string) => Promise<void>
  createEvent: (input: CreateEventInput) => Promise<string>
  deleteEvent: (eventId: string) => Promise<void>
  createInvite: (input: CreateInviteInput) => Promise<void>
  listProfiles: () => Promise<UserProfile[]>
  updateUserRole: (userId: string, role: UserRole) => Promise<void>
  joinEvent: (shareToken: string, participantName: string) => Promise<void>
  joinEventByInvite: (inviteToken: string) => Promise<void>
  updateParticipantAssignment: (
    eventId: string,
    participantId: string,
    assignedBlockIndex: number,
    assignedSeed: number,
  ) => Promise<void>
  updateParticipantName: (
    eventId: string,
    participantId: string,
    name: string,
  ) => Promise<void>
  deleteParticipant: (eventId: string, participantId: string) => Promise<void>
  updateBlockQualifiers: (
    eventId: string,
    blockId: string,
    qualifiedParticipantIds: string[],
  ) => Promise<void>
  updateMatchWinner: (
    eventId: string,
    matchId: string,
    winnerParticipantId: string | null,
  ) => Promise<void>
}

export const AppStoreContext = createContext<AppStoreValue | null>(null)
