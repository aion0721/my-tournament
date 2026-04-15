import {
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { createAppRepository } from '../repositories/repositoryFactory'
import { AppService } from '../services/appService'
import { AppStoreContext, type AppStoreValue } from './appStoreContextValue'

const appRepository = createAppRepository()
const appService = new AppService(appRepository)

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)
  const [state, setState] = useState(() => appRepository.getState())

  useEffect(() => {
    const unsubscribe = appRepository.subscribe(() => setState(appRepository.getState()))

    void appService.initialize().finally(() => {
      setState(appRepository.getState())
      setIsReady(true)
    })

    return unsubscribe
  }, [])

  const value = useMemo<AppStoreValue>(() => {
    const currentUser = state.currentUser

    return {
      state,
      currentUser,
      currentUserName: currentUser?.displayName ?? null,
      isAdmin: currentUser?.role === 'admin',
      isReady,
      signInWithOtp: async (email) => {
        await appService.signInWithOtp(email)
        setState(appRepository.getState())
      },
      logout: async () => {
        await appService.logout()
        setState(appRepository.getState())
      },
      logoutParticipant: async (eventId) => {
        await appService.logoutParticipant(eventId)
        setState(appRepository.getState())
      },
      selectParticipantSession: async (eventId, participantId) => {
        await appService.selectParticipantSession(eventId, participantId)
        setState(appRepository.getState())
      },
      createEvent: async (input) => {
        const eventRecord = await appService.createEvent(input)
        setState(appRepository.getState())
        return eventRecord.event.id
      },
      deleteEvent: async (eventId) => {
        await appService.deleteEvent(eventId)
        setState(appRepository.getState())
      },
      createInvite: async (input) => {
        await appService.createInvite(input)
        setState(appRepository.getState())
      },
      listProfiles: async () => {
        const profiles = await appService.listProfiles()
        setState(appRepository.getState())
        return profiles
      },
      updateUserRole: async (userId, role) => {
        await appService.updateUserRole(userId, role)
        setState(appRepository.getState())
      },
      joinEvent: async (shareToken, participantName) => {
        await appService.joinEvent(shareToken, participantName)
        setState(appRepository.getState())
      },
      joinEventByInvite: async (inviteToken) => {
        await appService.joinEventByInvite(inviteToken)
        setState(appRepository.getState())
      },
      updateParticipantAssignment: async (
        eventId,
        participantId,
        assignedBlockIndex,
        assignedSeed,
      ) => {
        await appService.updateParticipantAssignment(
          eventId,
          participantId,
          assignedBlockIndex,
          assignedSeed,
        )
        setState(appRepository.getState())
      },
      updateParticipantName: async (eventId, participantId, name) => {
        await appService.updateParticipantName(eventId, participantId, name)
        setState(appRepository.getState())
      },
      deleteParticipant: async (eventId, participantId) => {
        await appService.deleteParticipant(eventId, participantId)
        setState(appRepository.getState())
      },
      updateBlockQualifiers: async (eventId, blockId, qualifiedParticipantIds) => {
        await appService.updateBlockQualifiers(eventId, blockId, qualifiedParticipantIds)
        setState(appRepository.getState())
      },
      updateMatchWinner: async (eventId, matchId, winnerParticipantId) => {
        await appService.updateMatchWinner(eventId, matchId, winnerParticipantId)
        setState(appRepository.getState())
      },
    }
  }, [isReady, state])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}
