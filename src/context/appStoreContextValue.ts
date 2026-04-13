import { createContext } from 'react'
import type { AppState, CreateEventInput, CreateInviteInput } from '../domain/models'

export interface AppStoreValue {
  state: AppState
  currentUserName: string | null
  isReady: boolean
  loginHost: (name: string) => Promise<void>
  logout: () => Promise<void>
  createEvent: (hostUserId: string, input: CreateEventInput) => Promise<string>
  createInvite: (input: CreateInviteInput) => Promise<void>
  joinEvent: (shareToken: string, participantName: string) => Promise<void>
  joinEventByInvite: (inviteToken: string) => Promise<void>
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
